import express from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

/**
 * Verify Razorpay webhook signature
 */
function verifyWebhookSignature(rawBody, signature, secret) {
    if (!rawBody) return false;
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

    return signature === expectedSignature;
}

/**
 * POST /webhooks/razorpay/payout - Razorpay payout webhook
 * Handles payout status updates from Razorpay
 */
router.post('/razorpay/payout', async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        // Verify signature if webhook secret is configured
        if (webhookSecret && signature) {
            const isValid = verifyWebhookSignature(req.rawBody, signature, webhookSecret);
            if (!isValid) {
                console.log('⚠️  Invalid webhook signature');
                return res.status(400).json({ error: 'Invalid signature' });
            }
        } else if (!webhookSecret) {
            console.log('⚠️  Webhook secret not configured, skipping signature verification');
        }

        const event = req.body;
        const eventType = event.event;

        console.log(`\n📨 Received Razorpay webhook: ${eventType}`);

        // Handle different payout events
        switch (eventType) {
            case 'payout.processed':
                await handlePayoutProcessed(event.payload.payout.entity);
                break;

            case 'payout.reversed':
            case 'payout.failed':
                await handlePayoutFailed(event.payload.payout.entity);
                break;

            case 'payout.queued':
            case 'payout.pending':
                await handlePayoutPending(event.payload.payout.entity);
                break;

            case 'payout.rejected':
                await handlePayoutRejected(event.payload.payout.entity);
                break;

            default:
                console.log(`ℹ️  Unhandled event type: ${eventType}`);
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * Handle payout processed (successful)
 */
async function handlePayoutProcessed(payout) {
    const razorpayPayoutId = payout.id;
    const utr = payout.utr;

    console.log(`✅ Payout processed: ${razorpayPayoutId}`);
    console.log(`   UTR: ${utr}`);
    console.log(`   Amount: ₹${payout.amount / 100}`);

    try {
        const payoutRequest = await prisma.payoutRequest.findFirst({
            where: { razorpayPayoutId }
        });

        if (!payoutRequest) {
            console.log(`⚠️  Payout request not found for Razorpay ID: ${razorpayPayoutId}`);
            return;
        }

        await prisma.payoutRequest.update({
            where: { id: payoutRequest.id },
            data: {
                status: 'completed',
                processedAt: new Date(),
                adminNote: `Payout completed successfully. UTR: ${utr}`
            }
        });

        console.log(`💾 Updated payout request #${payoutRequest.id} to completed`);
    } catch (err) {
        console.error('Error handling payout processed:', err);
    }
}

/**
 * Handle payout failed or reversed
 */
async function handlePayoutFailed(payout) {
    const razorpayPayoutId = payout.id;
    const failureReason = payout.failure_reason || payout.status_details?.reason || 'Unknown reason';

    console.log(`❌ Payout failed: ${razorpayPayoutId}`);
    console.log(`   Reason: ${failureReason}`);

    try {
        const payoutRequest = await prisma.payoutRequest.findFirst({
            where: { razorpayPayoutId }
        });

        if (!payoutRequest) {
            console.log(`⚠️  Payout request not found for Razorpay ID: ${razorpayPayoutId}`);
            return;
        }

        // Refund to wallet
        await prisma.$transaction(async (prisma) => {
            // Update payout status
            await prisma.payoutRequest.update({
                where: { id: payoutRequest.id },
                data: {
                    status: 'failed',
                    processedAt: new Date(),
                    adminNote: `Payout failed: ${failureReason}`
                }
            });

            // Refund to wallet
            const user = await prisma.user.update({
                where: { id: payoutRequest.userId },
                data: {
                    walletBalance: {
                        increment: payoutRequest.amount
                    }
                }
            });

            // Create wallet transaction
            await prisma.walletTransaction.create({
                data: {
                    userId: payoutRequest.userId,
                    type: 'credit',
                    amount: payoutRequest.amount,
                    balance: user.walletBalance,
                    reference: `payout_refund_${payoutRequest.id}`,
                    description: `Payout failed - Refunded to wallet. Reason: ${failureReason}`
                }
            });
        });

        console.log(`🔄 Refunded ₹${payoutRequest.amount} to user ${payoutRequest.userId}'s wallet`);
    } catch (err) {
        console.error('Error handling payout failed:', err);
    }
}

/**
 * Handle payout pending/queued
 */
async function handlePayoutPending(payout) {
    const razorpayPayoutId = payout.id;

    console.log(`⏳ Payout pending: ${razorpayPayoutId}`);

    try {
        const payoutRequest = await prisma.payoutRequest.findFirst({
            where: { razorpayPayoutId }
        });

        if (!payoutRequest) {
            return;
        }

        await prisma.payoutRequest.update({
            where: { id: payoutRequest.id },
            data: {
                adminNote: `Payout is being processed by Razorpay. Status: ${payout.status}`
            }
        });
    } catch (err) {
        console.error('Error handling payout pending:', err);
    }
}

/**
 * Handle payout rejected
 */
async function handlePayoutRejected(payout) {
    const razorpayPayoutId = payout.id;
    const failureReason = payout.failure_reason || 'Invalid  bank details or insufficient balance';

    console.log(`🚫 Payout rejected: ${razorpayPayoutId}`);
    console.log(`   Reason: ${failureReason}`);

    // Treat same as failed - refund to wallet
    await handlePayoutFailed(payout);
}

/**
 * POST /webhooks/shiprocket - Shiprocket Tracking Webhook
 * Handles real-time shipping updates from Shiprocket
 */
router.post('/shiprocket', async (req, res) => {
    try {
        const { awb, current_status, scans, shipment_id } = req.body;
        console.log(`\n📨 Received Shiprocket webhook for AWB: ${awb}, Status: ${current_status}`);

        if (!awb || !current_status) {
            return res.status(400).json({ error: 'Invalid payload' });
        }

        const deal = await prisma.escrowDeal.findFirst({
            where: { shiprocketAwbCode: awb }
        });

        if (!deal) {
            console.log(`⚠️  No deal found for AWB: ${awb}`);
            return res.status(200).json({ received: true });
        }

        const newEvent = {
            status: current_status.toLowerCase().replace(/ /g, '_'),
            title: current_status,
            description: scans && scans.length > 0 ? scans[0].activity : `Status updated to ${current_status}`,
            timestamp: new Date().toISOString()
        };

        const existingEvents = deal.shippingEvents ? (Array.isArray(deal.shippingEvents) ? deal.shippingEvents : JSON.parse(deal.shippingEvents)) : [];
        const updatedEvents = [...existingEvents, newEvent];

        let internalStatus = deal.shippingStatus;

        // Map Shiprocket status to our internal status
        const statusMap = {
            'delivered': 'delivered',
            'rto delivered': 'rto',
            'rto initiated': 'rto',
            'shipped': 'in_transit',
            'in transit': 'in_transit',
            'out for delivery': 'out_for_delivery'
        };

        const lowerStatus = current_status.toLowerCase();
        if (statusMap[lowerStatus]) {
            internalStatus = statusMap[lowerStatus];
        }

        const updatedDeal = await prisma.escrowDeal.update({
            where: { id: deal.id },
            data: {
                shippingStatus: internalStatus,
                shippingEvents: updatedEvents
            }
        });

        // If delivered, send notification
        if (internalStatus === 'delivered' && deal.shippingStatus !== 'delivered') {
            const io = req.app.get('io');
            if (io) {
                io.to(deal.chatId).emit('escrowUpdate', updatedDeal);
                io.to(`user_${deal.clientId}`).emit('escrowUpdate', updatedDeal);
                io.to(`user_${deal.vendorId}`).emit('escrowUpdate', updatedDeal);
            }
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Shiprocket webhook error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
