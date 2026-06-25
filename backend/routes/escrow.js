import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { sendUserNotification } from './notifications.js';
import { buildEscrowInvoicePdf, uploadPdfToCloudinary } from '../services/invoiceService.js';
import multer from 'multer';
import { generateAWB, requestPickup, generateLabel, createOrderFromDeal } from '../services/shiprocketService.js';

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/escrow/platform-fee - Get current platform fee percentage
router.get('/platform-fee', auth, async (req, res) => {
    try {
        let platformFeePercent = 0.10; // Default
        const feeSetting = await prisma.systemSetting.findUnique({ where: { key: 'platform_fee_percent' } });
        if (feeSetting) platformFeePercent = parseFloat(feeSetting.value);
        res.json({ platform_fee_percent: platformFeePercent });
    } catch (err) {
        console.error('Get platform fee error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/escrow - Get all escrow deals for current user
router.get('/', auth, async (req, res) => {
    try {
        const { chatId } = req.query;
        const where = {
            ...(chatId && { chatId }),
            ...(req.user.role !== 'admin' && {
                OR: [
                    { clientId: req.user.id },
                    { vendorId: req.user.id }
                ]
            })
        };

        const deals = await prisma.escrowDeal.findMany({
            where,
            include: {
                client: {
                    select: { id: true, displayName: true, avatarUrl: true, username: true }
                },
                vendor: {
                    select: { id: true, displayName: true, avatarUrl: true, username: true }
                },
                transactions: {
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(deals);
    } catch (err) {
        console.error('Get deals error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/escrow/:id - Get specific escrow deal
router.get('/:id', auth, async (req, res) => {
    try {
        const deal = await prisma.escrowDeal.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                client: {
                    select: { id: true, displayName: true, avatarUrl: true, username: true }
                },
                vendor: {
                    select: { id: true, displayName: true, avatarUrl: true, username: true }
                },
                transactions: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!deal) {
            return res.status(404).json({ error: 'Deal not found.' });
        }

        // Check if user is part of this deal
        if (req.user.role !== 'admin' && deal.clientId !== req.user.id && deal.vendorId !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized.' });
        }

        res.json(deal);
    } catch (err) {
        console.error('Get escrow deal error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/escrow - Create new escrow deal
router.post('/', auth, async (req, res) => {
    try {
        const { chatId, vendorId, title, description, terms, totalAmount, isSplitDeal, teamId, splitConfig } = req.body;

        if (!chatId || !vendorId || !title || !totalAmount) {
            return res.status(400).json({ error: 'Missing required fields.' });
        }

        if (totalAmount <= 0) {
            return res.status(400).json({ error: 'Total amount must be greater than 0.' });
        }

        const currentUserId = req.user.id;
        const requestedVendorId = parseInt(vendorId);

        // Security: Verify vendor exists
        const vendor = await prisma.user.findUnique({
            where: { id: requestedVendorId }
        });

        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found. Please double check the User ID.' });
        }

        const isCommunity = chatId.startsWith('community_');
        const chatParts = chatId.split('_');

        if (!isCommunity) {
            if (!chatId.startsWith('chat_')) {
                return res.status(400).json({ error: 'Invalid chat ID format.' });
            }
            if (chatParts.length < 3 || chatParts.length > 4) {
                return res.status(400).json({ error: 'Invalid chat ID format.' });
            }
            const chatUserIds = [parseInt(chatParts[1]), parseInt(chatParts[2])].sort();

            if (!chatUserIds.includes(currentUserId)) {
                return res.status(403).json({ error: 'You are not a participant in this chat.' });
            }
            if (!chatUserIds.includes(requestedVendorId)) {
                return res.status(403).json({ error: 'Vendor must be a participant in this chat.' });
            }
        } else {
            const communityId = parseInt(chatParts[1]);
            
            // Verify current user is member or creator
            const clientMember = await prisma.communityMember.findUnique({
                where: { communityId_userId: { communityId, userId: currentUserId } }
            });
            const community = await prisma.community.findUnique({ where: { id: communityId } });
            const isClientCreator = community && community.creatorId === currentUserId;
            
            if (!clientMember && !isClientCreator) {
                return res.status(403).json({ error: 'You are not a member of this community.' });
            }
            
            // Verify vendor is member or creator
            const vendorMember = await prisma.communityMember.findUnique({
                where: { communityId_userId: { communityId, userId: requestedVendorId } }
            });
            const isVendorCreator = community && community.creatorId === requestedVendorId;
            
            if (!vendorMember && !isVendorCreator) {
                return res.status(403).json({ error: 'Vendor must be a member of this community.' });
            }
        }

        // Prevent creating deal with yourself
        if (requestedVendorId === currentUserId) {
            return res.status(400).json({ error: 'Cannot create deal with yourself.' });
        }

        // Prevent duplicate submissions (Check if an identical deal was created in the last 10 seconds)
        const recentDuplicate = await prisma.escrowDeal.findFirst({
            where: {
                chatId,
                clientId: req.user.id,
                vendorId: requestedVendorId,
                title,
                totalAmount: parseFloat(totalAmount),
                createdAt: {
                    gte: new Date(Date.now() - 10000) // 10 seconds ago
                }
            }
        });

        if (recentDuplicate) {
            return res.status(409).json({ error: 'A similar deal was recently created. Please wait a moment.' });
        }

        // Check user balance
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { walletBalance: true }
        });

        // Fetch platform fee from settings
        let platformFeePercent = 0.10; // Default
        const feeSetting = await prisma.systemSetting.findUnique({ where: { key: 'platform_fee_percent' } });
        if (feeSetting) platformFeePercent = parseFloat(feeSetting.value);

        const grossAmount = parseFloat(totalAmount);
        const feeAmount = grossAmount * platformFeePercent;
        const netAmount = grossAmount - feeAmount;

        // Charge the client the gross amount. The deal.totalAmount will store the gross amount
        // and the platform fee will be recorded separately so it doesn't double-affect the deal value.
        const amountToDeduct = grossAmount;
        if (user.walletBalance < amountToDeduct) {
            return res.status(400).json({ error: `Insufficient wallet balance. You need ₹${amountToDeduct.toLocaleString('en-IN')} but only have ₹${user.walletBalance.toLocaleString('en-IN')}. Please add money to your wallet.` });
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Deduct from wallet
            const updatedUser = await tx.user.update({
                where: { id: req.user.id },
                data: { walletBalance: { decrement: amountToDeduct } }
            });

            // 2. Log wallet transaction
            await tx.walletTransaction.create({
                data: {
                    userId: req.user.id,
                    type: 'debit',
                    amount: -amountToDeduct,
                    balance: updatedUser.walletBalance,
                    description: `Escrow creation: ${title}`,
                    reference: chatId,
                    metadata: {
                        dealTitle: title,
                        chatId,
                        vendorId: requestedVendorId,
                        otherUserId: requestedVendorId,
                        otherDisplayName: vendor.displayName
                    }
                }
            });

            // 3. Create active escrow deal (store gross amount as totalAmount)
            const newDeal = await tx.escrowDeal.create({
                data: {
                    chatId,
                    clientId: req.user.id,
                    vendorId: requestedVendorId,
                    title,
                    description: description || '',
                    terms: terms || '',
                    totalAmount: grossAmount, // Store gross amount for clarity
                    status: 'active',
                    paymentStatus: 'paid',
                    paidAmount: grossAmount, // Store Gross amount paid by client
                    isSplitDeal: isSplitDeal || false,
                    teamId: teamId || null,
                    splitConfig: splitConfig || null
                },
                include: {
                    client: {
                        select: { id: true, displayName: true, avatarUrl: true, username: true }
                    },
                    vendor: {
                        select: { id: true, displayName: true, avatarUrl: true, username: true }
                    },
                    transactions: true
                }
            });

            // 3a. Record platform fee as an escrow transaction so it's tracked separately
            if (feeAmount > 0) {
                await tx.escrowTransaction.create({
                    data: {
                        dealId: newDeal.id,
                        percent: 0,
                        amount: feeAmount,
                        note: 'platform_fee'
                    }
                });
            }

            // 4. Activity Log
            await tx.activityLog.create({
                data: {
                    userId: req.user.id,
                    action: 'Created deal (Wallet)',
                    details: `${title} - ₹${amountToDeduct}`
                }
            });

            // 5. System Message (inform about gross and net amounts)
            let systemMsg;
            if (isCommunity) {
                systemMsg = await tx.communityMessage.create({
                    data: {
                        senderId: currentUserId,
                        communityId: parseInt(chatId.split('_')[1]),
                        content: `New Payment Deal: "${title}" for ₹${grossAmount.toLocaleString('en-IN')}. Funds deducted from client wallet. (Net available for release: ₹${netAmount.toLocaleString('en-IN')} after platform fee)`,
                        messageType: 'escrow_created'
                    },
                    include: {
                        sender: {
                            select: { displayName: true, avatarUrl: true, username: true }
                        }
                    }
                });
            } else {
                systemMsg = await tx.message.create({
                    data: {
                        senderId: currentUserId,
                        receiverId: requestedVendorId,
                        chatId,
                        content: `New Payment Deal: "${title}" for ₹${grossAmount.toLocaleString('en-IN')}. Funds deducted from client wallet. (Net available for release: ₹${netAmount.toLocaleString('en-IN')} after platform fee)`,
                        messageType: 'escrow_created'
                    },
                    include: {
                        sender: {
                            select: { displayName: true, avatarUrl: true, username: true }
                        }
                    }
                });
            }

            return { newDeal, systemMsg };
        });

        const io = req.app.get('io');
        if (io) {
            const socketResult = {
                ...result.systemMsg,
                sender_name: result.systemMsg.sender.displayName,
                sender_avatar: result.systemMsg.sender.avatarUrl,
                sender_username: result.systemMsg.sender.username,
            };
            io.to(`user_${requestedVendorId}`).emit('newMessage', socketResult);

            // Also emit escrow update for the vendor
            io.to(chatId).emit('escrowUpdate', result.newDeal);
            io.to(`user_${requestedVendorId}`).emit('escrowUpdate', result.newDeal);
        }

        // Asynchronously generate and send invoice
        (async () => {
            try {
                const pdfBuffer = await buildEscrowInvoicePdf(result.newDeal, result.newDeal.client, result.newDeal.vendor, feeAmount);
                const uploadRes = await uploadPdfToCloudinary(pdfBuffer, `invoice_${result.newDeal.id}_${Date.now()}`);
                
                let invoiceMsg;
                if (isCommunity) {
                    invoiceMsg = await prisma.communityMessage.create({
                        data: {
                            senderId: req.user.id,
                            communityId: parseInt(chatId.split('_')[1]),
                            content: `Tax Invoice for Deal: ${title}`,
                            messageType: 'file',
                            attachmentUrl: uploadRes.secure_url,
                            attachmentName: `Invoice_DL_${result.newDeal.id}.pdf`
                        },
                        include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } }
                    });
                } else {
                    invoiceMsg = await prisma.message.create({
                        data: {
                            senderId: req.user.id,
                            receiverId: requestedVendorId,
                            chatId,
                            content: `Tax Invoice for Deal: ${title}`,
                            messageType: 'file',
                            attachmentUrl: uploadRes.secure_url,
                            attachmentName: `Invoice_DL_${result.newDeal.id}.pdf`,
                            isViewOnce: false
                        },
                        include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } }
                    });
                }

                if (io) {
                    const maskedMsg = {
                        ...invoiceMsg,
                        sender_name: invoiceMsg.sender.displayName,
                        sender_avatar: invoiceMsg.sender.avatarUrl,
                        sender_username: invoiceMsg.sender.username,
                    };
                    io.to(chatId).emit('newMessage', maskedMsg);
                    if (!isCommunity) {
                        io.to(`user_${requestedVendorId}`).emit('newMessage', maskedMsg);
                    }
                }
            } catch (invErr) {
                console.error('Failed to generate escrow invoice:', invErr);
            }
        })();

        res.status(201).json(result.newDeal);
    } catch (err) {
        console.error('Create escrow deal error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/escrow/:id/release - Release payment
router.post('/:id/release', auth, async (req, res) => {
    try {
        const { percent, note } = req.body;
        const dealId = parseInt(req.params.id);

        if (!percent || percent <= 0 || percent > 100) {
            return res.status(400).json({ error: 'Invalid percentage.' });
        }

        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId },
            include: {
                client: { select: { id: true, displayName: true, username: true } },
                vendor: { select: { id: true, displayName: true, username: true } }
            }
        });

        if (!deal) {
            return res.status(404).json({ error: 'Deal not found.' });
        }

        // Only client can release payment
        if (deal.clientId !== req.user.id) {
            return res.status(403).json({ error: 'Only the client can release payment.' });
        }

        // Check if deal is active
        if (deal.status !== 'active') {
            return res.status(400).json({ error: 'Deal is not active.' });
        }

        // PERFORM updates in a transaction
        // Use an atomic update first to ensure we don't exceed 100%
        const io = req.app.get('io');
        let updatedDeal, vendorNet;

        // Platform fee is now deducted at creation. totalAmount of the deal reflects the NET amount.
        try {
            // Re-think: updateMany doesn't return the updated record.
            // Let's use the transaction with a strictly serializable approach or the check.

            const result = await prisma.$transaction(async (tx) => {
                // 1. Fetch current deal with lock (if possible) or just verify condition
                // For valid race condition fix without raw Locking, we use the update count strategy.
                const userPercent = parseFloat(percent);

                // Attempt to update physically using a where clause that safeguards the invariant
                // "releasedPercent + userPercent <= 100"
                // We find the deal first to get current percent to construct the WHERE clause?
                // No, that defeats the purpose. "100 - userPercent" is constant for this request.
                // So: WHERE releasedPercent <= (100 - userPercent)
                const updateBatch = await tx.escrowDeal.updateMany({
                    where: {
                        id: dealId,
                        status: 'active',
                        releasedPercent: { lte: 100 - userPercent }
                    },
                    data: {
                        releasedPercent: { increment: userPercent }
                    }
                });

                if (updateBatch.count === 0) {
                    throw new Error('Release failed. Either deal is inactive or amount exceeds 100%.');
                }

                // Re-fetch deal inside transaction to ensure we have latest data for calculations
                const currentDeal = await tx.escrowDeal.findUnique({ where: { id: dealId } });

                // Find any recorded platform fee for this deal (we stored it as an escrow transaction with note 'platform_fee')
                const feeAgg = await tx.escrowTransaction.aggregate({
                    where: { dealId, note: 'platform_fee' },
                    _sum: { amount: true }
                });
                let recordedFee = (feeAgg && feeAgg._sum && feeAgg._sum.amount) ? feeAgg._sum.amount : 0;

                // Fallback: If no platform fee transaction recorded (e.g. for legacy deals), calculate it dynamically
                if (recordedFee <= 0 && currentDeal.paymentStatus === 'paid') {
                    let platformFeePercent = 0.10; // Default
                    const setting = await tx.systemSetting.findUnique({ where: { key: 'platform_fee_percent' } });
                    if (setting) platformFeePercent = parseFloat(setting.value);
                    recordedFee = currentDeal.totalAmount * platformFeePercent;
                }

                // Calculate vendor net based on gross total minus platform fee
                vendorNet = ((currentDeal.totalAmount - recordedFee) * userPercent) / 100;

                // 3. Create escrow transaction record
                await tx.escrowTransaction.create({
                    data: {
                        dealId,
                        percent: userPercent,
                        amount: vendorNet,
                        note: note || `Payment released (Platform fee already deducted at creation)`
                    }
                });

                // 4. Check if completed and update status
                if (currentDeal.releasedPercent >= 100) {
                    await tx.escrowDeal.update({
                        where: { id: dealId },
                        data: { status: 'completed' }
                    });
                    await tx.communityJob.updateMany({
                        where: { escrowDealId: dealId },
                        data: { status: 'completed' }
                    });
                    currentDeal.status = 'completed'; // Update local obj for response
                }

                // 5. Credit vendor wallet(s)
                if (currentDeal.isSplitDeal && currentDeal.splitConfig) {
                    const splits = currentDeal.splitConfig;
                    for (const split of splits) {
                        const splitAmount = vendorNet * (split.percent / 100);
                        if (splitAmount > 0) {
                            const venUp = await tx.user.update({
                                where: { id: split.userId },
                                data: { walletBalance: { increment: splitAmount } }
                            });
                            await tx.walletTransaction.create({
                                data: {
                                    userId: split.userId,
                                    type: 'escrow_release',
                                    amount: splitAmount,
                                    balance: venUp.walletBalance,
                                    reference: `deal_${dealId}`,
                                    description: `Split Payment release: ${deal.title} (${userPercent}% of deal).`,
                                    metadata: { dealId, dealTitle: deal.title, chatId: deal.chatId, percent: userPercent }
                                }
                            });
                        }
                    }
                } else {
                    const venUp = await tx.user.update({
                        where: { id: deal.vendorId },
                        data: { walletBalance: { increment: vendorNet } }
                    });

                    // 6. Log wallet transaction for vendor
                    await tx.walletTransaction.create({
                        data: {
                            userId: deal.vendorId,
                            type: 'escrow_release',
                            amount: vendorNet,
                            balance: venUp.walletBalance,
                            reference: `deal_${dealId}`,
                            description: `Payment release: ${deal.title} (${userPercent}%).`,
                            metadata: {
                                dealId,
                                dealTitle: deal.title,
                                chatId: deal.chatId,
                                percent: userPercent,
                                otherUserId: deal.clientId,
                                otherDisplayName: deal.client.displayName
                            }
                        }
                    });
                }

                // 7. Log activity
                await tx.activityLog.create({
                    data: {
                        userId: req.user.id,
                        action: 'Released Deal payment',
                        details: `${userPercent}% - ${deal.title}`
                    }
                });

                // 8. Create a system message in the chat
                let systemMessage;
                if (deal.chatId.startsWith('community_')) {
                    systemMessage = await tx.communityMessage.create({
                        data: {
                            senderId: req.user.id,
                            communityId: parseInt(deal.chatId.split('_')[1]),
                            content: ` Funds Released: ₹${vendorNet.toLocaleString('en-IN')} (${userPercent}%) released to vendor for "${deal.title}".`,
                            messageType: 'escrow_released'
                        },
                        include: {
                            sender: {
                                select: { displayName: true, avatarUrl: true, username: true }
                            }
                        }
                    });
                } else {
                    systemMessage = await tx.message.create({
                        data: {
                            senderId: req.user.id,
                            receiverId: deal.vendorId,
                            chatId: deal.chatId,
                            content: ` Funds Released: ₹${vendorNet.toLocaleString('en-IN')} (${userPercent}%) released to vendor for "${deal.title}".`,
                            messageType: 'escrow_released'
                        },
                        include: {
                            sender: {
                                select: { displayName: true, avatarUrl: true, username: true }
                            }
                        }
                    });
                }

                if (io) {
                    const socketResult = {
                        ...systemMessage,
                        sender_name: systemMessage.sender.displayName,
                        sender_avatar: systemMessage.sender.avatarUrl,
                        sender_username: systemMessage.sender.username,
                    };
                    io.to(`user_${deal.vendorId}`).emit('newMessage', socketResult);
                }

                return currentDeal;
            });

            updatedDeal = result;
        } catch (txErr) {
            // Check if it was our custom error
            if (txErr.message === 'Release failed. Either deal is inactive or amount exceeds 100%.') {
                return res.status(400).json({ error: txErr.message });
            }
            throw txErr;
        }

        if (io) {
            io.to(deal.chatId).emit('escrowUpdate', updatedDeal);
            io.to(`user_${deal.vendorId}`).emit('escrowUpdate', updatedDeal);
        }

        sendUserNotification(
            io,
            deal.vendorId,
            ' Payment Released',
            `You received ₹${vendorNet.toLocaleString('en-IN')} from "${deal.title}".`,
            'success',
            { type: 'wallet', dealId, chatId: deal.chatId }
        );

        if (updatedDeal.releasedPercent >= 100) {
            sendUserNotification(
                io,
                deal.clientId,
                'Deal Completed',
                `Your deal "${deal.title}" is now fully completed. All payments have been released.`,
                'success',
                { type: 'escrow', dealId, chatId: deal.chatId }
            );

            // Asynchronously generate and send Settlement Invoice
            (async () => {
                try {
                    const { buildEscrowInvoicePdf, uploadPdfToCloudinary } = await import('../services/invoiceService.js');
                    const pdfBuffer = await buildEscrowInvoicePdf(updatedDeal, deal.client, deal.vendor, 0); // No fee for release
                    const uploadRes = await uploadPdfToCloudinary(pdfBuffer, `invoice_settlement_${updatedDeal.id}_${Date.now()}`);
                    
                    let invoiceMsg;
                    if (deal.chatId.startsWith('community_')) {
                        invoiceMsg = await prisma.communityMessage.create({
                            data: {
                                senderId: req.user.id,
                                communityId: parseInt(deal.chatId.split('_')[1]),
                                content: `Settlement Invoice for Completed Deal: ${deal.title}`,
                                messageType: 'file',
                                attachmentUrl: uploadRes.secure_url,
                                attachmentName: `Settlement_DL_${updatedDeal.id}.pdf`
                            },
                            include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } }
                        });
                    } else {
                        invoiceMsg = await prisma.message.create({
                            data: {
                                senderId: req.user.id,
                                receiverId: deal.vendorId,
                                chatId: deal.chatId,
                                content: `Settlement Invoice for Completed Deal: ${deal.title}`,
                                messageType: 'file',
                                attachmentUrl: uploadRes.secure_url,
                                attachmentName: `Settlement_DL_${updatedDeal.id}.pdf`,
                                isViewOnce: false
                            },
                            include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } }
                        });
                    }

                    if (io) {
                        const maskedMsg = {
                            ...invoiceMsg,
                            sender_name: invoiceMsg.sender.displayName,
                            sender_avatar: invoiceMsg.sender.avatarUrl,
                            sender_username: invoiceMsg.sender.username,
                        };
                        io.to(deal.chatId).emit('newMessage', maskedMsg);
                        if (!deal.chatId.startsWith('community_')) {
                            io.to(`user_${deal.vendorId}`).emit('newMessage', maskedMsg);
                        }
                    }
                } catch (invErr) {
                    console.error('Failed to generate settlement invoice:', invErr);
                }
            })();
            sendUserNotification(
                io,
                deal.vendorId,
                'Deal Completed',
                `The deal "${deal.title}" is now fully completed. All payments have been received.`,
                'success',
                { type: 'escrow', dealId, chatId: deal.chatId }
            );
        }

        res.json(updatedDeal);
    }catch (err) {
        console.error('Release escrow error:', err);
        res.status(500).json({ error: 'Failed to release escrow payment.' });
    }
});

// PUT /api/escrow/:id - Update escrow deal
router.put('/:id', auth, async (req, res) => {
    try {
        const dealId = parseInt(req.params.id);
        const { title, description, status } = req.body;

        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId }
        });

        if (!deal) {
            return res.status(404).json({ error: 'Deal not found.' });
        }

        // Only client can update deal
        if (deal.clientId !== req.user.id) {
            return res.status(403).json({ error: 'Only the client can update the deal.' });
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (status !== undefined && ['active', 'completed', 'cancelled'].includes(status)) {
            updateData.status = status;
        }

        const updatedDeal = await prisma.escrowDeal.update({
            where: { id: dealId },
            data: updateData,
            include: {
                client: {
                    select: { id: true, displayName: true, avatarUrl: true, username: true }
                },
                vendor: {
                    select: { id: true, displayName: true, avatarUrl: true, username: true }
                },
                transactions: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        res.json(updatedDeal);
    } catch (err) {
        console.error('Update escrow deal error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/escrow/:id - Delete or Cancel/Refund escrow deal
router.delete('/:id', auth, async (req, res) => {
    try {
        const dealId = parseInt(req.params.id);
        const { reason } = req.body;

        // Require a reason for refunds/cancellations
        if (!reason || String(reason).trim().length === 0) {
            return res.status(400).json({ error: 'A reason is required to request a refund.' });
        }

        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId }
        });

        if (!deal) {
            return res.status(404).json({ error: 'Deal not found' });
        }

        // Only the client can delete/cancel their own deal
        if (deal.clientId !== req.user.id) {
            return res.status(403).json({ error: 'Only the client can cancel this deal' });
        }

        // Handle Unpaid Deals (Delete)
        if (deal.paymentStatus !== 'paid') {
            await prisma.escrowDeal.delete({
                where: { id: dealId }
            });
            return res.json({ success: true, message: 'Deal deleted successfully' });
        }

        // Handle Paid Deals (Refund & Cancel)
        if (deal.status === 'completed' || deal.status === 'cancelled') {
            return res.status(400).json({ error: 'Cannot cancel a completed or already cancelled deal.' });
        }

        // Determine recorded platform fee for this deal (sum of escrow transactions with note 'platform_fee')
        const feeAgg = await prisma.escrowTransaction.aggregate({
            where: { dealId, note: 'platform_fee' },
            _sum: { amount: true }
        });
        const recordedFee = (feeAgg && feeAgg._sum && feeAgg._sum.amount) ? feeAgg._sum.amount : 0;

        // Refundable amount should exclude the platform fee portion proportional to the remaining funds.
        // remainingGross = gross * (1 - releasedPercent)
        // refundable = (gross - recordedFee) * (1 - releasedPercent)
        const refundableAmount = ((deal.totalAmount - recordedFee) * (1 - (deal.releasedPercent / 100)));
        const io = req.app.get('io');

        await prisma.$transaction(async (tx) => {
            // 1. Credit client wallet
            const updatedClient = await tx.user.update({
                where: { id: req.user.id },
                data: { walletBalance: { increment: refundableAmount } }
            });

            // 2. Log wallet transaction
            await tx.walletTransaction.create({
                data: {
                    userId: req.user.id,
                    type: 'credit',
                    amount: refundableAmount,
                    balance: updatedClient.walletBalance,
                    reference: `refund_deal_${dealId}`,
                    description: `Refund for cancelled deal: ${deal.title} (Reason: ${String(reason).trim()})`
                }
            });

            // 3. Update deal status
            await tx.escrowDeal.update({
                where: { id: dealId },
                data: { status: 'cancelled' }
            });

            // 4. Log activity
            await tx.activityLog.create({
                data: {
                    userId: req.user.id,
                    action: 'Cancelled deal & refunded',
                    details: `${deal.title} - Refunded ₹${refundableAmount.toLocaleString('en-IN')} | Reason: ${String(reason).trim()}`
                }
            });

            // 5. Create a system message in the chat
            let systemMessage;
            if (deal.chatId.startsWith('community_')) {
                systemMessage = await tx.communityMessage.create({
                    data: {
                        senderId: req.user.id,
                        communityId: parseInt(deal.chatId.split('_')[1]),
                        content: `Deal Cancelled & Refunded: The deal "${deal.title}" was cancelled by the client. ₹${refundableAmount.toLocaleString('en-IN')} has been returned to the client's wallet.\n\nReason: ${String(reason).trim()}`,
                        messageType: 'escrow_cancelled'
                    },
                    include: {
                        sender: {
                            select: { displayName: true, avatarUrl: true, username: true }
                        }
                    }
                });
            } else {
                systemMessage = await tx.message.create({
                    data: {
                        senderId: req.user.id,
                        receiverId: deal.vendorId,
                        chatId: deal.chatId,
                        content: `Deal Cancelled & Refunded: The deal "${deal.title}" was cancelled by the client. ₹${refundableAmount.toLocaleString('en-IN')} has been returned to the client's wallet.\n\nReason: ${String(reason).trim()}`,
                        messageType: 'escrow_cancelled'
                    },
                    include: {
                        sender: {
                            select: { displayName: true, avatarUrl: true, username: true }
                        }
                    }
                });
            }

            if (io) {
                const socketResult = {
                    ...systemMessage,
                    sender_name: systemMessage.sender.displayName,
                    sender_avatar: systemMessage.sender.avatarUrl,
                    sender_username: systemMessage.sender.username,
                };
                io.to(`user_${deal.vendorId}`).emit('newMessage', socketResult);
                io.to(`user_${deal.clientId}`).emit('newMessage', socketResult);
            }
        });

        // Notifications
        sendUserNotification(io, deal.clientId, 'Refund Processed', `₹${refundableAmount.toLocaleString('en-IN')} has been returned to your wallet for the deal "${deal.title}".`, 'success', { type: 'wallet' });
        sendUserNotification(io, deal.vendorId, 'Deal Cancelled', `The deal "${deal.title}" was cancelled by the client. Any unreleased funds have been refunded.`, 'alert', { type: 'escrow', dealId, chatId: deal.chatId });

        res.json({ success: true, message: 'Deal cancelled and funds refunded successfully.' });
    } catch (err) {
        console.error('Cancel  deal error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─── AUTH: POST /api/escrow/:id/ship — Ship package (seller) ──────────────────

router.post('/:id/ship', auth, async (req, res) => {
    try {
        const dealId = parseInt(req.params.id);
        const { weight, dimensions, pickupAddress } = req.body;

        if (!weight || !dimensions || !pickupAddress) {
            return res.status(400).json({ error: 'Weight, dimensions, and pickup address are required.' });
        }

        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId }
        });

        if (!deal) {
            return res.status(404).json({ error: 'Deal not found.' });
        }

        if (deal.vendorId !== req.user.id) {
            return res.status(403).json({ error: 'Only the seller can update shipping information.' });
        }

        if (deal.status !== 'active' || deal.paymentStatus !== 'paid') {
            return res.status(400).json({ error: 'Cannot ship unpaid or inactive deals.' });
        }

        let shipmentId = deal.shiprocketShipmentId;

        // Fallback: If Shiprocket order wasn't created during payment for some reason, create it now
        if (!shipmentId) {
            const orderResult = await createOrderFromDeal(dealId);
            if (!orderResult || !orderResult.shipment_id) {
                return res.status(500).json({ error: 'Failed to create Shiprocket order. Ensure buyer has a valid address.' });
            }
            shipmentId = orderResult.shipment_id.toString();
        }

        let trackingId = null;
        let labelUrl = null;

        try {
            // 1. Generate AWB
            const awbResult = await generateAWB(shipmentId);
            trackingId = awbResult?.response?.data?.awb_code;

            // 2. Request Pickup
            if (trackingId) {
                await requestPickup(shipmentId);
            }

            // 3. Generate Label
            const labelResult = await generateLabel(shipmentId);
            labelUrl = labelResult?.label_url;

        } catch (shiprocketErr) {
            console.error('Shiprocket API error during dispatch:', shiprocketErr);
            return res.status(500).json({ error: 'Shiprocket API error: ' + shiprocketErr.message });
        }

        if (!trackingId) {
            return res.status(500).json({ error: 'Failed to generate AWB from Shiprocket.' });
        }

        const initialEvents = [
            {
                status: 'label_created',
                title: 'Shipping Label Generated',
                description: `Label generated with tracking ID ${trackingId}.`,
                timestamp: new Date().toISOString()
            },
            {
                status: 'pickup_scheduled',
                title: 'Pickup Scheduled',
                description: 'Pickup requested from seller location.',
                timestamp: new Date().toISOString()
            }
        ];

        const updatedDeal = await prisma.escrowDeal.update({
            where: { id: dealId },
            data: {
                shippingWeight: parseFloat(weight),
                shippingDimensions: dimensions,
                pickupAddress: pickupAddress,
                trackingId: trackingId,
                shiprocketAwbCode: trackingId,
                shippingLabelUrl: labelUrl,
                shippingStatus: 'pickup_scheduled',
                shippingEvents: initialEvents
            },
            include: {
                client: {
                    select: { id: true, displayName: true, avatarUrl: true, username: true }
                },
                vendor: {
                    select: { id: true, displayName: true, avatarUrl: true, username: true }
                },
                transactions: true
            }
        });

        // System message in chat
        let systemMessage;
        const msgContent = `📦 *Seller has shipped the package!*\nTracking ID: ${trackingId}\nCourier: Krovaa Shipping Express`;
        if (deal.chatId.startsWith('community_')) {
            systemMessage = await prisma.communityMessage.create({
                data: {
                    senderId: req.user.id,
                    communityId: parseInt(deal.chatId.split('_')[1]),
                    content: msgContent,
                    messageType: 'escrow_shipped'
                },
                include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } }
            });
        } else {
            systemMessage = await prisma.message.create({
                data: {
                    senderId: req.user.id,
                    receiverId: deal.clientId,
                    chatId: deal.chatId,
                    content: msgContent,
                    messageType: 'escrow_shipped'
                },
                include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } }
            });
        }

        const io = req.app.get('io');
        if (io) {
            const socketResult = {
                ...systemMessage,
                sender_name: systemMessage.sender.displayName,
                sender_avatar: systemMessage.sender.avatarUrl,
                sender_username: systemMessage.sender.username,
            };
            io.to(`user_${deal.clientId}`).emit('newMessage', socketResult);
            io.to(deal.chatId).emit('escrowUpdate', updatedDeal);
            io.to(`user_${deal.clientId}`).emit('escrowUpdate', updatedDeal);
        }

        sendUserNotification(
            io,
            deal.clientId,
            'Order Shipped',
            `The seller has shipped "${deal.title}". Tracking ID: ${trackingId}`,
            'success',
            { type: 'escrow', dealId, chatId: deal.chatId }
        );

        res.json(updatedDeal);
    } catch (err) {
        console.error('Ship escrow error:', err);
        res.status(500).json({ error: 'Failed to ship package.' });
    }
});

// ─── AUTH: POST /api/escrow/:id/confirm-release — Confirm and release funds (buyer) ─

router.post('/:id/confirm-release', auth, async (req, res) => {
    try {
        const dealId = parseInt(req.params.id);

        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId },
            include: {
                client: { select: { id: true, displayName: true, username: true } },
                vendor: { select: { id: true, displayName: true, username: true } }
            }
        });

        if (!deal) {
            return res.status(404).json({ error: 'Deal not found.' });
        }

        if (deal.clientId !== req.user.id) {
            return res.status(403).json({ error: 'Only the client can confirm and release payment.' });
        }

        if (deal.status !== 'active') {
            return res.status(400).json({ error: 'Deal is not active.' });
        }

        const remainingPercent = 100 - deal.releasedPercent;
        if (remainingPercent <= 0) {
            return res.status(400).json({ error: 'Funds are already fully released.' });
        }

        const io = req.app.get('io');
        let updatedDeal, vendorNet;

        const result = await prisma.$transaction(async (tx) => {
            // Find any recorded platform fee
            const feeAgg = await tx.escrowTransaction.aggregate({
                where: { dealId, note: 'platform_fee' },
                _sum: { amount: true }
            });
            let recordedFee = (feeAgg && feeAgg._sum && feeAgg._sum.amount) ? feeAgg._sum.amount : 0;

            if (recordedFee <= 0 && deal.paymentStatus === 'paid') {
                let platformFeePercent = 0.10;
                const setting = await tx.systemSetting.findUnique({ where: { key: 'platform_fee_percent' } });
                if (setting) platformFeePercent = parseFloat(setting.value);
                recordedFee = deal.totalAmount * platformFeePercent;
            }

            // Calculate remaining net funds
            vendorNet = ((deal.totalAmount - recordedFee) * remainingPercent) / 100;

            // Update escrow deal releasedPercent and status
            const completedDeal = await tx.escrowDeal.update({
                where: { id: dealId },
                data: {
                    releasedPercent: 100,
                    status: 'completed'
                }
            });

            // Mark DealListing as sold if it exists
            if (deal.dealListingId) {
                await tx.dealListing.update({
                    where: { id: deal.dealListingId },
                    data: { status: 'sold' }
                });
            }

            // Create escrow transaction record
            await tx.escrowTransaction.create({
                data: {
                    dealId,
                    percent: remainingPercent,
                    amount: vendorNet,
                    note: 'Final release upon buyer confirmation'
                }
            });

            // Credit vendor wallet
            const venUp = await tx.user.update({
                where: { id: deal.vendorId },
                data: { walletBalance: { increment: vendorNet } }
            });

            // Log wallet transaction for vendor
            await tx.walletTransaction.create({
                data: {
                    userId: deal.vendorId,
                    type: 'escrow_release',
                    amount: vendorNet,
                    balance: venUp.walletBalance,
                    reference: `deal_${dealId}`,
                    description: `Final payment release for completed deal: ${deal.title}.`,
                    metadata: {
                        dealId,
                        dealTitle: deal.title,
                        chatId: deal.chatId,
                        percent: remainingPercent,
                        otherUserId: deal.clientId,
                        otherDisplayName: deal.client.displayName
                    }
                }
            });

            // Log activity
            await tx.activityLog.create({
                data: {
                    userId: req.user.id,
                    action: 'Released remaining escrow payment',
                    details: `100% - ${deal.title}`
                }
            });

            // Create system message in chat
            let systemMessage;
            const msgContent = `🎉 *Deal Completed!*\nBuyer has confirmed delivery. ₹${vendorNet.toLocaleString('en-IN')} has been released to the seller's wallet.`;
            if (deal.chatId.startsWith('community_')) {
                systemMessage = await tx.communityMessage.create({
                    data: {
                        senderId: req.user.id,
                        communityId: parseInt(deal.chatId.split('_')[1]),
                        content: msgContent,
                        messageType: 'escrow_completed'
                    },
                    include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } }
                });
            } else {
                systemMessage = await tx.message.create({
                    data: {
                        senderId: req.user.id,
                        receiverId: deal.vendorId,
                        chatId: deal.chatId,
                        content: msgContent,
                        messageType: 'escrow_completed'
                    },
                    include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } }
                });
            }

            if (io) {
                const socketResult = {
                    ...systemMessage,
                    sender_name: systemMessage.sender.displayName,
                    sender_avatar: systemMessage.sender.avatarUrl,
                    sender_username: systemMessage.sender.username,
                };
                io.to(`user_${deal.vendorId}`).emit('newMessage', socketResult);
            }

            return completedDeal;
        });

        updatedDeal = result;

        if (io) {
            io.to(deal.chatId).emit('escrowUpdate', updatedDeal);
            io.to(`user_${deal.vendorId}`).emit('escrowUpdate', updatedDeal);
            io.to(`user_${deal.clientId}`).emit('escrowUpdate', updatedDeal);
        }

        sendUserNotification(
            io,
            deal.vendorId,
            'Payment Received',
            `You received ₹${vendorNet.toLocaleString('en-IN')} for "${deal.title}".`,
            'success',
            { type: 'wallet', dealId, chatId: deal.chatId }
        );

        sendUserNotification(
            io,
            deal.clientId,
            'Deal Completed',
            `Your deal "${deal.title}" is now fully completed.`,
            'success',
            { type: 'escrow', dealId, chatId: deal.chatId }
        );

        // Generate and send settlement invoice async
        (async () => {
            try {
                const pdfBuffer = await buildEscrowInvoicePdf(updatedDeal, deal.client, deal.vendor, 0);
                const uploadRes = await uploadPdfToCloudinary(pdfBuffer, `invoice_settlement_${updatedDeal.id}_${Date.now()}`);
                
                let invoiceMsg;
                if (deal.chatId.startsWith('community_')) {
                    invoiceMsg = await prisma.communityMessage.create({
                        data: {
                            senderId: req.user.id,
                            communityId: parseInt(deal.chatId.split('_')[1]),
                            content: `Settlement Invoice for Completed Deal: ${deal.title}`,
                            messageType: 'file',
                            attachmentUrl: uploadRes.secure_url,
                            attachmentName: `Settlement_DL_${updatedDeal.id}.pdf`
                        },
                        include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } }
                    });
                } else {
                    invoiceMsg = await prisma.message.create({
                        data: {
                            senderId: req.user.id,
                            receiverId: deal.vendorId,
                            chatId: deal.chatId,
                            content: `Settlement Invoice for Completed Deal: ${deal.title}`,
                            messageType: 'file',
                            attachmentUrl: uploadRes.secure_url,
                            attachmentName: `Settlement_DL_${updatedDeal.id}.pdf`,
                            isViewOnce: false
                        },
                        include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } }
                    });
                }

                if (io) {
                    const maskedMsg = {
                        ...invoiceMsg,
                        sender_name: invoiceMsg.sender.displayName,
                        sender_avatar: invoiceMsg.sender.avatarUrl,
                        sender_username: invoiceMsg.sender.username,
                    };
                    io.to(deal.chatId).emit('newMessage', maskedMsg);
                    if (!deal.chatId.startsWith('community_')) {
                        io.to(`user_${deal.vendorId}`).emit('newMessage', maskedMsg);
                    }
                }
            } catch (invErr) {
                console.error('Failed to generate settlement invoice:', invErr);
            }
        })();

        res.json(updatedDeal);
    } catch (err) {
        console.error('Confirm release error:', err);
        res.status(500).json({ error: 'Failed to confirm delivery and release funds.' });
    }
});

