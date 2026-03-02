import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { createOrder, verifyPaymentSignature, fetchPayment } from '../config/razorpay.js';
import { sendUserNotification } from './notifications.js';

const prisma = new PrismaClient();
const router = express.Router();

// POST /api/payments/escrow/initiate - Create Razorpay order for escrow deposit
router.post('/escrow/initiate', auth, async (req, res) => {
    try {
        const { dealId } = req.body;

        if (!dealId) {
            return res.status(400).json({ error: 'Deal ID is required.' });
        }

        const deal = await prisma.escrowDeal.findUnique({
            where: { id: parseInt(dealId) }
        });

        if (!deal) {
            return res.status(404).json({ error: 'Escrow deal not found.' });
        }

        // Verify user is the client
        if (deal.clientId !== req.user.id) {
            return res.status(403).json({ error: 'Only the client can pay for this deal.' });
        }

        // Check if already paid
        if (deal.paymentStatus === 'paid') {
            return res.status(400).json({ error: 'Payment already completed for this deal.' });
        }

        // Create Razorpay order using paidAmount (gross) if available, otherwise totalAmount
        const paymentAmount = deal.paidAmount > 0 ? deal.paidAmount : deal.totalAmount;

        const order = await createOrder(
            paymentAmount,
            'INR',
            {
                type: 'escrow',
                dealId: deal.id,
                clientId: req.user.id,
                vendorId: deal.vendorId
            }
        );

        // Update deal with order ID
        await prisma.escrowDeal.update({
            where: { id: deal.id },
            data: { razorpayOrderId: order.id }
        });

        // Log payment creation
        await prisma.paymentLog.create({
            data: {
                type: 'escrow',
                entityId: deal.id,
                razorpayOrderId: order.id,
                amount: paymentAmount,
                currency: 'INR',
                status: 'created',
                metadata: { orderId: order.id }
            }
        });

        res.json({
            orderId: order.id,
            amount: order.amount, // in paise
            currency: order.currency,
            key_id: process.env.RAZORPAY_KEY_ID,
            dealId: deal.id,
            title: deal.title
        });
    } catch (err) {
        console.error('Initiate escrow payment error:', err);
        res.status(500).json({ error: 'Failed to initiate payment.' });
    }
});

// POST /api/payments/wallet/initiate - Create Razorpay order for wallet top-up
router.post('/wallet/initiate', auth, async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount < 1) {
            return res.status(400).json({ error: 'Minimum amount is ₹1' });
        }

        // Create Razorpay order
        const order = await createOrder(
            amount,
            'INR',
            {
                type: 'wallet',
                userId: req.user.id
            }
        );

        // Log payment creation
        await prisma.paymentLog.create({
            data: {
                type: 'wallet',
                entityId: req.user.id,
                razorpayOrderId: order.id,
                amount: parseFloat(amount),
                currency: 'INR',
                status: 'created',
                metadata: { orderId: order.id }
            }
        });

        res.json({
            orderId: order.id,
            amount: order.amount, // in paise
            currency: order.currency,
            key_id: process.env.RAZORPAY_KEY_ID
        });
    } catch (err) {
        console.error('Initiate wallet payment error:', err);
        res.status(500).json({ error: 'Failed to initiate wallet top-up.' });
    }
});

router.post('/verification/initiate', auth, async (req, res) => {
    try {
        let VERIFICATION_FEE = 109; // Default
        const setting = await prisma.systemSetting.findUnique({ where: { key: 'verification_fee' } });
        if (setting) VERIFICATION_FEE = parseFloat(setting.value);

        // Check if user already verified
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { verified: true }
        });

        if (user?.verified) {
            return res.status(400).json({ error: 'You are already verified.' });
        }

        // Check for existing pending request
        let verificationRequest = await prisma.verificationRequest.findFirst({
            where: {
                userId: req.user.id,
                status: 'pending_payment'
            }
        });

        // Create new request if none exists
        if (!verificationRequest) {
            verificationRequest = await prisma.verificationRequest.create({
                data: {
                    userId: req.user.id,
                    paymentAmount: VERIFICATION_FEE,
                    status: 'pending_payment',
                    paymentStatus: 'pending'
                }
            });
        } else {
            // Update existing request with current fee
            verificationRequest = await prisma.verificationRequest.update({
                where: { id: verificationRequest.id },
                data: { paymentAmount: VERIFICATION_FEE }
            });
        }

        // Create Razorpay order
        const order = await createOrder(
            VERIFICATION_FEE,
            'INR',
            {
                type: 'verification',
                requestId: verificationRequest.id,
                userId: req.user.id
            }
        );

        // Update request with order ID
        await prisma.verificationRequest.update({
            where: { id: verificationRequest.id },
            data: { razorpayOrderId: order.id }
        });

        // Log payment creation
        await prisma.paymentLog.create({
            data: {
                type: 'verification',
                entityId: verificationRequest.id,
                razorpayOrderId: order.id,
                amount: VERIFICATION_FEE,
                currency: 'INR',
                status: 'created',
                metadata: { orderId: order.id }
            }
        });

        res.json({
            orderId: order.id,
            amount: order.amount, // in paise
            currency: order.currency,
            key_id: process.env.RAZORPAY_KEY_ID,
            requestId: verificationRequest.id
        });
    } catch (err) {
        console.error('Initiate verification payment error:', err);
        res.status(500).json({ error: 'Failed to initiate payment.' });
    }
});

