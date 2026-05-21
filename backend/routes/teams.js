import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { sendUserNotification } from './notifications.js';

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/teams - Get teams the user is part of
router.get('/', auth, async (req, res) => {
    try {
        const teams = await prisma.team.findMany({
            where: {
                members: {
                    some: { userId: req.user.id }
                }
            },
            include: {
                creator: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                members: {
                    include: {
                        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, profession: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(teams);
    } catch (err) {
        console.error('Get teams error:', err);
        res.status(500).json({ error: 'Failed to fetch teams.' });
    }
});

// POST /api/teams - Create a team
router.post('/', auth, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Team name is required.' });

        const team = await prisma.team.create({
            data: {
                name,
                description,
                creatorId: req.user.id,
                members: {
                    create: {
                        userId: req.user.id,
                        role: 'creator'
                    }
                }
            },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, profession: true } }
                    }
                }
            }
        });
        res.status(201).json(team);
    } catch (err) {
        console.error('Create team error:', err);
        res.status(500).json({ error: 'Failed to create team.' });
    }
});

// POST /api/teams/:id/members - Add member to team
router.post('/:id/members', auth, async (req, res) => {
    try {
        const teamId = Number(req.params.id);
        const { userId, role } = req.body;

        if (!userId) return res.status(400).json({ error: 'User ID is required.' });

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: { members: true }
        });

        if (!team) return res.status(404).json({ error: 'Team not found.' });

        const isCreatorOrAdmin = team.members.some(m => m.userId === req.user.id && ['creator', 'admin'].includes(m.role));
        if (!isCreatorOrAdmin) return res.status(403).json({ error: 'Not authorized to add members.' });

        const userToAdd = await prisma.user.findUnique({ where: { id: userId } });
        if (!userToAdd) return res.status(404).json({ error: 'User not found.' });

        const existingMember = await prisma.teamMember.findUnique({
            where: { teamId_userId: { teamId, userId } }
        });

        if (existingMember) return res.status(400).json({ error: 'User is already a member.' });

        const newMember = await prisma.teamMember.create({
            data: {
                teamId,
                userId,
                role: role || 'member'
            },
            include: {
                user: { select: { id: true, username: true, displayName: true, avatarUrl: true, profession: true } }
            }
        });

        const io = req.app.get('io');
        if (io) {
            await sendUserNotification(io, userId, 'Added to Team', `You have been added to team ${team.name}`, 'info', { teamId });
        }

        res.status(201).json(newMember);
    } catch (err) {
        console.error('Add team member error:', err);
        res.status(500).json({ error: 'Failed to add team member.' });
    }
});

// GET /api/teams/:id - Get team details
router.get('/:id', auth, async (req, res) => {
    try {
        const teamId = Number(req.params.id);
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: {
                creator: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                members: {
                    include: {
                        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, profession: true } }
                    }
                }
            }
        });

        if (!team) return res.status(404).json({ error: 'Team not found.' });
        
        // Ensure user is member
        if (!team.members.some(m => m.userId === req.user.id)) {
             return res.status(403).json({ error: 'Not a team member.' });
        }

        res.json(team);
    } catch (err) {
        console.error('Get team error:', err);
        res.status(500).json({ error: 'Failed to fetch team details.' });
    }
});

export default router;