// ─── AUTH: POST /api/escrow/:id/review — Record review (buyer/seller) ──────────

router.post('/:id/review', auth, async (req, res) => {
    try {
        const dealId = parseInt(req.params.id);
        const { rating, comment, role } = req.body;

        if (!rating || isNaN(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
            return res.status(400).json({ error: 'Valid rating between 1 and 5 is required.' });
        }

        if (role !== 'buyer' && role !== 'seller') {
            return res.status(400).json({ error: 'Role must be either "buyer" or "seller".' });
        }

        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId }
        });

        if (!deal) {
            return res.status(404).json({ error: 'Deal not found.' });
        }

        // Verify authorization based on role
        let reviewerId, reviewedId;
        if (role === 'buyer') {
            if (deal.clientId !== req.user.id) {
                return res.status(403).json({ error: 'Not authorized as the buyer.' });
            }
            reviewerId = deal.clientId;
            reviewedId = deal.vendorId;
        } else {
            if (deal.vendorId !== req.user.id) {
                return res.status(403).json({ error: 'Not authorized as the seller.' });
            }
            reviewerId = deal.vendorId;
            reviewedId = deal.clientId;
        }

        // Check if reviewer has already reviewed for this deal
        const existingRating = await prisma.userRating.findFirst({
            where: {
                escrowDealId: dealId,
                reviewerId: reviewerId
            }
        });

        if (existingRating) {
            return res.status(400).json({ error: 'You have already submitted a review for this transaction.' });
        }

        // Create the rating
        const newRating = await prisma.userRating.create({
            data: {
                reviewerId,
                reviewedId,
                rating: parseInt(rating),
                comment: comment || '',
                escrowDealId: dealId
            }
        });

        // Update the reviews count on the reviewed user
        const ratings = await prisma.userRating.findMany({
            where: { reviewedId: reviewedId }
        });

        await prisma.user.update({
            where: { id: reviewedId },
            data: {
                reviews: ratings.length
            }
        });

        res.status(201).json(newRating);
    } catch (err) {
        console.error('Submit review error:', err);
        res.status(500).json({ error: 'Failed to submit review.' });
    }
});

export default router;
