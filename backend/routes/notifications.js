import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { auth, adminOnly, checkPermission } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

function sanitizeNotificationText(text) {
    if (!text) return text || "";
    return String(text).replace(/\bescrow\b/gi, 'payment');
}


// GET /api/notifications — fetch notifications for current user (targeted + broadcasts)
// GET /api/notifications — fetch notifications for current user (targeted + broadcasts)
router.get('/', auth, async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: {
                OR: [
                    { targetUserId: null },      // Broadcast (visible to all)
                    { targetUserId: req.user.id } // Targeted to this user
                ],
                // Filter out deleted notifications
                reads: {
                    none: {
                        userId: req.user.id,
                        isDeleted: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                reads: {
                    where: { userId: req.user.id }
                }
            }
        });

        const result = notifications.map(n => ({
            id: n.id,
            title: n.title,
            message: n.message,
            type: n.type,
            createdAt: n.createdAt,
            sentBy: (n.admin?.role === 'admin' || n.admin?.role === 'staff') ? 'Krovaa' : (n.admin?.displayName || n.admin?.username || 'System'),
            isRead: n.reads.length > 0 && !n.reads[0].isDeleted,
            metadata: n.metadata
        }));

        res.json(result);
    } catch (err) {
        console.error('Get notifications error:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// GET /api/notifications/unread-count — quick unread count
router.get('/unread-count', auth, async (req, res) => {
    try {
        const total = await prisma.notification.count({
            where: {
                OR: [
                    { targetUserId: null },
                    { targetUserId: req.user.id }
                ],
                // Exclude deleted notifications
                reads: {
                    none: { userId: req.user.id, isDeleted: true }
                }
            }
        });
        const read = await prisma.notificationRead.count({
            where: { userId: req.user.id, isDeleted: false }
        });
        res.json({ count: Math.max(0, total - read) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get count' });
    }
});

// POST /api/notifications/:id/read — mark a notification as read
router.post('/:id/read', auth, async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id);
        await prisma.notificationRead.upsert({
            where: {
                notificationId_userId: {
                    notificationId,
                    userId: req.user.id
                }
            },
            create: { notificationId, userId: req.user.id },
            update: {}
        });
        res.json({ success: true });
    } catch (err) {
        console.error('Mark read error:', err);
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});

// POST /api/notifications/read-all — mark ALL as read
router.post('/read-all', auth, async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: {
                OR: [
                    { targetUserId: null },
                    { targetUserId: req.user.id }
                ],
                // Filter out deleted
                reads: {
                    none: {
                        userId: req.user.id,
                        isDeleted: true
                    }
                }
            },
            select: { id: true }
        });

        await Promise.all(
            notifications.map(n =>
                prisma.notificationRead.upsert({
                    where: {
                        notificationId_userId: {
                            notificationId: n.id,
                            userId: req.user.id
                        }
                    },
                    create: { notificationId: n.id, userId: req.user.id, readAt: new Date() },
                    update: { readAt: new Date() } // Don't touch isDeleted
                })
            )
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Mark all read error:', err);
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
});

