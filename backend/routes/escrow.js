import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { sendUserNotification } from './notifications.js';
import { buildEscrowInvoicePdf, uploadPdfToCloudinary } from '../services/invoiceService.js';
import multer from 'multer';
import { generateAWB, requestPickup, generateLabel, createOrderFromDeal, cancelShiprocketOrder, generateManifest, createReturnOrder } from '../services/shiprocketService.js';
import { refundPayment } from '../config/razorpay.js';
import { sendOrderTrackingUpdateEmail } from '../services/emailService.js';
import {
    getPlatformFeePercent,
    getReturnShippingFee,
    computeFeeSplit,
    computePartialRelease,
    computeCancelRefund,
    computeReturnRefund,
    computeSplitPayouts,
} from '../utils/fees.js';
import { applyWalletDelta } from '../utils/walletOps.js';
import { toAmount } from '../utils/decimalJson.js';
import { roundMoney } from '../utils/money.js';

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/escrow/platform-fee - Get current platform fee percentage
router.get('/platform-fee', auth, async (req, res) => {
    try {
        const platformFeePercent = await getPlatformFeePercent(prisma);
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
                },
                ratings: true,
                shippingAddress: true,
                dealListing: {
                    select: { deliveryType: true }
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

        // Attach deliveryType from dealListing for the frontend
        if (deal.dealListing) {
            deal.deliveryType = deal.dealListing.deliveryType;
        }

        res.json(deal);
    } catch (err) {
        console.error('Get escrow deal error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/escrow/:id/cancel - Cancel an active escrow deal
router.post('/:id/cancel', auth, async (req, res) => {
    try {
        const dealId = parseInt(req.params.id);

        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId },
            include: {
                client: { select: { id: true, displayName: true, username: true } },
                vendor: { select: { id: true, displayName: true, username: true } },
                dealListing: true
            }
        });

        if (!deal) {
            return res.status(404).json({ error: 'Deal not found.' });
        }

        // Only buyer or seller can cancel
        if (deal.clientId !== req.user.id && deal.vendorId !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized to cancel this deal.' });
        }

        // Prevent cancellation if already shipped
        const uncancelableStatuses = ['in_transit', 'out_for_delivery', 'delivered', 'rto'];
        if (deal.shippingStatus && uncancelableStatuses.includes(deal.shippingStatus)) {
            return res.status(400).json({ error: `Cannot cancel order. Current shipping status: ${deal.shippingStatus}` });
        }

        if (deal.status === 'completed' || deal.status === 'cancelled') {
            return res.status(400).json({ error: `Order is already ${deal.status}.` });
        }

        // Try canceling Shiprocket order if it exists
        if (deal.shiprocketOrderId) {
            try {
                await cancelShiprocketOrder([deal.shiprocketOrderId]);
            } catch (err) {
                console.error("Failed to cancel Shiprocket order", err);
                // We'll proceed with local cancellation even if shiprocket fails, or maybe just log it.
            }
        }

        const isPaid = deal.paymentStatus === 'paid' && deal.paidAmount > 0;

        // The refund must exclude the platform fee AND anything already released
        // to the vendor. Refunding the full paidAmount here would let the
        // client take back money the vendor already holds, leaving the platform
        // out of pocket.
        const feeAgg = await prisma.escrowTransaction.aggregate({
            where: { dealId, note: 'platform_fee' },
            _sum: { amount: true }
        });
        const recordedFee = (feeAgg && feeAgg._sum && feeAgg._sum.amount) ? feeAgg._sum.amount : 0;
        const platformFeePercent = recordedFee > 0 ? 0 : await getPlatformFeePercent(prisma);
        const refundAmount = isPaid
            ? computeCancelRefund({
                grossAmount: deal.totalAmount,
                recordedFee,
                platformFeePercent,
                paymentStatus: deal.paymentStatus,
                releasedPercent: deal.releasedPercent
            })
            : 0;

        const updatedDeal = await prisma.$transaction(async (tx) => {
            // Refund to buyer wallet if paid
            if (isPaid && refundAmount > 0) {
                const user = await applyWalletDelta(tx, deal.clientId, refundAmount);

                await tx.walletTransaction.create({
                    data: {
                        userId: deal.clientId,
                        type: 'credit',
                        amount: refundAmount,
                        balance: user.walletBalance,
                        description: `Refund: Order Cancelled - ${deal.title}`,
                        reference: deal.chatId,
                        metadata: { dealId: deal.id, action: 'cancel_refund', platformFeeRetained: recordedFee }
                    }
                });
            }

            // Update deal status
            return await tx.escrowDeal.update({
                where: { id: dealId },
                data: {
                    status: 'cancelled',
                    paymentStatus: isPaid ? 'refunded' : 'pending'
                },
                include: {
                    client: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
                    vendor: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
                    transactions: true
                }
            });
        });

        // Notify counterpart
        const io = req.app.get('io');
        const counterpartId = deal.clientId === req.user.id ? deal.vendorId : deal.clientId;
        const msgContent = `❌ *Order Cancelled*\nThis order has been cancelled by the ${deal.clientId === req.user.id ? 'buyer' : 'seller'}.${isPaid ? ' The buyer has been refunded to their wallet.' : ''}`;

        // Send System Message
        let systemMessage;
        if (deal.chatId.startsWith('community_')) {
            systemMessage = await prisma.communityMessage.create({
                data: {
                    senderId: req.user.id,
                    communityId: parseInt(deal.chatId.split('_')[1]),
                    content: msgContent,
                    messageType: 'escrow_cancelled'
                },
                include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } }
            });
        } else {
            systemMessage = await prisma.message.create({
                data: {
                    senderId: req.user.id,
                    receiverId: counterpartId,
                    chatId: deal.chatId,
                    content: msgContent,
                    messageType: 'escrow_cancelled'
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
            io.to(`user_${counterpartId}`).emit('newMessage', socketResult);
            io.to(deal.chatId).emit('escrowUpdate', updatedDeal);
            io.to(`user_${deal.clientId}`).emit('escrowUpdate', updatedDeal);
            io.to(`user_${deal.vendorId}`).emit('escrowUpdate', updatedDeal);

            sendUserNotification(
                io,
                counterpartId,
                'Order Cancelled',
                `The order "${deal.title}" was cancelled.`,
                'warning',
                { type: 'escrow', dealId: deal.id, chatId: deal.chatId }
            );
        }

        res.json(updatedDeal);
    } catch (err) {
        console.error('Cancel escrow deal error:', err);
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
        const platformFeePercent = await getPlatformFeePercent(prisma);

        const grossAmount = parseFloat(totalAmount);
        const { fee: feeAmount, net: netAmount } = computeFeeSplit(grossAmount, platformFeePercent, { shippingFee: 0 });

        // Charge the client the gross amount. The deal.totalAmount will store the gross amount
        // and the platform fee will be recorded separately so it doesn't double-affect the deal value.
        const amountToDeduct = grossAmount;
        if (user.walletBalance < amountToDeduct) {
            return res.status(400).json({ error: `Insufficient wallet balance. You need ₹${toAmount(amountToDeduct).toLocaleString('en-IN')} but only have ₹${toAmount(user.walletBalance).toLocaleString('en-IN')}. Please add money to your wallet.` });
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Deduct from wallet
            const updatedUser = await applyWalletDelta(tx, req.user.id, -amountToDeduct);

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
                        content: `New Payment Deal: "${title}" for ₹${toAmount(grossAmount).toLocaleString('en-IN')}. Funds deducted from client wallet. (Net available for release: ₹${toAmount(netAmount).toLocaleString('en-IN')} after platform fee)`,
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
                        content: `New Payment Deal: "${title}" for ₹${toAmount(grossAmount).toLocaleString('en-IN')}. Funds deducted from client wallet. (Net available for release: ₹${toAmount(netAmount).toLocaleString('en-IN')} after platform fee)`,
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

// POST /api/escrow/:id/set-address - Link delivery address and calculate shipping
router.post('/:id/set-address', auth, async (req, res) => {
    try {
        const dealId = parseInt(req.params.id);
        const { addressId } = req.body;

        if (!addressId) return res.status(400).json({ error: 'Address ID is required.' });

        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId },
            include: { dealListing: true, vendor: true }
        });

        if (!deal) return res.status(404).json({ error: 'Deal not found.' });
        if (deal.clientId !== req.user.id) return res.status(403).json({ error: 'Not authorized.' });
        if (deal.status !== 'pending_payment') return res.status(400).json({ error: 'Address can only be set before payment.' });

        const address = await prisma.orderAddress.findUnique({ where: { id: parseInt(addressId) } });
        if (!address) return res.status(404).json({ error: 'Address not found.' });
        if (address.buyerId !== req.user.id) return res.status(403).json({ error: 'Not authorized for this address.' });

        // Calculate shipping fee if applicable
        let shippingFee = 0;
        if (deal.dealListing?.deliveryType === 'shipping') {
            // A wrong origin produces a wrong rate and can wrongly reject a
            // serviceable pincode, so an unset seller pincode is a hard error
            // rather than a silent fallback to a default city.
            const originPincode = deal.vendor?.businessPincode;
            if (!originPincode) {
                return res.status(400).json({
                    error: 'Seller has not set a pickup pincode, so shipping cannot be quoted.',
                    code: 'SELLER_PINCODE_MISSING',
                });
            }
            try {

                const { checkServiceability } = await import('../services/shiprocketService.js');
                const serviceability = await checkServiceability({
                    pickup_postcode: originPincode,
                    delivery_postcode: address.pincode,
                    weight: deal.dealListing.shippingWeight || 1.0,
                    cod: 0
                });

                if (serviceability.status === 200 && serviceability.data.available_courier_companies?.length > 0) {
                    // Quote the cheapest available courier rather than whatever
                    // the provider happens to list first: a lower shipped price
                    // is the single biggest driver of both conversion and RTO.
                    const cheapest = [...serviceability.data.available_courier_companies]
                        .filter((c) => Number.isFinite(Number(c.rate)))
                        .sort((a, b) => Number(a.rate) - Number(b.rate))[0];
                    if (!cheapest) {
                        return res.status(400).json({ error: 'No priced courier available for this pincode.' });
                    }
                    shippingFee = roundMoney(cheapest.rate);
                } else {
                    return res.status(400).json({ error: 'Delivery is not serviceable to this pincode.' });
                }
            } catch (err) {
                console.error('Shipping calculation error:', err);
                return res.status(500).json({ error: 'Failed to calculate shipping cost.' });
            }
        }

        const newTotal = deal.dealListing ? (deal.dealListing.price + shippingFee) : deal.totalAmount;
        let newDescription = deal.dealListing ? deal.dealListing.description : deal.description;
        if (shippingFee > 0) {
            newDescription += `\n\nIncludes ₹${shippingFee} shipping fee.`;
        }

        const updatedDeal = await prisma.escrowDeal.update({
            where: { id: dealId },
            data: {
                shippingAddressId: parseInt(addressId),
                totalAmount: newTotal,
                // Persisted so the commission base can exclude the courier
                // charge at payment time.
                shippingFee: roundMoney(shippingFee),
                description: newDescription
            },
            include: { shippingAddress: true, client: { select: { id: true, displayName: true, avatarUrl: true, username: true } }, vendor: { select: { id: true, displayName: true, avatarUrl: true, username: true } } }
        });

        res.json(updatedDeal);
    } catch (err) {
        console.error('Set address error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/escrow/:id/release - Release payment
router.post('/:id/release', auth, async (req, res) => {
    try {
        const { percent, note } = req.body;
        const dealId = parseInt(req.params.id);

        // Reject non-numeric input explicitly: a loose comparison lets "abc"
        // through and then crashes later as a 500 instead of a clean 400.
        // Booleans are rejected too, since Number(true) === 1 is nonsense here.
        const releasePercent = typeof percent === 'boolean' ? NaN : Number(percent);
        if (!Number.isFinite(releasePercent) || releasePercent <= 0 || releasePercent > 100) {
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
                const userPercent = releasePercent;

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

                // The platform fee is settled once, at payment time. Prefer the recorded
                // fee; only legacy deals without one fall back to the current setting.
                const feeAgg = await tx.escrowTransaction.aggregate({
                    where: { dealId, note: 'platform_fee' },
                    _sum: { amount: true }
                });
                const recordedFee = (feeAgg && feeAgg._sum && feeAgg._sum.amount) ? feeAgg._sum.amount : 0;
                const platformFeePercent = recordedFee > 0 ? 0 : await getPlatformFeePercent(tx);

                // Calculate vendor net based on gross total minus platform fee
                vendorNet = computePartialRelease({
                    grossAmount: currentDeal.totalAmount,
                    recordedFee,
                    platformFeePercent,
                    paymentStatus: currentDeal.paymentStatus,
                    percent: userPercent
                });

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
                    // Splits are computed from the post-fee net and must sum to it exactly.
                    const splits = computeSplitPayouts(vendorNet, currentDeal.splitConfig);
                    for (const split of splits) {
                        const venUp = await applyWalletDelta(tx, split.userId, split.amount);
                        await tx.walletTransaction.create({
                            data: {
                                userId: split.userId,
                                type: 'escrow_release',
                                amount: split.amount,
                                balance: venUp.walletBalance,
                                reference: `deal_${dealId}`,
                                description: `Split Payment release: ${deal.title} (${userPercent}% of deal).`,
                                metadata: { dealId, dealTitle: deal.title, chatId: deal.chatId, percent: userPercent, splitPercent: split.percent }
                            }
                        });
                    }
                } else {
                    const venUp = await applyWalletDelta(tx, deal.vendorId, vendorNet);

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
                            content: ` Funds Released: ₹${toAmount(vendorNet).toLocaleString('en-IN')} (${userPercent}%) released to vendor for "${deal.title}".`,
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
                            content: ` Funds Released: ₹${toAmount(vendorNet).toLocaleString('en-IN')} (${userPercent}%) released to vendor for "${deal.title}".`,
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
            `You received ₹${toAmount(vendorNet).toLocaleString('en-IN')} from "${deal.title}".`,
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

        // Prevent cancellation if package is shipped or scheduled for pickup
        const uncancelableStatuses = ['pickup_scheduled', 'in_transit', 'out_for_delivery', 'delivered', 'rto'];
        if (deal.trackingId || (deal.shippingStatus && uncancelableStatuses.includes(deal.shippingStatus))) {
            return res.status(400).json({ error: 'Cannot cancel the deal once the package is shipped or scheduled for pickup.' });
        }

        // Determine recorded platform fee for this deal (sum of escrow transactions with note 'platform_fee')
        const feeAgg = await prisma.escrowTransaction.aggregate({
            where: { dealId, note: 'platform_fee' },
            _sum: { amount: true }
        });
        const recordedFee = (feeAgg && feeAgg._sum && feeAgg._sum.amount) ? feeAgg._sum.amount : 0;
        const platformFeePercent = recordedFee > 0 ? 0 : await getPlatformFeePercent(prisma);

        // Refundable amount excludes the platform fee and anything already released,
        // so the client gets back the unreleased net and the platform keeps its fee.
        const refundableAmount = computeCancelRefund({
            grossAmount: deal.totalAmount,
            recordedFee,
            platformFeePercent,
            paymentStatus: deal.paymentStatus,
            releasedPercent: deal.releasedPercent
        });
        const io = req.app.get('io');

        await prisma.$transaction(async (tx) => {
            // 1. Credit client wallet                const updatedClient = await applyWalletDelta(tx, req.user.id, refundableAmount);

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
                    details: `${deal.title} - Refunded ₹${toAmount(refundableAmount).toLocaleString('en-IN')} | Reason: ${String(reason).trim()}`
                }
            });

            // 5. Create a system message in the chat
            let systemMessage;
            if (deal.chatId.startsWith('community_')) {
                systemMessage = await tx.communityMessage.create({
                    data: {
                        senderId: req.user.id,
                        communityId: parseInt(deal.chatId.split('_')[1]),
                        content: `Deal Cancelled & Refunded: The deal "${deal.title}" was cancelled by the client. ₹${toAmount(refundableAmount).toLocaleString('en-IN')} has been returned to the client's wallet.\n\nReason: ${String(reason).trim()}`,
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
                        content: `Deal Cancelled & Refunded: The deal "${deal.title}" was cancelled by the client. ₹${toAmount(refundableAmount).toLocaleString('en-IN')} has been returned to the client's wallet.\n\nReason: ${String(reason).trim()}`,
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
        sendUserNotification(io, deal.clientId, 'Refund Processed', `₹${toAmount(refundableAmount).toLocaleString('en-IN')} has been returned to your wallet for the deal "${deal.title}".`, 'success', { type: 'wallet' });
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
            where: { id: dealId },
            include: {
                shippingAddress: true,  // ← include OrderAddress for ShipRocket payload
                dealListing: { select: { deliveryType: true } },
                client: { select: { id: true, email: true, displayName: true, username: true } }
            }
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

        // For shipping deals, verify buyer address exists
        if (deal.dealListing?.deliveryType === 'shipping' && !deal.shippingAddress) {
            return res.status(400).json({ 
                error: 'Buyer has not provided a delivery address. Please ask the buyer to add their shipping address.' 
            });
        }

        // Save weight/dimensions first so createOrderFromDeal can include them in payload
        await prisma.escrowDeal.update({
            where: { id: dealId },
            data: {
                shippingWeight: parseFloat(weight),
                shippingDimensions: dimensions,
                pickupAddress: pickupAddress
            }
        });

        let shipmentId = deal.shiprocketShipmentId;

        // Fallback: If ShipRocket order wasn't created during payment, create it now
        if (!shipmentId) {
            const orderResult = await createOrderFromDeal(dealId);
            if (!orderResult || (!orderResult.shipment_id && !orderResult.payload?.shipment_id)) {
                return res.status(500).json({ 
                    error: 'Failed to create ShipRocket order. Ensure buyer has a valid delivery address with state and full address line.' 
                });
            }
            shipmentId = (orderResult.shipment_id || orderResult.payload?.shipment_id).toString();
        }

        let trackingId = null;
        let labelUrl = null;

        try {
            // 1. Generate AWB (assigns courier)
            let awbResult;
            try {
                awbResult = await generateAWB(shipmentId);
            } catch (awbErr) {
                // If AWB is already assigned and cancelled, we must recreate the order
                if (awbErr.message.includes('already assigned') && awbErr.message.includes('CANCELLED')) {
                    console.log('🔄 Old shipment has cancelled AWB. Recreating Shiprocket order...');
                    
                    // Clear the old IDs in database first so createOrderFromDeal doesn't skip
                    await prisma.escrowDeal.update({
                        where: { id: dealId },
                        data: { shiprocketOrderId: null, shiprocketShipmentId: null }
                    });

                    const orderResult = await createOrderFromDeal(dealId);
                    if (!orderResult || (!orderResult.shipment_id && !orderResult.payload?.shipment_id)) {
                        throw new Error('Failed to recreate ShipRocket order after AWB cancellation.');
                    }
                    shipmentId = (orderResult.shipment_id || orderResult.payload?.shipment_id).toString();
                    awbResult = await generateAWB(shipmentId);
                } else {
                    throw awbErr;
                }
            }

            trackingId = awbResult?.response?.data?.awb_code 
                      || awbResult?.awb_code 
                      || awbResult?.payload?.awb_code;

            if (!trackingId) {
                const errMsg = awbResult?.message 
                            || awbResult?.response?.data?.awb_assign_error 
                            || 'Failed to assign AWB courier. Please check if your ShipRocket account is active and has sufficient wallet balance.';
                return res.status(400).json({ error: errMsg });
            }

            // 2. Request Pickup
            if (trackingId) {
                try {
                    await requestPickup(shipmentId);
                } catch (pickupErr) {
                    if (pickupErr.message.includes('Already in Pickup Queue') || pickupErr.message.toLowerCase().includes('pickup queue')) {
                        console.log('ℹ️ Shipment is already in pickup queue (non-blocking).');
                    } else {
                        throw pickupErr;
                    }
                }
            }

            // 3. Generate Label PDF
            const labelResult = await generateLabel(shipmentId);
            labelUrl = labelResult?.label_url || labelResult?.response?.label_url;

        } catch (shiprocketErr) {
            console.error('ShipRocket API error during dispatch:', shiprocketErr);
            return res.status(500).json({ error: 'ShipRocket API error: ' + shiprocketErr.message });
        }

        if (!trackingId) {
            return res.status(500).json({ error: 'Failed to generate AWB from ShipRocket.' });
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
        const msgContent = `📦 *Seller has shipped the package!*\nTracking ID: ${trackingId}\nTrack your package here: https://shiprocket.co/tracking/${trackingId}`;
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

        if (deal.client && deal.client.email) {
            sendOrderTrackingUpdateEmail(deal.client.email, {
                customerName: deal.client.displayName || deal.client.username,
                dealTitle: deal.title,
                trackingId: trackingId,
                shippingStatus: 'Shipped'
            }).catch(e => console.error('Buyer shipping dispatch email failed:', e));
        }

        res.json(updatedDeal);
    } catch (err) {
        console.error('Ship escrow error:', err);
        res.status(500).json({ error: 'Failed to ship package.' });
    }
});

// GET /api/escrow/:id/manifest - Generate and redirect to Shiprocket manifest PDF
router.get('/:id/manifest', auth, async (req, res) => {
    try {
        const dealId = parseInt(req.params.id);
        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId }
        });

        if (!deal) {
            return res.status(404).json({ error: 'Deal not found.' });
        }

        if (deal.vendorId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized.' });
        }

        if (!deal.shiprocketShipmentId) {
            return res.status(400).json({ error: 'Shipment has not been created yet in Shiprocket.' });
        }

        const result = await generateManifest(deal.shiprocketShipmentId);
        const manifestUrl = result?.manifest_url || result?.response?.manifest_url;

        if (!manifestUrl) {
            return res.status(500).json({ error: 'Failed to generate manifest from Shiprocket.' });
        }

        res.json({ manifestUrl });
    } catch (err) {
        console.error('Generate manifest error:', err);
        res.status(500).json({ error: 'Failed to retrieve manifest: ' + err.message });
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
            // Find the platform fee recorded when the client paid.
            const feeAgg = await tx.escrowTransaction.aggregate({
                where: { dealId, note: 'platform_fee' },
                _sum: { amount: true }
            });
            const recordedFee = (feeAgg && feeAgg._sum && feeAgg._sum.amount) ? feeAgg._sum.amount : 0;
            const platformFeePercent = recordedFee > 0 ? 0 : await getPlatformFeePercent(tx);

            // Calculate remaining net funds (gross minus fee, pro-rated to what's left)
            vendorNet = computePartialRelease({
                grossAmount: deal.totalAmount,
                recordedFee,
                platformFeePercent,
                paymentStatus: deal.paymentStatus,
                percent: remainingPercent
            });

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
            const venUp = await applyWalletDelta(tx, deal.vendorId, vendorNet);

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
            const msgContent = `🎉 *Deal Completed!*\nBuyer has confirmed delivery. ₹${toAmount(vendorNet).toLocaleString('en-IN')} has been released to the seller's wallet.`;
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
            `You received ₹${toAmount(vendorNet).toLocaleString('en-IN')} for "${deal.title}".`,
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

// POST /api/escrow/:id/return/request - Buyer requests return (requires video)
router.post('/:id/return/request', auth, async (req, res) => {
    try {
        const { reason, videoUrl } = req.body;
        if (!reason || !videoUrl) return res.status(400).json({ error: 'Reason and video proof are required.' });

        const deal = await prisma.escrowDeal.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!deal) return res.status(404).json({ error: 'Deal not found.' });
        if (deal.clientId !== req.user.id) return res.status(403).json({ error: 'Only buyer can request return.' });
        
        // Check 3-day window from delivery
        // ponytail: If shippingStatus is delivered, we assume we want to allow it. If shippingEvents track delivery date, we'd check it.
        // As a simplification, if it's delivered, we check updatedAt or we'd ideally check the actual delivery date.
        // Let's assume updatedAt is the delivery date for now.
        const daysSinceUpdate = (Date.now() - deal.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (deal.shippingStatus !== 'delivered') return res.status(400).json({ error: 'Deal is not delivered yet.' });
        if (daysSinceUpdate > 3) return res.status(400).json({ error: 'Return window (3 days) has expired.' });

        await prisma.$transaction(async (tx) => {
            await tx.paymentRefund.create({
                data: {
                    userId: req.user.id,
                    amount: deal.paidAmount,
                    reason,
                    videoUrl,
                    status: 'pending',
                    escrowDealId: deal.id
                }
            });
            await tx.escrowDeal.update({
                where: { id: deal.id },
                data: { shippingStatus: 'return_requested' }
            });
        });

        // Notify Admin
        await sendUserNotification(null, 'New Return Request', `Return requested for deal: ${deal.title}`, 'alert', null, { dealId: deal.id });

        res.json({ success: true, message: 'Return requested successfully.' });
    } catch (err) {
        console.error('Return request error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/escrow/:id/return/decision - Admin approves or rejects
router.put('/:id/return/decision', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'staff') return res.status(403).json({ error: 'Unauthorized.' });
        const { action, adminNote } = req.body;
        if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Invalid action.' });

        const deal = await prisma.escrowDeal.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { returnRefund: true }
        });
        if (!deal || !deal.returnRefund) return res.status(404).json({ error: 'Return request not found.' });

        const newShippingStatus = action === 'approve' ? 'return_approved' : 'return_rejected';
        const newRefundStatus = action === 'approve' ? 'approved' : 'rejected';

        let returnTrackingId = null;
        let returnLabelUrl = null;

        if (action === 'approve') {
            try {
                const returnOrderResult = await createReturnOrder(deal.id);
                if (returnOrderResult) {
                    const shipmentId = returnOrderResult.shipment_id || returnOrderResult.payload?.shipment_id;
                    if (shipmentId) {
                        const awbRes = await generateAWB(shipmentId.toString());
                        returnTrackingId = awbRes.response?.data?.awb_code || awbRes.awb_code || `AWB_RET_DUMMY_${Date.now()}`;
                        
                        const labelRes = await generateLabel(shipmentId.toString());
                        returnLabelUrl = labelRes.label_url || labelRes.response?.label_url || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
                    } else if (returnOrderResult.awb_code) {
                        returnTrackingId = returnOrderResult.awb_code;
                    }
                }
            } catch (srErr) {
                console.error('[ShipRocket] Return booking failed, fallback to dummy tracking:', srErr);
                returnTrackingId = `AWB_RET_DUMMY_${Date.now()}`;
                returnLabelUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
            }
        }

        await prisma.$transaction(async (tx) => {
            await tx.paymentRefund.update({
                where: { id: deal.returnRefund.id },
                data: { 
                    status: newRefundStatus, 
                    notes: adminNote,
                    returnTrackingId: returnTrackingId
                }
            });
            await tx.escrowDeal.update({
                where: { id: deal.id },
                data: { 
                    shippingStatus: newShippingStatus,
                    trackingId: returnTrackingId || deal.trackingId,
                    shippingLabelUrl: returnLabelUrl || deal.shippingLabelUrl
                }
            });
        });

        await sendUserNotification(null, `Return ${action}d`, `Your return for ${deal.title} was ${action}d.`, 'info', deal.clientId, { dealId: deal.id });
        res.json({ success: true });
    } catch (err) {
        console.error('Return decision error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/escrow/:id/return/ship - Buyer ships return
router.put('/:id/return/ship', auth, async (req, res) => {
    try {
        const { trackingId } = req.body;
        if (!trackingId) return res.status(400).json({ error: 'Tracking ID is required.' });

        const deal = await prisma.escrowDeal.findUnique({ where: { id: parseInt(req.params.id) }, include: { returnRefund: true } });
        if (!deal || deal.clientId !== req.user.id) return res.status(403).json({ error: 'Unauthorized.' });
        if (deal.shippingStatus !== 'return_approved') return res.status(400).json({ error: 'Return not approved.' });

        await prisma.$transaction(async (tx) => {
            await tx.paymentRefund.update({
                where: { id: deal.returnRefund.id },
                data: { returnTrackingId: trackingId }
            });
            await tx.escrowDeal.update({
                where: { id: deal.id },
                data: { shippingStatus: 'return_shipped' }
            });
        });

        await sendUserNotification(null, 'Return Shipped', `Buyer shipped return for ${deal.title}`, 'info', deal.vendorId, { dealId: deal.id });
        res.json({ success: true });
    } catch (err) {
        console.error('Return ship error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/escrow/:id/return/receive - Seller confirms receipt
router.put('/:id/return/receive', auth, async (req, res) => {
    try {
        const deal = await prisma.escrowDeal.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!deal || deal.vendorId !== req.user.id) return res.status(403).json({ error: 'Unauthorized.' });
        if (deal.shippingStatus !== 'return_shipped') return res.status(400).json({ error: 'Return not shipped.' });

        await prisma.escrowDeal.update({
            where: { id: deal.id },
            data: { shippingStatus: 'return_received' }
        });

        await sendUserNotification(null, 'Return Received', `Seller received return for ${deal.title}`, 'info', deal.clientId, { dealId: deal.id });
        res.json({ success: true });
    } catch (err) {
        console.error('Return receive error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/escrow/:id/return/refund - Admin issues actual refund
router.post('/:id/return/refund', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'staff') return res.status(403).json({ error: 'Unauthorized.' });
        
        const deal = await prisma.escrowDeal.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { returnRefund: true }
        });
        if (!deal || !deal.returnRefund) return res.status(404).json({ error: 'Return request not found.' });
        if (deal.status === 'refunded') return res.status(400).json({ error: 'Already refunded.' });
        // Can be done anytime after return_requested actually, but usually after return_received. We'll leave it to admin discretion.

        // Settle on the fee actually charged at payment time, not today's configured rate.
        const feeAgg = await prisma.escrowTransaction.aggregate({
            where: { id: deal.id, note: 'platform_fee' },
            _sum: { amount: true }
        });
        const recordedFee = (feeAgg && feeAgg._sum && feeAgg._sum.amount) ? feeAgg._sum.amount : 0;
        const platformFeePercent = recordedFee > 0 ? 0 : await getPlatformFeePercent(prisma);
        const returnShippingFee = await getReturnShippingFee(prisma);

        const refundAmount = computeReturnRefund({
            paidAmount: deal.paidAmount,
            grossAmount: deal.totalAmount,
            recordedFee,
            platformFeePercent,
            returnShippingFee
        });

        if (deal.razorpayPaymentId) {
            // Refund via Razorpay
            await refundPayment(deal.razorpayPaymentId, refundAmount);
        } else {
            // Wallet paid deal
            await prisma.$transaction(async (tx) => {
                const user = await applyWalletDelta(tx, deal.clientId, refundAmount);
                await tx.walletTransaction.create({
                    data: {
                        userId: deal.clientId,
                        type: 'credit',
                        amount: refundAmount,
                        balance: user.walletBalance,
                        description: `Refund for Escrow Deal: ${deal.title}`,
                        reference: deal.chatId,
                        metadata: { dealId: deal.id }
                    }
                });
            });
        }

        await prisma.$transaction(async (tx) => {
            await tx.paymentRefund.update({
                where: { id: deal.returnRefund.id },
                data: { status: 'processed', processedAt: new Date(), amount: refundAmount }
            });
            await tx.escrowDeal.update({
                where: { id: deal.id },
                data: { status: 'refunded', shippingStatus: 'refunded' }
            });
        });

        await sendUserNotification(null, 'Refund Processed', `Refund of ₹${refundAmount} processed for ${deal.title}.`, 'success', deal.clientId, { dealId: deal.id });
        res.json({ success: true, refundAmount });
    } catch (err) {
        console.error('Refund issue error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

export default router;