// POST /api/payments/verify - Verify payment after checkout
router.post('/verify', auth, async (req, res) => {
    try {
        const { orderId, paymentId, signature, type, entityId } = req.body;

        if (!orderId || !paymentId || !signature || !type || !entityId) {
            return res.status(400).json({ error: 'Missing required fields.' });
        }

        // Verify signature
        const isValid = verifyPaymentSignature(orderId, paymentId, signature);

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid payment signature.' });
        }

        // Fetch payment details from Razorpay
        const payment = await fetchPayment(paymentId);

        if (payment.status !== 'captured' && payment.status !== 'authorized') {
            return res.status(400).json({ error: 'Payment not successful.' });
        }

        // Check if this payment has already been processed (prevent duplicates)
        let amount = 0;
        try {
            await prisma.$transaction(async (tx) => {
                const numericEntityId = parseInt(entityId);

                // 1. Fetch the relevant entity to get the amount
                if (type === 'escrow') {
                    const deal = await tx.escrowDeal.findUnique({ where: { id: numericEntityId } });
                    if (!deal) throw new Error('Escrow deal not found');
                    if (deal.clientId !== req.user.id) throw new Error('Unauthorized');
                    amount = deal.paidAmount > 0 ? deal.paidAmount : deal.totalAmount;
                } else if (type === 'verification') {
                    const verificationRequest = await tx.verificationRequest.findUnique({ where: { id: numericEntityId } });
                    if (!verificationRequest) throw new Error('Verification request not found');
                    if (verificationRequest.userId !== req.user.id) throw new Error('Unauthorized');
                    amount = verificationRequest.paymentAmount;
                } else if (type === 'wallet') {
                    const originalAmount = parseFloat(payment.amount) / 100;
                    const fee = originalAmount * 0.02;
                    const gst = fee * 0.18;
                    amount = originalAmount - fee - gst; // Net credit amount
                } else {
                    throw new Error('Invalid payment type');
                }

                // 2. Create the PaymentLog
                await tx.paymentLog.create({
                    data: {
                        type,
                        entityId: numericEntityId,
                        razorpayOrderId: orderId,
                        razorpayPaymentId: paymentId,
                        amount,
                        currency: 'INR',
                        status: 'paid',
                        metadata: payment
                    }
                });

                // 3. Update the entity and log activity
                if (type === 'escrow') {
                    const deal = await tx.escrowDeal.findUnique({ where: { id: numericEntityId } });
                    await tx.escrowDeal.update({
                        where: { id: numericEntityId },
                        data: {
                            razorpayPaymentId: paymentId,
                            paymentStatus: 'paid',
                            paidAmount: amount, // Store the gross amount paid
                            status: 'active'
                        }
                    });

                    // Record platform fee transaction for accounting
                    let platformFeePercent = 0.10; // Default
                    const feeSetting = await tx.systemSetting.findUnique({ where: { key: 'platform_fee_percent' } });
                    if (feeSetting) platformFeePercent = parseFloat(feeSetting.value);
                    const feeAmount = deal.totalAmount * platformFeePercent;

                    if (feeAmount > 0) {
                        await tx.escrowTransaction.create({
                            data: {
                                dealId: numericEntityId,
                                percent: 0,
                                amount: feeAmount,
                                note: 'platform_fee'
                            }
                        });
                    }

                    await tx.activityLog.create({
                        data: {
                            userId: req.user.id,
                            action: 'Paid for escrow deal',
                            details: `₹${amount} - ${deal.title}`
                        }
                    });

                    const io = req.app.get('io');
                    sendUserNotification(io, req.user.id, '✅ Payment Successful', `Your payment of ₹${amount.toLocaleString('en-IN')} for "${deal.title}" was successful.`, 'success', { type: 'escrow', dealId: deal.id, chatId: deal.chatId });
                    sendUserNotification(io, deal.vendorId, '💰 Payment Received', `A client paid ₹${amount.toLocaleString('en-IN')} for the deal "${deal.title}".`, 'success', { type: 'escrow', dealId: deal.id, chatId: deal.chatId });

                    const systemMessage = await tx.message.create({
                        data: {
                            senderId: req.user.id,
                            receiverId: deal.vendorId,
                            chatId: deal.chatId,
                            content: `✅ Escrow Payment Confirmed: ₹${deal.totalAmount.toLocaleString('en-IN')} for "${deal.title}". The deal is now active.`,
                            messageType: 'escrow_payment'
                        },
                        include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } }
                    });

                    if (io) {
                        const socketResult = {
                            ...systemMessage,
                            sender_name: systemMessage.sender.displayName,
                            sender_avatar: systemMessage.sender.avatarUrl,
                            sender_username: systemMessage.sender.username,
                        };
                        io.to(deal.chatId).emit('newMessage', socketResult);
                        io.to(`user_${deal.vendorId}`).emit('newMessage', socketResult);
                    }

                } else if (type === 'verification') {
                    await tx.verificationRequest.update({
                        where: { id: numericEntityId },
                        data: {
                            razorpayPaymentId: paymentId,
                            paymentStatus: 'paid',
                            status: 'pending'
                        }
                    });

                    await tx.activityLog.create({
                        data: {
                            userId: req.user.id,
                            action: 'Paid for verification',
                            details: `₹${amount}`
                        }
                    });

                    const io = req.app.get('io');
                    sendUserNotification(io, req.user.id, '🛡️ Verification Payment Received', `We received your payment for verification. Our team will review your account shortly.`, 'success', { type: 'wallet' });
                } else if (type === 'wallet') {
                    await tx.user.update({
                        where: { id: req.user.id },
                        data: { walletBalance: { increment: amount } }
                    });

                    const updatedUser = await tx.user.findUnique({
                        where: { id: req.user.id }
                    });

                    await tx.walletTransaction.create({
                        data: {
                            userId: req.user.id,
                            type: 'credit',
                            amount: amount,
                            balance: updatedUser.walletBalance,
                            reference: paymentId,
                            description: `Wallet Top-up via Razorpay (Net: ₹${amount.toFixed(2)})`
                        }
                    });

                    await tx.activityLog.create({
                        data: {
                            userId: req.user.id,
                            action: 'Wallet top-up',
                            details: `₹${amount}`
                        }
                    });

                    const io = req.app.get('io');
                    sendUserNotification(io, req.user.id, '💰 Wallet Credited', `₹${amount.toLocaleString('en-IN')} added to wallet.`, 'success', { type: 'wallet' });
                }
            });

            return res.json({ message: 'Payment verified successfully.', amount: amount });
        } catch (err) {
            if (err.code === 'P2002') return res.json({ message: 'Payment already processed.', status: 'already_processed' });
            throw err;
        }
    } catch (err) {
        console.error('Verify payment error:', err);
        res.status(500).json({ error: 'Failed to verify payment.' });
    }
});

