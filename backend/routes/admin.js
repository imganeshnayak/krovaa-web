import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth, adminOnly, checkPermission } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import { processPayoutAutomatically } from '../services/razorpayPayouts.js';
import { sendUserNotification } from './notifications.js';

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', auth, adminOnly, async (req, res) => {
    try {
        const [
            totalUsers,
            activeUsers,
            totalMessages,
            totalChats,
            totalEscrowDeals,
            activeEscrowDeals,
            totalEscrowValue,
            recentActivity,
            pendingPayouts,
            pendingVerifications,
            pendingReports,
            totalPayoutValue
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { status: 'active' } }),
            prisma.message.count(),
            prisma.message.groupBy({
                by: ['chatId'],
                _count: true
            }),
            prisma.escrowDeal.count(),
            prisma.escrowDeal.count({ where: { status: 'active' } }),
            prisma.escrowDeal.aggregate({
                _sum: { totalAmount: true }
            }),
            prisma.activityLog.count({
                where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
            }),
            prisma.payoutRequest.count({ where: { status: 'pending' } }),
            prisma.verificationRequest.count({ where: { status: 'pending' } }),
            prisma.report.count({ where: { status: 'pending' } }),
            prisma.payoutRequest.aggregate({
                where: { status: 'completed' },
                _sum: { amount: true }
            })
        ]);

        res.json({
            totalUsers,
            activeUsers,
            totalMessages,
            totalChats: totalChats.length,
            totalEscrowDeals,
            activeEscrowDeals,
            totalEscrowValue: totalEscrowValue._sum.totalAmount || 0,
            recentActivity,
            pendingPayouts,
            pendingVerifications,
            pendingReports,
            totalPayoutValue: totalPayoutValue._sum.amount || 0
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/reports - Get all reports
router.get('/reports', auth, adminOnly, checkPermission('reports'), async (req, res) => {
    try {
        const reports = await prisma.report.findMany({
            include: {
                reporter: { select: { id: true, username: true, displayName: true } },
                reported: { select: { id: true, username: true, displayName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ reports });
    } catch (err) {
        console.error('Get reports error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/admin/reports/:id - Update report status
router.put('/reports/:id', auth, adminOnly, checkPermission('reports'), async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending', 'resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ error: "Invalid status." });
        }

        const report = await prisma.report.update({
            where: { id: parseInt(req.params.id) },
            data: { status }
        });

        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'Updated report status',
                details: `Report ID: ${report.id}, Status: ${status}`
            }
        });

        res.json({ message: "Report updated successfully.", report });
    } catch (err) {
        console.error('Update report error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/users - Get all users with pagination
router.get('/users', auth, adminOnly, checkPermission('users'), async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', status = '' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {
            AND: [
                search ? {
                    OR: [
                        { username: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                        { displayName: { contains: search, mode: 'insensitive' } }
                    ]
                } : {},
                status ? { status } : {},
                { role: { not: 'staff' } }
            ]
        };

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    username: true,
                    email: true,
                    displayName: true,
                    avatarUrl: true,
                    role: true,
                    status: true,
                    createdAt: true,
                    _count: {
                        select: {
                            sentMessages: true,
                            clientDeals: true,
                            vendorDeals: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.user.count({ where })
        ]);

        res.json({
            users,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/chats - Get all chats
router.get('/chats', auth, adminOnly, checkPermission('chats'), async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get unique chat IDs with message counts, strictly filtering for support chats
        const chatGroups = await prisma.message.groupBy({
            by: ['chatId'],
            where: {
                chatId: {
                    startsWith: 'chat_'
                }
            },
            _count: { id: true },
            _max: { createdAt: true },
            orderBy: { _max: { createdAt: 'desc' } },
            skip,
            take: parseInt(limit)
        });

        // Get participants for each chat
        const chatsWithDetails = await Promise.all(
            chatGroups.map(async (group) => {
                const messages = await prisma.message.findMany({
                    where: { chatId: group.chatId },
                    include: {
                        sender: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
                        receiver: { select: { id: true, displayName: true, avatarUrl: true, username: true } }
                    },
                    take: 1,
                    orderBy: { createdAt: 'desc' }
                });

                const participants = messages.length > 0
                    ? [messages[0].sender, messages[0].receiver]
                    : [];

                return {
                    chatId: group.chatId,
                    messageCount: group._count.id,
                    lastActivity: group._max.createdAt,
                    participants
                };
            })
        );

        const total = await prisma.message.groupBy({
            by: ['chatId'],
            where: {
                chatId: {
                    startsWith: 'chat_'
                }
            },
            _count: true
        });

        res.json({
            chats: chatsWithDetails,
            total: total.length,
            page: parseInt(page),
            totalPages: Math.ceil(total.length / parseInt(limit))
        });
    } catch (err) {
        console.error('Get chats error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/chats/:chatId/messages - Get all messages for a chat
router.get('/chats/:chatId/messages', auth, adminOnly, checkPermission('chats'), async (req, res) => {
    try {
        const { chatId } = req.params;
        const messages = await prisma.message.findMany({
            where: { chatId },
            include: {
                sender: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
                receiver: { select: { id: true, displayName: true, avatarUrl: true, username: true } }
            },
            orderBy: { createdAt: 'asc' }
        });
        res.json(messages);
    } catch (err) {
        console.error('Get chat messages error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/chats/:chatId/details - Get escrow deals and transaction details for a chat
router.get('/chats/:chatId/details', auth, adminOnly, async (req, res) => {
    try {
        const { chatId } = req.params;

        const deals = await prisma.escrowDeal.findMany({
            where: { chatId },
            include: {
                client: { select: { id: true, displayName: true, username: true } },
                vendor: { select: { id: true, displayName: true, username: true } },
                transactions: { orderBy: { createdAt: 'desc' } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ deals });
    } catch (err) {
        console.error('Get chat details error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/escrow - Get all escrow deals
router.get('/escrow', auth, adminOnly, checkPermission('escrow'), async (req, res) => {
    try {
        const { page = 1, limit = 20, status = '' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = status ? { status } : {};

        const [deals, total] = await Promise.all([
            prisma.escrowDeal.findMany({
                where,
                include: {
                    client: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
                    vendor: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
                    transactions: { orderBy: { createdAt: 'desc' }, take: 3 }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.escrowDeal.count({ where })
        ]);

        res.json({
            deals,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (err) {
        console.error('Get escrow deals error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/activity-logs - Get activity logs
router.get('/activity-logs', auth, adminOnly, checkPermission('activity'), async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [activities, total] = await Promise.all([
            prisma.activityLog.findMany({
                include: {
                    user: { select: { displayName: true, username: true, avatarUrl: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.activityLog.count()
        ]);

        res.json({
            activities,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (err) {
        console.error('Activity logs error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/admin/users/:id/status - Update user status
router.put('/users/:id/status', auth, adminOnly, checkPermission('users'), async (req, res) => {
    try {
        const { status } = req.body;
        const userId = parseInt(req.params.id);

        if (!['active', 'suspended', 'banned'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { status },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                status: true
            }
        });

        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: `Changed user status to ${status}`,
                details: `User: ${user.username}`
            }
        });

        res.json(user);
    } catch (err) {
        console.error('Update user status error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/admin/users/:id/role - Update user role
router.put('/users/:id/role', auth, adminOnly, checkPermission('users'), async (req, res) => {
    try {
        const { role } = req.body;
        const userId = parseInt(req.params.id);

        if (!['client', 'vendor', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { role },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                role: true
            }
        });

        // If user was demoted from admin (i.e., new role is NOT admin), force disconnect to clear permissions
        if (role !== 'admin') {
            const io = req.app.get('io');
            if (io) {
                // Determine user's socket room (assuming standard 'user_{id}' pattern)
                io.to(`user_${userId}`).emit('forceDisconnect', { reason: 'Role updated' });
            }
        }

        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: `Changed user role to ${role}`,
                details: `User: ${user.username}`
            }
        });

        res.json(user);
    } catch (err) {
        console.error('Update user role error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/payouts - Get all payout requests
router.get('/payouts', auth, adminOnly, checkPermission('payouts'), async (req, res) => {
    try {
        const { page = 1, limit = 20, status = '' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = status ? { status } : {};

        const [payouts, total] = await Promise.all([
            prisma.payoutRequest.findMany({
                where,
                include: {
                    user: { select: { id: true, username: true, displayName: true, email: true, phoneNumber: true, walletBalance: true } }
                },
                orderBy: { requestedAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.payoutRequest.count({ where })
        ]);

        res.json({
            payouts,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (err) {
        console.error('Get payouts error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/admin/payouts/:id - Update payout request status
router.put('/payouts/:id', auth, adminOnly, checkPermission('payouts'), async (req, res) => {
    try {
        const { status, adminNote, razorpayPayoutId } = req.body;
        const payoutId = parseInt(req.params.id);

        if (!['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: "Invalid status." });
        }

        const payout = await prisma.payoutRequest.findUnique({
            where: { id: payoutId },
            include: { user: true }
        });

        if (!payout) {
            return res.status(404).json({ error: "Payout request not found" });
        }

        // 🔧 MANUAL PROCESSING MODE - Automation available but disabled
        // To enable automation: Uncomment the code block below and add RAZORPAY_ACCOUNT_NUMBER to .env
        // 
        // if (status === 'processing' && payout.status === 'pending' && !payout.razorpayPayoutId) {
        //     try {
        //         console.log(`\n🤖 Triggering automated payout for request #${payoutId}`);
        //         const automatedPayout = await processPayoutAutomatically(payoutId);
        //         await prisma.activityLog.create({
        //             data: {
        //                 userId: req.user.id,
        //                 action: 'Automated payout initiated',
        //                 details: `Payout ID: ${payoutId}, Razorpay ID: ${automatedPayout.razorpayPayoutId}`
        //             }
        //         });
        //         return res.json(automatedPayout);
        //     } catch (automationError) {
        //         console.error('❌ Automated payout failed:', automationError);
        //         
        //         // SAFETY: Refund to wallet on automation failure
        //         await prisma.$transaction(async (prisma) => {
        //             await prisma.payoutRequest.update({
        //                 where: { id: payoutId },
        //                 data: {
        //                     status: 'failed',
        //                     adminNote: `Automated payout failed: ${automationError.message}`
        //                 }
        //             });
        //             
        //             const user = await prisma.user.update({
        //                 where: { id: payout.userId },
        //                 data: { walletBalance: { increment: payout.amount } }
        //             });
        //
        //             await prisma.walletTransaction.create({
        //                 data: {
        //                     userId: payout.userId,
        //                     type: 'credit',
        //                     amount: payout.amount,
        //                     balance: user.walletBalance,
        //                     reference: `payout_refund_${payout.id}`,
        //                     description: `Payout failed (automation error) - Refunded to wallet`
        //                 }
        //             });
        //         });
        //
        //         return res.status(500).json({
        //             error: 'Automated payout failed',
        //             message: automationError.message,
        //             details: 'Funds have been refunded to wallet. You can manually transfer and mark as completed.'
        //         });
        //     }
        // }

        // Manual status update with optimistic locking
        const result = await prisma.payoutRequest.updateMany({
            where: {
                id: payoutId,
                status: payout.status // Ensure status hasn't changed since we read it
            },
            data: {
                status,
                adminNote,
                razorpayPayoutId,
                processedAt: ['completed', 'failed', 'cancelled'].includes(status) ? new Date() : undefined
            }
        });

        if (result.count === 0) {
            return res.status(409).json({ error: "Payout status was updated by another process. Please refresh and try again." });
        }

        const updatedPayout = await prisma.payoutRequest.findUnique({ where: { id: payoutId } });

        // If cancelled or failed, refund the amount to wallet
        if (['failed', 'cancelled'].includes(status) && payout.status !== 'failed' && payout.status !== 'cancelled') {
            await prisma.$transaction(async (prisma) => {
                const user = await prisma.user.update({
                    where: { id: payout.userId },
                    data: { walletBalance: { increment: payout.amount } }
                });

                await prisma.walletTransaction.create({
                    data: {
                        userId: payout.userId,
                        type: 'credit', // Refund
                        amount: payout.amount,
                        balance: user.walletBalance,
                        reference: `payout_refund_${payout.id}`,
                        description: `Payout ${status}: Refunded to wallet`
                    }
                });
            });
        }

        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'Updated payout status',
                details: `Payout ID: ${payout.id}, Status: ${status}`
            }
        });

        // Notify user about payout status change
        const io = req.app.get('io');
        let notificationTitle = '💸 Payout Update';
        let notificationMessage = `Your payout request of ₹${payout.amount.toLocaleString('en-IN')} is now ${status}.`;
        let notificationType = 'info';

        if (status === 'completed') {
            notificationTitle = '✅ Payout Completed';
            notificationMessage = `Your payout of ₹${payout.amount.toLocaleString('en-IN')} has been successfully processed.`;
            notificationType = 'success';
        } else if (status === 'failed' || status === 'cancelled') {
            notificationTitle = status === 'failed' ? '❌ Payout Failed' : '❌ Payout Cancelled';
            notificationMessage = `Your payout of ₹${payout.amount.toLocaleString('en-IN')} was ${status}. ${adminNote ? 'Reason: ' + adminNote : 'The amount has been refunded to your wallet.'}`;
            notificationType = 'alert';
        } else if (status === 'processing') {
            notificationMessage = `Your payout of ₹${payout.amount.toLocaleString('en-IN')} is now being processed.`;
        }

        sendUserNotification(io, payout.userId, notificationTitle, notificationMessage, notificationType, { type: 'wallet' });

        res.json(updatedPayout);
    } catch (err) {
        console.error('Update payout error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', auth, adminOnly, checkPermission('users'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Prevent deleting yourself
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        // Delete all related records in a transaction to avoid foreign key constraints
        // Order matters for some databases, but Prisma handles the dependency graph within a transaction well.
        // We delete children and relations first.
        await prisma.$transaction([
            prisma.activityLog.deleteMany({ where: { userId } }),
            prisma.message.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } }),
            prisma.rating.deleteMany({ where: { OR: [{ reviewerId: userId }, { reviewedId: userId }] } }),
            prisma.report.deleteMany({ where: { OR: [{ reporterId: userId }, { reportedId: userId }] } }),
            prisma.blockedUser.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } }),
            prisma.verificationRequest.deleteMany({ where: { userId } }),
            prisma.walletTransaction.deleteMany({ where: { userId } }),
            prisma.payoutRequest.deleteMany({ where: { userId } }),
            prisma.notificationRead.deleteMany({ where: { userId } }),
            prisma.notification.deleteMany({ where: { OR: [{ sentBy: userId }, { targetUserId: userId }] } }),
            prisma.adClick.deleteMany({ where: { userId } }),
            prisma.ad.deleteMany({ where: { sentBy: userId } }),
            prisma.escrowDeal.deleteMany({ where: { OR: [{ clientId: userId }, { vendorId: userId }] } }),
            prisma.user.delete({ where: { id: userId } })
        ]);

        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'Deleted user account',
                details: `User ID: ${userId}`
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// GET /api/admin/users/:id/transactions - Get transaction history for a specific user
router.get('/users/:id/transactions', auth, adminOnly, checkPermission('users'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        const [escrowDeals, payoutRequests, walletTransactions, ratingReceived, ratingReviews] = await Promise.all([
            prisma.escrowDeal.findMany({
                where: {
                    OR: [{ clientId: userId }, { vendorId: userId }]
                },
                include: {
                    client: { select: { displayName: true, username: true } },
                    vendor: { select: { displayName: true, username: true } },
                    transactions: { orderBy: { createdAt: 'desc' } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.payoutRequest.findMany({
                where: { userId },
                orderBy: { requestedAt: 'desc' }
            }),
            prisma.walletTransaction.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 20
            }),
            prisma.rating.findMany({
                where: { reviewedId: userId },
                include: { reviewer: { select: { displayName: true, username: true } } },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.rating.findMany({
                where: { reviewerId: userId },
                include: { reviewed: { select: { displayName: true, username: true } } },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        res.json({
            escrowDeals,
            payoutRequests,
            walletTransactions,
            ratingReceived,
            ratingReviews
        });
    } catch (err) {
        console.error('Get user transactions error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

function getRelativeTime(date) {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

// GET /api/admin/settings - Get all system settings
router.get('/settings', auth, adminOnly, checkPermission('settings'), async (req, res) => {
    try {
        const settings = await prisma.systemSetting.findMany();
        const settingsMap = settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        res.json(settingsMap);
    } catch (err) {
        console.error('Get settings error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/admin/settings - Update/Create system settings
router.post('/settings', auth, adminOnly, checkPermission('settings'), async (req, res) => {
    try {
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Invalid settings format.' });
        }

        const updates = Object.entries(settings).map(([key, value]) =>
            prisma.systemSetting.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) }
            })
        );

        await Promise.all(updates);

        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'Updated system settings',
                details: Object.keys(settings).join(', ')
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/users/:id/full - Get comprehensive user details
router.get('/users/:id/full', auth, adminOnly, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        const [user, activities] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                include: {
                    walletTransactions: { orderBy: { createdAt: 'desc' }, take: 50 },
                    clientDeals: {
                        include: {
                            vendor: { select: { id: true, displayName: true, username: true } },
                            transactions: { orderBy: { createdAt: 'desc' } }
                        },
                        orderBy: { createdAt: 'desc' }
                    },
                    vendorDeals: {
                        include: {
                            client: { select: { id: true, displayName: true, username: true } },
                            transactions: { orderBy: { createdAt: 'desc' } }
                        },
                        orderBy: { createdAt: 'desc' }
                    },
                    payoutRequests: { orderBy: { requestedAt: 'desc' } },
                    ratingReceived: {
                        include: { reviewer: { select: { id: true, displayName: true, username: true } } },
                        orderBy: { createdAt: 'desc' }
                    },
                    ratingReviews: {
                        include: { reviewed: { select: { id: true, displayName: true, username: true } } },
                        orderBy: { createdAt: 'desc' }
                    },
                    reportReceived: {
                        include: { reporter: { select: { id: true, displayName: true, username: true } } },
                        orderBy: { createdAt: 'desc' }
                    },
                    reportSent: {
                        include: { reported: { select: { id: true, displayName: true, username: true } } },
                        orderBy: { createdAt: 'desc' }
                    },
                    blockedBy: {
                        include: { blocker: { select: { id: true, displayName: true, username: true } } },
                        orderBy: { createdAt: 'desc' }
                    },
                    blockedUsers: {
                        include: { blocked: { select: { id: true, displayName: true, username: true } } },
                        orderBy: { createdAt: 'desc' }
                    },
                    verificationRequests: { orderBy: { createdAt: 'desc' } },
                    imageGenerations: { orderBy: { createdAt: 'desc' }, take: 50 }
                }
            }),
            prisma.activityLog.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),
        ]);

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Exclude password
        const { password, ...safeUser } = user;
        res.json({ ...safeUser, activities });
    } catch (err) {
        console.error('Get full user details error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STAFF MANAGEMENT ROUTES
// ─────────────────────────────────────────────────────────────────

// GET /api/admin/staff - Get all staff members
router.get('/staff', auth, adminOnly, checkPermission('staff'), async (req, res) => {
    try {
        const staff = await prisma.user.findMany({
            where: { role: 'staff' },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                avatarUrl: true,
                role: true,
                status: true,
                permissions: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(staff);
    } catch (err) {
        console.error('Get staff error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/admin/staff - Create a new staff account
router.post('/staff', auth, adminOnly, checkPermission('staff'), async (req, res) => {
    try {
        const { email, password, displayName, username, permissions } = req.body;

        if (!email || !password || !username) {
            return res.status(400).json({ error: 'Email, password, and username are required.' });
        }

        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }, { username }] }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Email or username already in use.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const staff = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                username: username.toLowerCase(),
                password: hashedPassword,
                displayName: displayName || username,
                role: 'staff',
                permissions: permissions || [],
                status: 'active'
            },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                role: true,
                permissions: true
            }
        });

        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'Created staff account',
                details: `Staff: ${staff.username}`
            }
        });

        res.status(201).json(staff);
    } catch (err) {
        console.error('Create staff error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/admin/staff/:id/permissions - Update staff permissions
router.put('/staff/:id/permissions', auth, adminOnly, checkPermission('staff'), async (req, res) => {
    try {
        const { permissions } = req.body;
        const staffId = parseInt(req.params.id);

        const staff = await prisma.user.update({
            where: { id: staffId, role: 'staff' },
            data: { permissions },
            select: {
                id: true,
                username: true,
                permissions: true
            }
        });

        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'Updated staff permissions',
                details: `Staff: ${staff.username}, Perms: ${JSON.stringify(permissions)}`
            }
        });

        res.json(staff);
    } catch (err) {
        console.error('Update staff permissions error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/admin/staff/:id - Delete a staff account
router.delete('/staff/:id', auth, adminOnly, checkPermission('staff'), async (req, res) => {
    try {
        const staffId = parseInt(req.params.id);

        if (staffId === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        // Search for the staff member first
        const staffMember = await prisma.user.findUnique({
            where: { id: staffId, role: 'staff' }
        });

        if (!staffMember) {
            return res.status(404).json({ error: 'Staff member not found' });
        }

        // Delete dependencies first
        await prisma.$transaction([
            prisma.activityLog.deleteMany({ where: { userId: staffId } }),
            prisma.notification.deleteMany({ where: { sentBy: staffId } }),
            prisma.ad.deleteMany({ where: { sentBy: staffId } }),
            prisma.user.delete({ where: { id: staffId } })
        ]);

        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'Deleted staff account',
                details: `Staff: ${staffMember.username}`
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Delete staff error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

export default router;
