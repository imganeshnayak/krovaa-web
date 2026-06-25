import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendUserNotification } from '../routes/notifications.js';

const prisma = new PrismaClient();

// Map of Socket.io instance
let ioInstance = null;

export const initCronJobs = (io) => {
    ioInstance = io;
    console.log('🕒 Cron jobs initialized.');

    // Run every day at midnight
    cron.schedule('0 0 * * *', async () => {
        console.log('🔄 Running daily Escrow auto-release check...');
        await checkAndAutoReleaseEscrow();
    });
};

const checkAndAutoReleaseEscrow = async () => {
    try {
        // Calculate the threshold date (3 days ago)
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - 3);

        // Find all active deals that are delivered but not released
        const dealsToRelease = await prisma.escrowDeal.findMany({
            where: {
                status: 'active',
                paymentStatus: 'paid',
                shippingStatus: 'delivered',
                // We need to check if the delivery happened more than 3 days ago.
                // Since we don't have a specific `deliveredAt` field, we'll check `updatedAt` 
                // which gets modified when webhook marks it delivered.
                updatedAt: {
                    lte: thresholdDate
                }
            },
            include: {
                client: { select: { id: true, displayName: true } },
                vendor: { select: { id: true, displayName: true, walletBalance: true } }
            }
        });

        if (dealsToRelease.length === 0) {
            console.log('✅ No deals to auto-release today.');
            return;
        }

        console.log(`⏳ Found ${dealsToRelease.length} deals to auto-release.`);

        for (const deal of dealsToRelease) {
            try {
                // Determine release amount (deducting any platform fee)
                let platformFeePercent = 0.10;
                const feeSetting = await prisma.systemSetting.findUnique({ where: { key: 'platform_fee_percent' } });
                if (feeSetting) platformFeePercent = parseFloat(feeSetting.value);
                
                const releaseAmount = deal.totalAmount * (1 - platformFeePercent);

                await prisma.$transaction(async (tx) => {
                    // 1. Update deal status
                    await tx.escrowDeal.update({
                        where: { id: deal.id },
                        data: {
                            status: 'released',
                            releasedAmount: releaseAmount
                        }
                    });

                    // 2. Add funds to vendor's wallet
                    const updatedVendor = await tx.user.update({
                        where: { id: deal.vendorId },
                        data: { walletBalance: { increment: releaseAmount } }
                    });

                    // 3. Log wallet transaction
                    await tx.walletTransaction.create({
                        data: {
                            userId: deal.vendorId,
                            type: 'credit',
                            amount: releaseAmount,
                            balance: updatedVendor.walletBalance,
                            description: `Escrow auto-released: ${deal.title}`,
                            reference: deal.chatId,
                            metadata: {
                                dealId: deal.id,
                                dealTitle: deal.title,
                                chatId: deal.chatId,
                                clientId: deal.clientId,
                                otherUserId: deal.clientId,
                                otherDisplayName: deal.client.displayName
                            }
                        }
                    });

                    // 4. System Message
                    const systemMessage = await tx.message.create({
                        data: {
                            senderId: deal.clientId, // System sends on behalf of client essentially
                            receiverId: deal.vendorId,
                            chatId: deal.chatId,
                            content: `✅ The escrow funds of ₹${releaseAmount.toLocaleString('en-IN')} have been automatically released to the seller as the 3-day confirmation window has passed since delivery.`,
                            messageType: 'escrow_released'
                        },
                        include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } }
                    });

                    // 5. Emit socket events
                    if (ioInstance) {
                        const socketResult = {
                            ...systemMessage,
                            sender_name: 'System',
                            sender_avatar: null,
                            sender_username: 'system',
                        };
                        ioInstance.to(deal.chatId).emit('newMessage', socketResult);
                        
                        const updatedDeal = await tx.escrowDeal.findUnique({
                            where: { id: deal.id },
                            include: {
                                client: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
                                vendor: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
                                transactions: true
                            }
                        });
                        ioInstance.to(deal.chatId).emit('escrowUpdate', updatedDeal);
                        ioInstance.to(`user_${deal.vendorId}`).emit('escrowUpdate', updatedDeal);
                        ioInstance.to(`user_${deal.clientId}`).emit('escrowUpdate', updatedDeal);
                    }
                });

                // Send notifications
                if (ioInstance) {
                    sendUserNotification(ioInstance, deal.vendorId, 'Funds Auto-Released', `₹${releaseAmount.toLocaleString('en-IN')} has been automatically released to your wallet for "${deal.title}".`, 'success', { type: 'escrow', dealId: deal.id, chatId: deal.chatId });
                    sendUserNotification(ioInstance, deal.clientId, 'Escrow Auto-Released', `The 3-day window has passed for "${deal.title}" and funds have been automatically released.`, 'info', { type: 'escrow', dealId: deal.id, chatId: deal.chatId });
                }

                console.log(`✅ Auto-released deal ${deal.id}`);

            } catch (dealErr) {
                console.error(`❌ Failed to auto-release deal ${deal.id}:`, dealErr);
            }
        }
    } catch (err) {
        console.error('Error in checkAndAutoReleaseEscrow cron:', err);
    }
};