// POST /api/payments/webhook - Handle Razorpay webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const event = req.body;
        if (event.event === 'payment.captured') {
            const paymentEntity = event.payload.payment.entity;
            const orderId = paymentEntity.order_id;
            const paymentId = paymentEntity.id;

            try {
                const result = await prisma.$transaction(async (tx) => {
                    const deal = await tx.escrowDeal.findFirst({ where: { razorpayOrderId: orderId } });
                    const verificationRequest = await tx.verificationRequest.findFirst({ where: { razorpayOrderId: orderId } });

                    if (!deal && !verificationRequest) {
                        if (paymentEntity.notes && paymentEntity.notes.type === 'wallet') {
                            const userId = parseInt(paymentEntity.notes.userId);
                            const originalAmount = paymentEntity.amount / 100;
                            const fee = originalAmount * 0.02;
                            const gst = fee * 0.18;
                            const amount = originalAmount - fee - gst;

                            await tx.paymentLog.create({
                                data: {
                                    type: 'wallet',
                                    entityId: userId,
                                    razorpayOrderId: orderId,
                                    razorpayPaymentId: paymentId,
                                    amount: amount,
                                    currency: 'INR',
                                    status: 'paid',
                                    eventType: 'payment.captured',
                                    metadata: paymentEntity
                                }
                            });

                            await tx.user.update({
                                where: { id: userId },
                                data: { walletBalance: { increment: amount } }
                            });

                            const updatedUser = await tx.user.findUnique({
                                where: { id: userId }
                            });

                            await tx.walletTransaction.create({
                                data: {
                                    userId: userId,
                                    type: 'credit',
                                    amount: amount,
                                    balance: updatedUser.walletBalance,
                                    reference: paymentId,
                                    description: `Wallet Top-up via Razorpay (Webhook, Net: ₹${amount.toFixed(2)})`
                                }
                            });
                            return { type: 'wallet', userId, amount };
                        }
                        return null;
                    }

                    await tx.paymentLog.create({
                        data: {
                            type: deal ? 'escrow' : 'verification',
                            entityId: deal ? deal.id : verificationRequest.id,
                            razorpayOrderId: orderId,
                            razorpayPaymentId: paymentId,
                            amount: deal ? deal.totalAmount : verificationRequest.paymentAmount,
                            currency: 'INR',
                            status: 'paid',
                            eventType: 'payment.captured',
                            metadata: paymentEntity
                        }
                    });

                    if (deal) {
                        await tx.escrowDeal.update({
                            where: { id: deal.id },
                            data: { razorpayPaymentId: paymentId, paymentStatus: 'paid', paidAmount: deal.totalAmount, status: 'active' }
                        });
                        // Record platform fee transaction for accounting
                        let platformFeePercent = 0.10; // Default
                        const feeSetting = await tx.systemSetting.findUnique({ where: { key: 'platform_fee_percent' } });
                        if (feeSetting) platformFeePercent = parseFloat(feeSetting.value);
                        const feeAmount = deal.totalAmount * platformFeePercent;

                        if (feeAmount > 0) {
                            await tx.escrowTransaction.create({
                                data: {
                                    dealId: deal.id,
                                    percent: 0,
                                    amount: feeAmount,
                                    note: 'platform_fee'
                                }
                            });
                        }

                        return { type: 'escrow', deal };
                    } else if (verificationRequest) {
                        await tx.verificationRequest.update({
                            where: { id: verificationRequest.id },
                            data: { razorpayPaymentId: paymentId, paymentStatus: 'paid', status: 'pending' }
                        });
                        return { type: 'verification', request: verificationRequest };
                    }
                });

                if (result) {
                    const io = req.app.get('io');
                    if (result.type === 'escrow') {
                        const deal = result.deal;
                        sendUserNotification(io, deal.clientId, '✅ Payment Successful', `Payment for "${deal.title}" received.`, 'success', { type: 'escrow', dealId: deal.id, chatId: deal.chatId });
                        sendUserNotification(io, deal.vendorId, '💰 Payment Received', `Payment for "${deal.title}" received.`, 'success', { type: 'escrow', dealId: deal.id, chatId: deal.chatId });
                    } else if (result.type === 'verification') {
                        sendUserNotification(io, result.request.userId, '🛡️ Verification Payment Received', `Payment received.`, 'success', { type: 'wallet' });
                    } else if (result.type === 'wallet') {
                        sendUserNotification(io, result.userId, '💰 Wallet Credited', `₹${result.amount.toLocaleString('en-IN')} added to wallet.`, 'success', { type: 'wallet' });
                    }
                }
            } catch (err) {
                if (err.code === 'P2002') return res.json({ status: 'already_processed' });
                throw err;
            }
        } else if (event.event === 'payment.failed') {
            const paymentEntity = event.payload.payment.entity;
            const orderId = paymentEntity.order_id;
            await prisma.paymentLog.create({
                data: { type: 'unknown', entityId: 0, razorpayOrderId: orderId, amount: paymentEntity.amount / 100, currency: paymentEntity.currency, status: 'failed', eventType: 'payment.failed', metadata: paymentEntity }
            });
            const io = req.app.get('io');
            const deal = await prisma.escrowDeal.findFirst({ where: { razorpayOrderId: orderId } });
            if (deal) sendUserNotification(io, deal.clientId, '❌ Payment Failed', `Payment for "${deal.title}" failed.`, 'alert', { type: 'escrow', dealId: deal.id, chatId: deal.chatId });
        }
        res.json({ status: 'ok' });
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).json({ error: 'Webhook failed.' });
    }
});

export default router;
