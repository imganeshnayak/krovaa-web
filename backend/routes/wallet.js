import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { sendUserNotification } from './notifications.js';

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/wallet/balance - Get current wallet balance
router.get('/balance', auth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { walletBalance: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ balance: user.walletBalance });
    } catch (err) {
        console.error('Get wallet balance error:', err);
        res.status(500).json({ error: 'Failed to fetch wallet balance' });
    }
});

// GET /api/wallet/recipient/:shareId - Get wallet recipient details by share ID or username
router.get('/recipient/:shareId', async (req, res) => {
    try {
        const { shareId } = req.params;
        const recipient = await prisma.user.findFirst({
            where: {
                OR: [
                    { shareId },
                    { username: shareId }
                ]
            },
            select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                shareId: true,
                verified: true,
                status: true,
                razorpayContactId: true,
                phoneNumber: true
            }
        });

        if (!recipient) {
            return res.status(404).json({ error: 'Wallet recipient not found' });
        }

        res.json({ ...recipient, walletEnabled: true });
    } catch (err) {
        console.error('Get wallet recipient error:', err);
        res.status(500).json({ error: 'Failed to fetch wallet recipient' });
    }
});

// POST /api/wallet/transfer - Transfer wallet balance to another user by share ID
router.post('/transfer', auth, async (req, res) => {
    try {
        const { shareId, amount, note } = req.body;
        const transferAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

        if (!shareId || !transferAmount || transferAmount <= 0) {
            return res.status(400).json({ error: 'Valid shareId and transfer amount are required' });
        }

        const sender = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        if (!sender) {
            return res.status(404).json({ error: 'Sender not found' });
        }

        const recipient = await prisma.user.findFirst({
            where: {
                OR: [
                    { shareId },
                    { username: shareId }
                ]
            }
        });

        if (!recipient) {
            return res.status(404).json({ error: 'Recipient not found' });
        }

        if (recipient.id === sender.id) {
            return res.status(400).json({ error: 'You cannot transfer funds to yourself' });
        }

        if (sender.walletBalance < transferAmount) {
            return res.status(400).json({ error: 'Insufficient wallet balance' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const updatedSender = await tx.user.update({
                where: { id: sender.id },
                data: { walletBalance: { decrement: transferAmount } }
            });

            const updatedRecipient = await tx.user.update({
                where: { id: recipient.id },
                data: { walletBalance: { increment: transferAmount } }
            });

            const senderTransaction = await tx.walletTransaction.create({
                data: {
                    userId: sender.id,
                    type: 'transfer',
                    amount: -transferAmount,
                    balance: updatedSender.walletBalance,
                    description: `Transfer to ${recipient.displayName || recipient.username}`,
                    metadata: { recipientId: recipient.id, shareId: recipient.shareId, note: note || null }
                }
            });

            const recipientTransaction = await tx.walletTransaction.create({
                data: {
                    userId: recipient.id,
                    type: 'transfer',
                    amount: transferAmount,
                    balance: updatedRecipient.walletBalance,
                    description: `Received payment from ${sender.displayName || sender.username}`,
                    metadata: { senderId: sender.id, shareId: recipient.shareId, note: note || null }
                }
            });

            return { updatedSender, updatedRecipient, senderTransaction, recipientTransaction };
        });

        const io = req.app.get('io');
        sendUserNotification(
            io,
            recipient.id,
            '💸 Wallet received',
            `You have received ₹${transferAmount.toFixed(2)} from ${sender.displayName || sender.username}.`,
            'success',
            { type: 'wallet_transfer', amount: transferAmount }
        );

        res.json({
            success: true,
            transferReference: result.senderTransaction.id.toString(),
            amount: transferAmount,
            senderBalance: result.updatedSender.walletBalance,
            recipientBalance: result.updatedRecipient.walletBalance,
            recipient: {
                id: recipient.id,
                username: recipient.username,
                displayName: recipient.displayName,
                shareId: recipient.shareId
            }
        });
    } catch (err) {
        console.error('Wallet transfer error:', err);
        res.status(500).json({ error: 'Failed to transfer wallet balance' });
    }
});

// GET /api/wallet/transactions - Get wallet transaction history
router.get('/transactions', auth, async (req, res) => {
    try {
        const { type } = req.query;
        let where = req.user.role === 'admin' ? {} : { userId: req.user.id };

        if (type === 'sent') {
            where.amount = { lt: 0 };
        } else if (type === 'received') {
            where.type = 'escrow_release';
        } else if (type === 'added') {
            where.type = 'credit';
        }

        const transactions = await prisma.walletTransaction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 100 // Increased limit
        });
        const dealCache = new Map();
        const chatDealCache = new Map();

        const getDealById = async (dealId) => {
            if (dealCache.has(dealId)) return dealCache.get(dealId);
            const deal = await prisma.escrowDeal.findUnique({
                where: { id: dealId },
                select: {
                    id: true,
                    title: true,
                    createdAt: true,
                    status: true,
                    totalAmount: true,
                    chatId: true,
                    client: { select: { id: true, displayName: true, username: true } },
                    vendor: { select: { id: true, displayName: true, username: true } }
                }
            });
            dealCache.set(dealId, deal);
            return deal;
        };

        const parseDealIdFromReference = (reference) => {
            if (!reference || typeof reference !== 'string') return null;
            if (reference.startsWith('deal_')) return parseInt(reference.replace('deal_', ''));
            if (reference.startsWith('refund_deal_')) return parseInt(reference.replace('refund_deal_', ''));
            return null;
        };

        const enriched = await Promise.all(transactions.map(async (tx) => {
            const metadata = tx.metadata || {};
            let deal = null;
            const dealId = metadata.dealId || parseDealIdFromReference(tx.reference);

            if (dealId) {
                deal = await getDealById(dealId);
            } else if (metadata.chatId && metadata.dealTitle) {
                const cacheKey = `${metadata.chatId}_${metadata.dealTitle}`;
                if (chatDealCache.has(cacheKey)) {
                    deal = chatDealCache.get(cacheKey);
                } else {
                    deal = await prisma.escrowDeal.findFirst({
                        where: { chatId: metadata.chatId, title: metadata.dealTitle },
                        orderBy: { createdAt: 'desc' },
                        select: {
                            id: true,
                            title: true,
                            createdAt: true,
                            status: true,
                            totalAmount: true,
                            chatId: true,
                            client: { select: { id: true, displayName: true, username: true } },
                            vendor: { select: { id: true, displayName: true, username: true } }
                        }
                    });
                    chatDealCache.set(cacheKey, deal);
                }
            }

            return { ...tx, deal };
        }));

        res.json(enriched);
    } catch (err) {
        console.error('Get wallet transactions error:', err);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// POST /api/wallet/payout/request - Create payout request
router.post('/payout/request', auth, async (req, res) => {
    try {
        const { amount, paymentMethod = 'bank', bankAccount, ifscCode, accountName, upiVpa, phoneNumber, email } = req.body;

        if (!amount || amount < 500) {
            return res.status(400).json({ error: 'Minimum payout amount is ₹500' });
        }

        if (!accountName) {
            return res.status(400).json({ error: 'Account holder name is required' });
        }

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required for admin contact' });
        }

        // Validate based on payment method
        if (paymentMethod === 'bank' && (!bankAccount || !ifscCode)) {
            return res.status(400).json({ error: 'Bank account and IFSC code are required for bank transfers' });
        }

        if (paymentMethod === 'upi' && (!upiVpa || !upiVpa.includes('@'))) {
            return res.status(400).json({ error: 'Valid UPI ID is required' });
        }

        // Check wallet balance
        const user = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        if (user.walletBalance < amount) {
            return res.status(400).json({ error: 'Insufficient wallet balance' });
        }

        // Start transaction
        const result = await prisma.$transaction(async (prisma) => {
            // Debit wallet
            const updatedUser = await prisma.user.update({
                where: { id: req.user.id },
                data: { walletBalance: { decrement: amount } }
            });

            // Log transaction
            await prisma.walletTransaction.create({
                data: {
                    userId: req.user.id,
                    type: 'payout',
                    amount: -amount,
                    balance: updatedUser.walletBalance,
                    description: `Payout Request via ${paymentMethod === 'upi' ? 'UPI' : 'Bank'}`,
                }
            });

            // Create request
            const payoutRequest = await prisma.payoutRequest.create({
                data: {
                    userId: req.user.id,
                    amount: parseFloat(amount),
                    paymentMethod,
                    bankAccount: paymentMethod === 'bank' ? bankAccount : null,
                    ifscCode: paymentMethod === 'bank' ? ifscCode : null,
                    accountName,
                    upiVpa: paymentMethod === 'upi' ? upiVpa : null,
                    status: 'pending',
                    phoneNumber,
                    email,
                    adminNote: phoneNumber ? `Contact: ${phoneNumber}${email ? ` | Email: ${email}` : ''}` : null
                }
            });

            return payoutRequest;
        });

        const io = req.app.get('io');
        sendUserNotification(
            io,
            req.user.id,
            '💸 Payout Requested',
            `Your payout request for ₹${amount.toLocaleString('en-IN')} has been submitted. It will be processed within 24-48 business hours.`,
            'info',
            { type: 'wallet' }
        );

        res.json(result);
    } catch (err) {
        console.error('Create payout request error:', err);
        res.status(500).json({ error: 'Failed to create payout request' });
    }
});

// GET /api/wallet/payout/requests - Get user's payout requests
router.get('/payout/requests', auth, async (req, res) => {
    try {
        const where = req.user.role === 'admin' ? {} : { userId: req.user.id };
        const requests = await prisma.payoutRequest.findMany({
            where,
            include: { user: { select: { username: true, displayName: true } } },
            orderBy: { requestedAt: 'desc' }
        });

        res.json(requests);
    } catch (err) {
        console.error('Get payout requests error:', err);
        res.status(500).json({ error: 'Failed to fetch payout requests' });
    }
});

export default router;
