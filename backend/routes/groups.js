import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/groups - Get user's group chats
router.get('/', auth, async (req, res) => {
    try {
        const groups = await prisma.groupChat.findMany({
            where: {
                members: {
                    some: { userId: req.user.id }
                }
            },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
                    }
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(groups);
    } catch (err) {
        console.error('Get groups error:', err);
        res.status(500).json({ error: 'Failed to fetch groups.' });
    }
});

// POST /api/groups - Create a new group chat
router.post('/', auth, async (req, res) => {
    try {
        const { name, description, userIds, isTeamChat } = req.body;

        const membersData = [{ userId: req.user.id, role: 'admin' }];
        if (userIds && Array.isArray(userIds)) {
            for (const uid of userIds) {
                if (uid !== req.user.id) {
                    membersData.push({ userId: uid, role: 'member' });
                }
            }
        }

        const group = await prisma.groupChat.create({
            data: {
                name,
                description,
                isTeamChat: isTeamChat || false,
                members: {
                    create: membersData
                }
            },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
                    }
                }
            }
        });

        res.status(201).json(group);
    } catch (err) {
        console.error('Create group error:', err);
        res.status(500).json({ error: 'Failed to create group.' });
    }
});

// GET /api/groups/:id/messages
router.get('/:id/messages', auth, async (req, res) => {
    try {
        const groupId = Number(req.params.id);
        
        const membership = await prisma.groupMember.findUnique({
            where: { groupId_userId: { groupId, userId: req.user.id } }
        });

        if (!membership) return res.status(403).json({ error: 'Not a member of this group.' });

        const messages = await prisma.groupMessage.findMany({
            where: { groupId },
            include: {
                sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
            },
            orderBy: { createdAt: 'asc' }
        });

        res.json(messages);
    } catch (err) {
        console.error('Get group messages error:', err);
        res.status(500).json({ error: 'Failed to fetch messages.' });
    }
});

// POST /api/groups/:id/messages
router.post('/:id/messages', auth, async (req, res) => {
    try {
        const groupId = Number(req.params.id);
        const { content, messageType, attachmentUrl } = req.body;

        const membership = await prisma.groupMember.findUnique({
            where: { groupId_userId: { groupId, userId: req.user.id } }
        });

        if (!membership) return res.status(403).json({ error: 'Not a member of this group.' });

        const message = await prisma.groupMessage.create({
            data: {
                groupId,
                senderId: req.user.id,
                content,
                messageType: messageType || 'text',
                attachmentUrl
            },
            include: {
                sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
            }
        });

        await prisma.groupChat.update({
            where: { id: groupId },
            data: { updatedAt: new Date() }
        });

        const io = req.app.get('io');
        if (io) {
            const socketMessage = {
                ...message,
                chatId: `group_${groupId}`,
                sender_name: message.sender?.displayName,
                sender_avatar: message.sender?.avatarUrl,
                sender_username: message.sender?.username,
            };
            io.to(`group_${groupId}`).emit('newMessage', socketMessage);
            io.to(`group_${groupId}`).emit('newGroupMessage', message);
        }

        res.status(201).json(message);
    } catch (err) {
        console.error('Send group message error:', err);
        res.status(500).json({ error: 'Failed to send message.' });
    }
});

export default router;
