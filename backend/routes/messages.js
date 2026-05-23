import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';
import multer from 'multer';
import os from 'os';
import fs from 'fs';

const prisma = new PrismaClient();
const router = express.Router();
const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
    fileFilter: (req, file, cb) => {
        const forbiddenExtensions = ['.exe', '.bat', '.sh', '.msi'];
        const isForbidden = forbiddenExtensions.some(ext => file.originalname.toLowerCase().endsWith(ext));

        if (isForbidden) {
            cb(new Error('This file type is not allowed for security reasons.'), false);
        } else {
            cb(null, true);
        }
    }
});

// GET /api/messages/chats/list - Get chat list for current user (must be before /:chatId)
router.get('/chats/list', auth, async (req, res) => {
    try {
        // For admins, include all support chats so they can assist any user
        const whereClause = req.user.role === 'admin'
            ? {
                OR: [
                    { senderId: req.user.id, deletedBySender: false },
                    { receiverId: req.user.id, deletedByReceiver: false },
                    { chatId: { startsWith: 'support_' } }
                ]
            }
            : {
                OR: [
                    { senderId: req.user.id, deletedBySender: false },
                    { receiverId: req.user.id, deletedByReceiver: false }
                ]
            };

        const messages = await prisma.message.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            include: {
                sender: { select: { id: true, displayName: true, avatarUrl: true, username: true, verified: true } },
                receiver: { select: { id: true, displayName: true, avatarUrl: true, username: true, verified: true } }
            },
        });

        // Get unread counts in a single query
        const unreadCounts = await prisma.message.groupBy({
            by: ['chatId'],
            where: {
                receiverId: req.user.id,
                read: false
            },
            _count: { id: true }
        });
        const unreadMap = new Map(unreadCounts.map(u => [u.chatId, u._count.id]));

        // Group by chatId and get latest message per chat
        const chatMap = new Map();
        for (const msg of messages) {
            if (!chatMap.has(msg.chatId)) {
                let otherUser;
                if (msg.chatId.startsWith('support_') && req.user.role === 'admin') {
                    // For admins in support chats, the "other user" is the user being assisted
                    const userIdFromChat = parseInt(msg.chatId.split('_')[1]);
                    otherUser = msg.senderId === userIdFromChat ? msg.sender : msg.receiver;
                } else {
                    otherUser = msg.senderId === req.user.id ? msg.receiver : msg.sender;
                }
                chatMap.set(msg.chatId, {
                    chat_id: msg.chatId,
                    last_message: msg.isViewOnce && !msg.isOpened ? (msg.messageType === 'image' || msg.messageType === 'file' ? "Photo" : "View Once Message") : (msg.messageType === 'image' || (msg.attachmentUrl && msg.attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? ((msg.content?.startsWith('Sent a file:') || msg.content === 'File shared') ? "Photo" : msg.content) : msg.content),
                    last_message_time: msg.createdAt,
                    user_id: otherUser.id,
                    display_name: otherUser.displayName,
                    avatar_url: otherUser.avatarUrl,
                    username: otherUser.username,
                    unread_count: unreadMap.get(msg.chatId) || 0,
                    verified: otherUser.verified || false,
                });
            }
        }

        // Ensure "Admin" (Support Admin) is always in the list for regular users
        const supportChatId = `support_${req.user.id}`;
        if (req.user.role !== 'admin' && !chatMap.has(supportChatId)) {
            const admin = await prisma.user.findFirst({
                where: { role: 'admin', status: 'active' },
                select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true }
            });

            if (admin) {
                chatMap.set(supportChatId, {
                    chat_id: supportChatId,
                    last_message: "Krovaa Official Notifications",
                    last_message_time: new Date().toISOString(),
                    user_id: admin.id,
                    display_name: "Krovaa",
                    avatar_url: "/krovaa-logo.svg?v=3", // Use logo
                    username: "krovaa", // use actual admin username for profile links
                    unread_count: 0,
                    verified: true,
                    isOfficial: true // Special flag for frontend
                });
            }
        } else {
            // Update the admin's own support chat entry with branding if it exists
            const supportEntry = chatMap.get(supportChatId);
            if (supportEntry) {
                supportEntry.display_name = "Krovaa";
                supportEntry.avatar_url = "/krovaa-logo.svg?v=3"; // Ensure generic avatar
                // Keep the existing username (the chat participant) so profile links continue to work
                supportEntry.isOfficial = true;
            }
        }

        res.json(Array.from(chatMap.values()));
    } catch (err) {
        console.error('Get chats error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/messages/support - Get the Help Center details
router.get('/support', auth, async (req, res) => {
    try {
        // Find first active admin
        const admin = await prisma.user.findFirst({
            where: { role: 'admin', status: 'active' },
            select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true }
        });

        if (!admin) {
            return res.status(404).json({ error: 'Support team not available.' });
        }

        const chatId = `support_${req.user.id}`;

        res.json({
            admin: { ...admin, displayName: "Krovaa", avatarUrl: null, username: "krovaa" }, // Generic details
            chatId
        });
    } catch (err) {
        console.error('Get support error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/messages/:chatId - Get messages for a chat
router.get('/:chatId', auth, async (req, res) => {
    try {
        const { chatId } = req.params;
        const messages = await prisma.message.findMany({
            where: {
                chatId,
                OR: [
                    { senderId: req.user.id, deletedBySender: false },
                    { receiverId: req.user.id, deletedByReceiver: false }
                ]
            },
            orderBy: { createdAt: 'asc' },
            include: {
                sender: { select: { displayName: true, avatarUrl: true, username: true, role: true } },
            },
        });

        const isSupportChat = chatId.startsWith('support_');
        const regularUserViewingSupport = isSupportChat && req.user.role !== 'admin' && req.user.role !== 'staff';

        const result = messages.map(m => {
            const isFromAdminStaff = m.sender.role === 'admin' || m.sender.role === 'staff';
            return {
                ...m,
                sender_name: (regularUserViewingSupport && isFromAdminStaff) ? "Krovaa" : m.sender.displayName,
                sender_avatar: (regularUserViewingSupport && isFromAdminStaff) ? null : m.sender.avatarUrl,
                sender_username: (regularUserViewingSupport && isFromAdminStaff) ? "krovaa" : m.sender.username,
                sender: undefined,
            };
        });

        res.json(result);
    } catch (err) {
        console.error('Get messages error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/messages - Send a message
router.post('/', auth, async (req, res) => {
    try {
        const { receiver_id, chat_id, content, message_type } = req.body;

        // Check if sender is blocked by receiver
        const isBlocked = await prisma.blockedUser.findUnique({
            where: {
                blockerId_blockedId: {
                    blockerId: parseInt(receiver_id),
                    blockedId: req.user.id
                }
            }
        });

        if (isBlocked) {
            return res.status(403).json({ error: "You are blocked by this user." });
        }

        const message = await prisma.message.create({
            data: {
                senderId: req.user.id,
                receiverId: parseInt(receiver_id),
                chatId: chat_id,
                content,
                messageType: message_type || 'text',
                isViewOnce: req.body.is_view_once === true || req.body.is_view_once === 'true'
            },
            include: { sender: { select: { displayName: true, avatarUrl: true, username: true, role: true } } },
        });

        await prisma.activityLog.create({ data: { userId: req.user.id, action: 'Sent message' } });

        const result = {
            ...message,
            sender_name: message.sender.displayName,
            sender_avatar: message.sender.avatarUrl,
            sender_username: message.sender.username,
        };

        const isSupport = chat_id.startsWith('support_');
        const maskedResult = (isSupport && (message.sender.role === 'admin' || message.sender.role === 'staff')) ? {
            ...result,
            sender_name: "Krovaa",
            sender_avatar: "/krovaa-logo.svg?v=3",
            sender_username: "krovaa"
        } : result;

        const io = req.app.get('io');
        if (io) {
            io.to(chat_id).emit('newMessage', maskedResult);
            // Also notify receiver's personal room to refresh their chat list
            io.to(`user_${receiver_id}`).emit('newMessage', maskedResult);

            // If it's a support chat, broadcast to ALL admins (they see unmasked result)
            if (chat_id.startsWith('support_')) {
                io.to('admin_broadcast').emit('newMessage', result);
            }
        }

        res.status(201).json(result);
    } catch (err) {
        console.error('Send message error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/messages/upload - Send message with file attachment via Cloudinary
router.post('/upload', auth, upload.single('file'), async (req, res) => {
    try {
        const { receiver_id, chat_id, content } = req.body;

        // Check if sender is blocked by receiver
        const isBlocked = await prisma.blockedUser.findUnique({
            where: {
                blockerId_blockedId: {
                    blockerId: parseInt(receiver_id),
                    blockedId: req.user.id
                }
            }
        });

        if (isBlocked) {
            if (req.file && req.file.path) fs.unlink(req.file.path, () => { });
            return res.status(403).json({ error: "You are blocked by this user." });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: 'krovaa/attachments', resource_type: 'auto', access_mode: 'public' },
                (error, result) => {
                    fs.unlink(req.file.path, () => { });
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            fs.createReadStream(req.file.path).pipe(stream);
        });

        const isAudio = req.file.mimetype.startsWith('audio/');
        const message = await prisma.message.create({
            data: {
                senderId: req.user.id,
                receiverId: parseInt(receiver_id),
                chatId: chat_id,
                content: content || (isAudio ? 'Voice message' : 'File shared'),
                messageType: req.file.mimetype.startsWith('image/') ? 'image' : (isAudio ? 'voice' : 'file'),
                attachmentUrl: uploadResult.secure_url,
                attachmentName: req.file.originalname,
                isViewOnce: req.body.is_view_once === true || req.body.is_view_once === 'true'
            },
            include: { sender: { select: { displayName: true, avatarUrl: true, username: true, role: true } } },
        });

        const result = {
            ...message,
            sender_name: message.sender.displayName,
            sender_avatar: message.sender.avatarUrl,
            sender_username: message.sender.username,
        };

        const isSupport = chat_id.startsWith('support_');
        const maskedResult = (isSupport && (message.sender.role === 'admin' || message.sender.role === 'staff')) ? {
            ...result,
            sender_name: "Krovaa",
            sender_avatar: "/krovaa-logo.svg?v=3",
            sender_username: "krovaa"
        } : result;

        const io = req.app.get('io');
        if (io) {
            io.to(chat_id).emit('newMessage', maskedResult);
            // Also notify receiver's personal room for chat list updates
            io.to(`user_${receiver_id}`).emit('newMessage', maskedResult);

            if (chat_id.startsWith('support_')) {
                io.to('admin_broadcast').emit('newMessage', result);
            }
        }

        await prisma.activityLog.create({ data: { userId: req.user.id, action: 'File uploaded' } });

        res.status(201).json(result);
    } catch (err) {
        if (req.file && req.file.path) fs.unlink(req.file.path, () => { });
        console.error('File upload error:', err);
        res.status(500).json({ error: 'Upload failed.' });
    }
});

// PUT /api/messages/read/:chatId - Mark all messages in a chat as read
router.put('/read/:chatId', auth, async (req, res) => {
    try {
        await prisma.message.updateMany({
            where: {
                chatId: req.params.chatId,
                receiverId: req.user.id,
                read: false,
            },
            data: { read: true },
        });

        const io = req.app.get('io');
        if (io) {
            io.to(req.params.chatId).emit('messagesRead', {
                chatId: req.params.chatId,
                readerId: req.user.id,
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Mark as read error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/messages/chat/:chatId - Clear chat history
router.delete('/chat/:chatId', auth, async (req, res) => {
    try {
        const { chatId } = req.params;

        // Verify user is part of the chat
        const isParticipant = await prisma.message.findFirst({
            where: {
                chatId,
                OR: [{ senderId: req.user.id }, { receiverId: req.user.id }]
            }
        });

        if (!isParticipant) {
            return res.status(403).json({ error: "Not authorized to clear this chat." });
        }

        // Per-user clear: only hide for the requester
        await Promise.all([
            prisma.message.updateMany({
                where: { chatId, senderId: req.user.id },
                data: { deletedBySender: true }
            }),
            prisma.message.updateMany({
                where: { chatId, receiverId: req.user.id },
                data: { deletedByReceiver: true }
            })
        ]);

        await prisma.activityLog.create({ data: { userId: req.user.id, action: 'Cleared chat history', details: `Chat ID: ${chatId}` } });

        res.json({ message: "Chat history cleared successfully." });
    } catch (err) {
        console.error('Clear history error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/messages/batch-delete - Delete multiple messages
router.post('/batch-delete', auth, async (req, res) => {
    try {
        const { ids, type } = req.body; // type: 'me' or 'everyone'
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "Invalid message IDs." });
        }

        const isAdmin = req.user.role === 'admin';

        // Find messages to check permissions
        const messages = await prisma.message.findMany({
            where: { id: { in: ids } }
        });

        if (messages.length === 0) {
            return res.status(404).json({ error: "No messages found." });
        }

        const chatId = messages[0].chatId;

        if (type === 'everyone') {
            // Check if user is owner of all messages or admin
            const nonOwned = messages.filter(m => m.senderId !== req.user.id);
            if (nonOwned.length > 0 && !isAdmin) {
                return res.status(403).json({ error: "You can only delete your own messages for everyone." });
            }

            const validIds = messages.map(m => m.id);

            await prisma.message.updateMany({
                where: { id: { in: validIds } },
                data: {
                    isDeleted: true,
                    content: "This message was deleted",
                    attachmentUrl: null,
                    attachmentName: null
                }
            });

            const io = req.app.get('io');
            if (io) {
                io.to(chatId).emit('messagesDeleted', {
                    messageIds: validIds,
                    chatId: chatId
                });
            }
            return res.json({ success: true, count: validIds.length, message: "Deleted for everyone" });
        } else {
            // Delete for me
            // Split into sent and received to update different fields
            const sentIds = messages.filter(m => m.senderId === req.user.id).map(m => m.id);
            const receivedIds = messages.filter(m => m.receiverId === req.user.id).map(m => m.id);

            if (sentIds.length > 0) {
                await prisma.message.updateMany({
                    where: { id: { in: sentIds } },
                    data: { deletedBySender: true }
                });
            }

            if (receivedIds.length > 0) {
                await prisma.message.updateMany({
                    where: { id: { in: receivedIds } },
                    data: { deletedByReceiver: true }
                });
            }

            return res.json({ success: true, count: sentIds.length + receivedIds.length, message: "Deleted for you" });
        }
    } catch (err) {
        console.error('Batch delete error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/messages/:id - Delete an individual message
router.delete('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.query; // 'me' or 'everyone'
        const messageId = parseInt(id);

        const message = await prisma.message.findUnique({
            where: { id: messageId }
        });

        if (!message) {
            return res.status(404).json({ error: "Message not found." });
        }

        const isAdmin = req.user.role === 'admin';
        const isSender = message.senderId === req.user.id;
        const isReceiver = message.receiverId === req.user.id;

        if (type === 'everyone') {
            // Delete for everyone (Soft Delete)
            // Regular users can only delete their own messages for everyone
            if (!isSender && !isAdmin) {
                return res.status(403).json({ error: "You can only delete your own messages for everyone." });
            }

            await prisma.message.update({
                where: { id: messageId },
                data: {
                    isDeleted: true,
                    content: "This message was deleted",
                    attachmentUrl: null,
                    attachmentName: null
                }
            });

            const io = req.app.get('io');
            if (io) {
                io.to(message.chatId).emit('messageDeleted', {
                    messageId: messageId,
                    chatId: message.chatId
                });
            }
            return res.json({ success: true, message: "Message deleted for everyone." });
        } else {
            // Delete for me (Me-only)
            if (isSender) {
                await prisma.message.update({
                    where: { id: messageId },
                    data: { deletedBySender: true }
                });
            } else if (isReceiver) {
                await prisma.message.update({
                    where: { id: messageId },
                    data: { deletedByReceiver: true }
                });
            } else if (!isAdmin) {
                // If not sender or receiver, and not admin, can't delete
                return res.status(403).json({ error: "Not authorized." });
            } else {
                // Admin deleting for "me" doesn't make much sense in global view, 
                // but we'll treat it as a per-user hide if they are participating.
                return res.status(400).json({ error: "Invalid operation for admin." });
            }

            return res.json({ success: true, message: "Message deleted for you." });
        }
    } catch (err) {
        console.error('Delete message error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/messages/:id/open - Mark a view-once message as opened
router.put('/:id/open', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const messageId = parseInt(id);

        const message = await prisma.message.findUnique({
            where: { id: messageId }
        });

        if (!message) {
            return res.status(404).json({ error: "Message not found." });
        }

        // Only the receiver can open the message
        if (message.receiverId !== req.user.id) {
            return res.status(403).json({ error: "Only the recipient can open this message." });
        }

        if (!message.isViewOnce) {
            return res.status(400).json({ error: "This is not a view-once message." });
        }

        if (message.isOpened) {
            return res.status(400).json({ error: "Message already viewed." });
        }

        // Mark as opened and mask content
        const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: {
                isOpened: true,
                content: "View Once message opened",
                attachmentUrl: null,
                attachmentName: null
            },
            include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } }
        });

        const result = {
            ...updatedMessage,
            sender_name: updatedMessage.sender.displayName,
            sender_avatar: updatedMessage.sender.avatarUrl,
            sender_username: updatedMessage.sender.username,
        };

        const io = req.app.get('io');
        if (io) {
            io.to(message.chatId).emit('messageOpened', result);
        }

        res.json(result);
    } catch (err) {
        console.error('Open view-once message error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

export default router;
