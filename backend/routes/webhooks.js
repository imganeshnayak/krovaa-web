import express from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { sendOrderTrackingUpdateEmail } from '../services/emailService.js';
import { verifyWebhookSignature as verifyDeliveryWebhook, isNdrStatus } from '../utils/webhookSecurity.js';

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
 * POST /webhooks/delivery-updates - ShipRocket Tracking Webhook
 * Receives real-time shipping status updates from ShipRocket
 * 
 * Security: verifies X-Shiprocket-Signature header (per checklist)
 * Notifications: emits socket events for ALL status transitions
 */
router.post('/delivery-updates', async (req, res) => {
    try {
        // ─── Signature verification ───────────────────────────────────────────
        // This endpoint is a money trigger: a forged "Delivered" status makes a
        // deal eligible for the 3-day auto-release payout. Verification must
        // therefore fail closed rather than degrade when unconfigured.
        const isProduction = process.env.NODE_ENV === 'production';
        const verification = verifyDeliveryWebhook({
            rawBody: req.rawBody ?? JSON.stringify(req.body ?? {}),
            signature: req.get('x-shiprocket-signature') || req.get('x-shiprocket-hmac-sha256'),
            secret: process.env.SHIPROCKET_WEBHOOK_SECRET,
            headerName: 'x-shiprocket-signature',
            isProduction,
        });

        if (verification.warning) {
            console.warn(`⚠️  ShipRocket webhook: ${verification.warning}. ` +
                'Set SHIPROCKET_WEBHOOK_SECRET to the value configured in the ShipRocket dashboard.');
        }
        if (!verification.ok) {
            console.warn(`⚠️  ShipRocket webhook REJECTED: ${verification.reason}`);
            return res.status(401).json({ error: verification.reason });
        }

        const { awb, current_status, scans, shipment_id, courier_name } = req.body;

        console.log(`\n📦 ShipRocket webhook | AWB: ${awb} | Status: ${current_status}`);

        if (!awb || !current_status) {
            return res.status(400).json({ error: 'Invalid payload: missing awb or current_status' });
        }

        // Find the deal by AWB code
        const deal = await prisma.escrowDeal.findFirst({
            where: { shiprocketAwbCode: awb },
            include: {
                client: { select: { id: true, displayName: true } },
                vendor: { select: { id: true, displayName: true } }
            }
        });

        if (!deal) {
            console.log(`⚠️  ShipRocket webhook: no deal found for AWB: ${awb}`);
            return res.status(200).json({ received: true }); // Always 200 to ShipRocket
        }

        // Build the new tracking event
        const latestScan = scans && scans.length > 0 ? scans[0] : null;
        const newEvent = {
            status: current_status.toLowerCase().replace(/[\s\/]+/g, '_'),
            title: current_status,
            description: latestScan?.activity || `Status updated to: ${current_status}`,
            location: latestScan?.location || '',
            timestamp: latestScan?.date ? new Date(latestScan.date).toISOString() : new Date().toISOString(),
            courier: courier_name || ''
        };

        // Append to existing events list
        const existingEvents = Array.isArray(deal.shippingEvents) 
            ? deal.shippingEvents 
            : (deal.shippingEvents ? JSON.parse(deal.shippingEvents) : []);
        const updatedEvents = [...existingEvents, newEvent];

        // Map ShipRocket status → our internal status
        const STATUS_MAP = {
            'delivered':        'delivered',
            'rto delivered':    'rto',
            'rto initiated':    'rto',
            'rto in transit':   'rto',
            'return initiated':  'rto',
            'out for delivery': 'out_for_delivery',
            'picked up':        'in_transit',
            'shipped':          'in_transit',
            'in transit':       'in_transit',
            'reached at destination hub': 'in_transit',
            'reached at hub':   'in_transit',
            'pickup scheduled': 'pickup_scheduled',
            'pickup generated': 'pickup_scheduled',
            'cancellation requested': 'cancelled',
            'cancelled':        'cancelled',
            // Non-delivery reports. Without these, a failed delivery attempt
            // fell through to the previous status, so the buyer was never told
            // their parcel bounced and the order silently aged into RTO.
            'ndr':              'ndr',
            'not delivered':    'ndr',
            'delivery failed':  'ndr',
            'failed delivery attempt': 'ndr',
            'undelivered':      'ndr',
            'address validation failed': 'ndr',
            'address invalid':  'ndr',
            'customer not available': 'ndr',
            'recipient not available': 'ndr',
            'address incomplete': 'ndr',
            'incorrect address': 'ndr',
        };

        const lowerStatus = current_status.toLowerCase();
        // An unrecognised status that is a known NDR phrase still counts as an
        // NDR, so new courier wording cannot silently bypass alerting.
        const internalStatus = STATUS_MAP[lowerStatus]
            || (isNdrStatus(current_status) ? 'ndr' : (deal.shippingStatus || 'in_transit'));
        const statusChanged = internalStatus !== deal.shippingStatus;

        // Update deal in DB
        const updatedDeal = await prisma.escrowDeal.update({
            where: { id: deal.id },
            data: {
                shippingStatus: internalStatus,
                shippingEvents: updatedEvents
            }
        });

        const io = req.app.get('io');

        // ─── Emit socket updates for ALL status changes ───────────────────────
        if (statusChanged) {
            // Build chat system message per status
            const trackUrl = `https://shiprocket.co/tracking/${deal.trackingId || awb}`;
            const chatMessages = {
                'in_transit': `🚚 *Shipping Update:* Your package for "${deal.title}" is in transit. Track here: ${trackUrl}`,
                'out_for_delivery': `🚴 *Shipping Update:* Your package for "${deal.title}" is out for delivery today! Track here: ${trackUrl}`,
                'delivered': `✅ *Shipping Update:* Your package for "${deal.title}" has been delivered! Awaiting buyer confirmation. Track here: ${trackUrl}`,
                'rto': `↩️ *Shipping Update:* Package return (RTO) initiated for "${deal.title}". Track here: ${trackUrl}`,
                // NDR is the highest-leverage moment in the whole delivery
                // journey: most failed parcels are recoverable if the buyer
                // fixes the address or answers the call within 24-48 hours.
                'ndr': `⚠️ *Delivery attempt failed* for "${deal.title}"${latestScan?.activity ? ` (${latestScan.activity})` : ''}.\n\nPlease update your delivery address or call the courier to reschedule, otherwise the parcel will be returned to the seller.\n\nTrack here: ${trackUrl}`,
                'pickup_scheduled': `📋 *Shipping Update:* Courier pickup scheduled for "${deal.title}". Track here: ${trackUrl}`
            };

            const chatMsgContent = chatMessages[internalStatus];
            if (chatMsgContent) {
                try {
                    let systemMessage;
                    if (deal.chatId.startsWith('community_')) {
                        systemMessage = await prisma.communityMessage.create({
                            data: {
                                senderId: deal.vendorId,
                                communityId: parseInt(deal.chatId.split('_')[1]),
                                content: chatMsgContent,
                                messageType: 'escrow_update'
                            },
                            include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } }
                        });
                    } else {
                        systemMessage = await prisma.message.create({
                            data: {
                                senderId: deal.vendorId,
                                receiverId: deal.clientId,
                                chatId: deal.chatId,
                                content: chatMsgContent,
                                messageType: 'escrow_update'
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
                        io.to(deal.chatId).emit('newMessage', socketResult);
                        io.to(`user_${deal.clientId}`).emit('newMessage', socketResult);
                        io.to(`user_${deal.vendorId}`).emit('newMessage', socketResult);
                    }
                } catch (msgErr) {
                    console.error('Failed to create webhook system message:', msgErr);
                }
            }
        }

        if (io && statusChanged) {
            // Emit escrowUpdate to both buyer and seller
            io.to(deal.chatId).emit('escrowUpdate', updatedDeal);
            io.to(`user_${deal.clientId}`).emit('escrowUpdate', updatedDeal);
            io.to(`user_${deal.vendorId}`).emit('escrowUpdate', updatedDeal);

            // Build notification messages per status
            const statusMessages = {
                'in_transit': {
                    buyerTitle: '📦 Package In Transit',
                    buyerMsg: `Your order "${deal.title}" is on its way! ${latestScan?.location ? `Current location: ${latestScan.location}` : ''}`.trim(),
                    sellerTitle: '🚚 Order Dispatched',
                    sellerMsg: `"${deal.title}" is in transit.`
                },
                'out_for_delivery': {
                    buyerTitle: '🚴 Out for Delivery!',
                    buyerMsg: `Great news! Your order "${deal.title}" is out for delivery today.`,
                    sellerTitle: '📫 Order Out for Delivery',
                    sellerMsg: `"${deal.title}" is out for delivery.`
                },
                'delivered': {
                    buyerTitle: '✅ Package Delivered!',
                    buyerMsg: `Your order "${deal.title}" has been delivered. Please confirm receipt and release payment to the seller.`,
                    sellerTitle: '🎉 Package Delivered',
                    sellerMsg: `"${deal.title}" was delivered. Awaiting buyer confirmation to release your payment.`
                },
                'rto': {
                    buyerTitle: '↩️ Package Returned',
                    buyerMsg: `Your order "${deal.title}" is being returned to the seller. Please contact support.`,
                    sellerTitle: '↩️ Package RTO',
                    sellerMsg: `"${deal.title}" could not be delivered and is being returned to you.`
                },
                'pickup_scheduled': {
                    buyerTitle: '📋 Pickup Scheduled',
                    buyerMsg: `The seller's package for "${deal.title}" has been picked up by the courier.`,
                    sellerTitle: '✅ Pickup Confirmed',
                    sellerMsg: `Pickup for "${deal.title}" has been confirmed.`
                }
            };

            const messages = statusMessages[internalStatus];
            if (messages) {
                // Notify buyer
                io.to(`user_${deal.clientId}`).emit('notification', {
                    title: messages.buyerTitle,
                    message: messages.buyerMsg,
                    type: 'info',
                    metadata: { type: 'escrow', dealId: deal.id, chatId: deal.chatId }
                });

                // Notify seller
                io.to(`user_${deal.vendorId}`).emit('notification', {
                    title: messages.sellerTitle,
                    message: messages.sellerMsg,
                    type: 'info',
                    metadata: { type: 'escrow', dealId: deal.id, chatId: deal.chatId }
                });
            }

            // Send email to buyer
            const clientUser = await prisma.user.findUnique({ where: { id: deal.clientId } });
            if (clientUser && clientUser.email) {
                sendOrderTrackingUpdateEmail(clientUser.email, {
                    customerName: clientUser.displayName,
                    dealTitle: deal.title,
                    trackingId: deal.trackingId || awb,
                    shippingStatus: current_status
                }).catch(e => console.error('Buyer tracking email failed:', e));
            }

            // Send email to seller
            const vendorUser = await prisma.user.findUnique({ where: { id: deal.vendorId } });
            if (vendorUser && vendorUser.email) {
                sendOrderTrackingUpdateEmail(vendorUser.email, {
                    customerName: vendorUser.displayName,
                    dealTitle: deal.title,
                    trackingId: deal.trackingId || awb,
                    shippingStatus: current_status
                }).catch(e => console.error('Seller tracking email failed:', e));
            }
        }

        // Respond to ShipRocket
        res.json({ received: true });
    } catch (err) {
        console.error('ShipRocket webhook error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;