// DELETE /api/notifications/:id — soft delete a notification
router.delete('/:id', auth, async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id);

        const notification = await prisma.notification.findUnique({
            where: { id: notificationId }
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        // Soft delete for the user using NotificationRead table
        await prisma.notificationRead.upsert({
            where: {
                notificationId_userId: {
                    notificationId,
                    userId: req.user.id
                }
            },
            create: {
                notificationId,
                userId: req.user.id,
                isDeleted: true,
                readAt: new Date() // Deleting implies seeing it/handling it
            },
            update: {
                isDeleted: true
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Delete notification error:', err);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});


// POST /api/notifications/broadcast — Admin only: send to all users
router.post('/broadcast', auth, adminOnly, checkPermission('broadcast'), async (req, res) => {
    try {
        const { title, message, type = 'info', color } = req.body;

        if (!title?.trim() || !message?.trim()) {
            return res.status(400).json({ error: 'Title and message are required' });
        }

        const validTypes = ['info', 'warning', 'success', 'alert'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Invalid type' });
        }

        const sanitizedTitle = sanitizeNotificationText(title).trim();
        const sanitizedMessage = sanitizeNotificationText(message).trim();

        const notification = await prisma.notification.create({
            data: {
                title: sanitizedTitle,
                message: sanitizedMessage,
                type,
                color,
                sentBy: req.user.id,
                metadata: req.body.metadata // Capture metadata from body
            },
            include: {
                admin: { select: { displayName: true, username: true, role: true } }
            }
        });

        // Emit to ALL connected users via Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.emit('admin:notification', {
                id: notification.id,
                title: notification.title,
                message: notification.message,
                type: notification.type,
                color: notification.color,
                createdAt: notification.createdAt,
                sentBy: (notification.admin?.role === 'admin' || notification.admin?.role === 'staff') ? 'Krovaa' : (notification.admin?.displayName || notification.admin?.username || 'Krovaa'),
                sentById: req.user.id, // Include sender ID for filtering
                isRead: false,
                metadata: notification.metadata
            });
        }

        // Mirror broadcast as a message in Help Center for regular users
        try {
            const users = await prisma.user.findMany({
                where: {
                    status: 'active',
                    NOT: { role: 'admin' } // Fix: exclude admins instead of non-existent 'user' role
                },
                select: { id: true }
            });

            for (const user of users) {
                const chatId = `support_${user.id}`;
                const msg = await prisma.message.create({
                    data: {
                        chatId,
                        senderId: req.user.id, // The admin who sent the broadcast
                        receiverId: user.id,
                        content: `📢 **${sanitizedTitle}**\n\n${sanitizedMessage}`,
                        messageType: 'text',
                        color: color // Pass the custom color to the message
                    }
                });

                // Emit new message via socket
                if (io) {
                    const socketMsg = {
                        ...msg,
                        sender_name: "Krovaa",
                        sender_avatar: null // Use default system avatar
                    };

                    io.to(chatId).emit('newMessage', socketMsg);
                    // Also notify user's personal room to refresh their chat list/unread count
                    io.to(`user_${user.id}`).emit('newMessage', socketMsg);
                }
            }
        } catch (msgErr) {
            console.error('Failed to mirror broadcast to Admin chat:', msgErr);
        }

        console.log(`📢 Admin broadcast sent: "${title}" to all users`);

        res.json({ success: true, notification });
    } catch (err) {
        console.error('Broadcast error:', err);
        res.status(500).json({ error: 'Failed to send broadcast' });
    }
});

/**
 * Send a targeted in-app notification to a specific user.
 * Also emits via Socket.IO for real-time delivery.
 *
 * @param {object} io - Socket.IO instance
 * @param {number} targetUserId - The user to notify
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {'info'|'success'|'warning'|'alert'} type - Notification type
 * @param {object|null} metadata - Extra redirection data
 */
export async function sendUserNotification(io, targetUserId, title, message, type = 'info', metadata = null) {
    try {
        const sanitizedTitle = sanitizeNotificationText(title);
        const sanitizedMessage = sanitizeNotificationText(message);

        const notification = await prisma.notification.create({
            data: {
                title: sanitizedTitle,
                message: sanitizedMessage,
                type,
                targetUserId,
                metadata: metadata ? (typeof metadata === 'string' ? JSON.parse(metadata) : metadata) : null
            }
        });

        // Push to the specific user's socket room
        if (io) {
            io.to(`user_${targetUserId}`).emit('admin:notification', {
                id: notification.id,
                title: notification.title,
                message: notification.message,
                type: notification.type,
                createdAt: notification.createdAt,
                sentBy: 'System',
                isRead: false,
                metadata: notification.metadata
            });
        }

        // Mirror to Help Center chat
        try {
            // Find an admin to be the sender (or use a fixed system ID if valid)
            const admin = await prisma.user.findFirst({
                where: { role: 'admin' },
                select: { id: true, avatarUrl: true }
            });

            if (admin) {
                const chatId = `support_${targetUserId}`;
                const msg = await prisma.message.create({
                    data: {
                        chatId,
                        senderId: admin.id,
                        receiverId: targetUserId,
                        content: `🔔 **${sanitizedTitle}**\n\n${sanitizedMessage}`,
                        messageType: 'notification'
                    }
                });

                if (io) {
                    io.to(chatId).emit('newMessage', {
                        ...msg,
                        sender_name: "Krovaa",
                        sender_avatar: null // Use default system avatar
                    });
                }
            }
        } catch (msgErr) {
            console.error('Failed to mirror notification to Admin chat:', msgErr);
        }

        return notification;
    } catch (err) {
        console.error(`Failed to send notification to user ${targetUserId}:`, err.message);
    }
}

export default router;
