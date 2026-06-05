import express from 'express';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { auth } from '../middleware/auth.js';
import { sendUserNotification } from './notifications.js';

const prisma = new PrismaClient();
const router = express.Router();

const MAX_SINGLE_TRANSFER = 250000;
const LARGE_TRANSFER_THRESHOLD = 10000;

const transferLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.user.id,
    message: { error: 'Too many transfer requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

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

// GET /api/wallet/receive-link - Generate a cryptographically signed payment link for the logged in user
router.get('/receive-link', auth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { username: true, shareId: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const shareId = user.shareId || user.username;
        const expires = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
        const token = crypto
            .createHmac('sha256', process.env.JWT_SECRET)
            .update(`${shareId}:${expires}`)
            .digest('hex');

        res.json({
            shareId,
            expires,
            token,
            shareUrl: `/wallet/pay/${encodeURIComponent(shareId)}?expires=${expires}&token=${token}`
        });
    } catch (err) {
        console.error('Generate receive link error:', err);
        res.status(500).json({ error: 'Failed to generate secure receive link' });
    }
});

// GET /api/wallet/recipient/:shareId - Get wallet recipient details by share ID or username
router.get('/recipient/:shareId', async (req, res) => {
    try {
        const { shareId } = req.params;
        const { expires, token } = req.query;

        if (!expires || !token) {
            return res.status(400).json({ error: 'Secure payment session required. Please scan a valid, active QR code.' });
        }

        const expiryTime = parseInt(expires);
        if (isNaN(expiryTime) || Date.now() > expiryTime) {
            return res.status(410).json({ error: 'This payment link has expired. Please ask the recipient for a new QR code.' });
        }

        // Recalculate signature to verify match
        const expectedToken = crypto
            .createHmac('sha256', process.env.JWT_SECRET)
            .update(`${shareId}:${expiryTime}`)
            .digest('hex');

        if (expectedToken !== token) {
            return res.status(403).json({ error: 'Invalid or tampered payment link.' });
        }

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
router.post('/transfer', auth, transferLimiter, async (req, res) => {
    try {
        const { shareId, amount, note, idempotencyKey, password, expires, token } = req.body;
        const transferAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

        if (!shareId || !transferAmount || transferAmount <= 0 || isNaN(transferAmount)) {
            return res.status(400).json({ error: 'Valid shareId and transfer amount are required' });
        }

        if (!password) {
            return res.status(400).json({ error: 'Confirm password is required to authorize the transfer' });
        }

        if (!expires || !token) {
            return res.status(400).json({ error: 'Secure payment session details (expiry and token) are required' });
        }

        const expiryTime = parseInt(expires);
        if (isNaN(expiryTime) || Date.now() > expiryTime) {
            return res.status(410).json({ error: 'This payment link has expired. Please request a new QR code.' });
        }

        const expectedToken = crypto
            .createHmac('sha256', process.env.JWT_SECRET)
            .update(`${shareId}:${expiryTime}`)
            .digest('hex');

        if (expectedToken !== token) {
            return res.status(403).json({ error: 'Invalid or tampered payment link.' });
        }

        if (transferAmount > MAX_SINGLE_TRANSFER) {
            return res.status(400).json({ error: `Maximum single transfer is ₹${MAX_SINGLE_TRANSFER.toLocaleString('en-IN')}` });
        }

        const decimalPlaces = (transferAmount.toString().split('.')[1] || '').length;
        if (decimalPlaces > 2) {
            return res.status(400).json({ error: 'Amount cannot have more than 2 decimal places' });
        }

        if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.length > 0) {
            const existing = await prisma.walletTransaction.findFirst({
                where: {
                    userId: req.user.id,
                    type: 'transfer',
                    metadata: { path: ['idempotencyKey'], equals: idempotencyKey }
                }
            });
            if (existing) {
                return res.status(409).json({ error: 'This transfer has already been processed' });
            }
        }

        const sender = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true, username: true, displayName: true, walletBalance: true,
                password: true, // Included password for verification
                kycStatus: true, verified: true, status: true,
                dailyTransferLimit: true, monthlyTransferLimit: true,
                dailyTransferUsed: true, monthlyTransferUsed: true,
                lastTransferResetDay: true
            }
        });

        if (!sender) {
            return res.status(404).json({ error: 'Sender not found' });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, sender.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Incorrect confirmation password. Please try again.' });
        }

        if (sender.status !== 'active') {
            return res.status(403).json({ error: 'Your account is not active' });
        }

        const recipient = await prisma.user.findFirst({
            where: {
                OR: [
                    { shareId },
                    { username: shareId }
                ]
            },
            select: {
                id: true, username: true, displayName: true, shareId: true,
                status: true, avatarUrl: true, verified: true
            }
        });

        if (!recipient) {
            return res.status(404).json({ error: 'Recipient not found' });
        }

        if (recipient.status !== 'active') {
            return res.status(400).json({ error: 'Recipient account is not active' });
        }

        if (recipient.id === sender.id) {
            return res.status(400).json({ error: 'You cannot transfer funds to yourself' });
        }

        const blocked = await prisma.blockedUser.findFirst({
            where: {
                OR: [
                    { blockerId: sender.id, blockedId: recipient.id },
                    { blockerId: recipient.id, blockedId: sender.id }
                ]
            }
        });
        if (blocked) {
            return res.status(403).json({ error: 'You cannot transfer to this user' });
        }

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let dailyUsed = sender.dailyTransferUsed;
        let monthlyUsed = sender.monthlyTransferUsed;

        if (sender.lastTransferResetDay && sender.lastTransferResetDay < todayStart) {
            dailyUsed = 0;
        }
        if (sender.lastTransferResetDay && sender.lastTransferResetDay < monthStart) {
            monthlyUsed = 0;
        }

        if (dailyUsed + transferAmount > sender.dailyTransferLimit) {
            const remaining = Math.max(0, sender.dailyTransferLimit - dailyUsed);
            return res.status(400).json({
                error: `Daily transfer limit exceeded. Remaining: ₹${remaining.toLocaleString('en-IN')}`,
                limit: sender.dailyTransferLimit,
                used: dailyUsed,
                remaining
            });
        }

        if (monthlyUsed + transferAmount > sender.monthlyTransferLimit) {
            const remaining = Math.max(0, sender.monthlyTransferLimit - monthlyUsed);
            return res.status(400).json({
                error: `Monthly transfer limit exceeded. Remaining: ₹${remaining.toLocaleString('en-IN')}`,
                limit: sender.monthlyTransferLimit,
                used: monthlyUsed,
                remaining
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const [senderRow] = await tx.$queryRaw`
                UPDATE users
                SET wallet_balance = wallet_balance - ${transferAmount}
                WHERE id = ${sender.id} AND wallet_balance >= ${transferAmount} AND status = 'active'
                RETURNING wallet_balance AS "walletBalance"
            `;

            if (!senderRow) {
                throw Object.assign(new Error('Insufficient wallet balance'), { code: 'INSUFFICIENT_BALANCE' });
            }

            const updatedRecipient = await tx.user.update({
                where: { id: recipient.id },
                data: { walletBalance: { increment: transferAmount } }
            });

            const newDailyUsed = dailyUsed + transferAmount;
            const newMonthlyUsed = monthlyUsed + transferAmount;
            const shouldResetDaily = sender.lastTransferResetDay && sender.lastTransferResetDay < todayStart;
            const shouldResetMonthly = sender.lastTransferResetDay && sender.lastTransferResetDay < monthStart;

            await tx.user.update({
                where: { id: sender.id },
                data: {
                    dailyTransferUsed: shouldResetDaily ? transferAmount : newDailyUsed,
                    monthlyTransferUsed: shouldResetMonthly ? transferAmount : newMonthlyUsed,
                    lastTransferResetDay: now
                }
            });

            const senderTransaction = await tx.walletTransaction.create({
                data: {
                    userId: sender.id,
                    type: 'transfer',
                    amount: -transferAmount,
                    balance: senderRow.walletBalance,
                    description: `Transfer to ${recipient.displayName || recipient.username}`,
                    metadata: {
                        recipientId: recipient.id,
                        shareId: recipient.shareId,
                        note: note || null,
                        idempotencyKey: idempotencyKey || null,
                        ip: req.ip || req.connection?.remoteAddress || null,
                        userAgent: req.headers['user-agent'] || null
                    }
                }
            });

            const recipientTransaction = await tx.walletTransaction.create({
                data: {
                    userId: recipient.id,
                    type: 'transfer',
                    amount: transferAmount,
                    balance: updatedRecipient.walletBalance,
                    description: `Received payment from ${sender.displayName || sender.username}`,
                    metadata: {
                        senderId: sender.id,
                        shareId: recipient.shareId,
                        note: note || null
                    }
                }
            });

            await tx.activityLog.create({
                data: {
                    userId: sender.id,
                    action: 'wallet_transfer',
                    details: JSON.stringify({
                        senderId: sender.id,
                        recipientId: recipient.id,
                        recipientUsername: recipient.username,
                        amount: transferAmount,
                        senderBalanceAfter: senderRow.walletBalance,
                        recipientBalanceAfter: updatedRecipient.walletBalance,
                        ip: req.ip || req.connection?.remoteAddress || null
                    }),
                    status: 'active'
                }
            });

            return {
                updatedSender: { walletBalance: senderRow.walletBalance },
                updatedRecipient,
                senderTransaction,
                recipientTransaction
            };
        });

        const io = req.app.get('io');
        sendUserNotification(
            io,
            recipient.id,
            'Wallet received',
            `You have received ₹${transferAmount.toFixed(2)} from ${sender.displayName || sender.username}.`,
            'success',
            { type: 'wallet_transfer', amount: transferAmount }
        );

        sendUserNotification(
            io,
            sender.id,
            'Transfer sent',
            `You sent ₹${transferAmount.toFixed(2)} to ${recipient.displayName || recipient.username}.`,
            'info',
            { type: 'wallet_transfer', amount: -transferAmount }
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
        if (err.code === 'INSUFFICIENT_BALANCE') {
            return res.status(400).json({ error: 'Insufficient wallet balance' });
        }
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
            'Payout Requested',
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
