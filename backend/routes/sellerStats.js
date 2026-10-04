import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import {
    getPlatformFeePercent,
    sumRecordedPlatformFee,
    computeSellerPayout,
    computeSellerFeeLine,
} from '../utils/fees.js';
import { roundMoney } from '../utils/money.js';
import { toAmount } from '../utils/decimalJson.js';

const prisma = new PrismaClient();
const router = express.Router();

router.get('/', auth, async (req, res) => {
    try {
        const vendorId = req.user.id;

        // 1. Get platform fee percent (fallback only for legacy deals without a recorded fee)
        const platformFeePercent = await getPlatformFeePercent(prisma);

        // 2. Fetch all deals for this seller
        const deals = await prisma.escrowDeal.findMany({
            where: { vendorId },
            include: {
                client: { select: { displayName: true, username: true } },
                transactions: true
            },
            orderBy: { createdAt: 'desc' }
        });

        // 3. Compute calculations
        const totalSalesCount = deals.length;

        let pendingEscrowBalance = 0;
        let releasedEarningsBalance = 0;

        deals.forEach(deal => {
            if (deal.status === 'active' && deal.paymentStatus === 'paid') {
                pendingEscrowBalance += deal.totalAmount;
            } else if (deal.status === 'released' || deal.status === 'completed') {
                // Actual payouts only — a 40%-released deal must not count as fully earned.
                releasedEarningsBalance += computeSellerPayout({
                    grossAmount: deal.totalAmount,
                    recordedFee: sumRecordedPlatformFee(deal.transactions),
                    platformFeePercent,
                    paymentStatus: deal.paymentStatus,
                    releasedPercent: deal.releasedPercent,
                    transactions: deal.transactions,
                });
            }
        });

        // 4. Formulate the list of sales history
        const salesHistory = deals.map(deal => {
            const recordedFee = sumRecordedPlatformFee(deal.transactions);
            // Report the fee that was actually charged, not today's configured rate.
            const { gross, fee } = computeSellerFeeLine({
                grossAmount: deal.totalAmount,
                recordedFee,
                platformFeePercent,
                paymentStatus: deal.paymentStatus,
                transactions: deal.transactions,
            });
            const shippingFee = toAmount(deal.shippingFee);
            const netPayout = computeSellerPayout({
                grossAmount: deal.totalAmount,
                recordedFee,
                platformFeePercent,
                paymentStatus: deal.paymentStatus,
                releasedPercent: deal.releasedPercent,
                transactions: deal.transactions,
            });
            return {
                id: deal.id,
                title: deal.title,
                buyerName: deal.client.displayName || deal.client.username,
                createdAt: deal.createdAt,
                status: deal.status,
                shippingStatus: deal.shippingStatus,
                grossAmount: gross,
                shippingFee,
                productValue: roundMoney(gross - shippingFee),
                platformFee: fee,
                netPayout,
                releasedPercent: deal.releasedPercent
            };
        });

        res.json({
            totalSalesCount,
            pendingEscrowBalance: roundBalance(pendingEscrowBalance),
            releasedEarningsBalance: roundBalance(releasedEarningsBalance),
            platformRevenue: roundBalance(salesHistory.reduce((sum, s) => sum + s.platformFee, 0)),
            salesHistory
        });
    } catch (err) {
        console.error('Get seller stats error:', err);
        res.status(500).json({ error: 'Failed to retrieve stats.' });
    }
});

function roundBalance(value) {
    return Math.round(value * 100) / 100;
}


export default router;
