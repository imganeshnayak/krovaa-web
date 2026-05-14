import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/jobs
router.get('/', auth, async (req, res) => {
    try {
        const jobs = await prisma.job.findMany({
            orderBy: { createdAt: 'desc' }
        });

        res.json(jobs);
    } catch (err) {
        console.error('Get jobs error:', err);
        res.status(500).json({ error: 'Failed to fetch jobs.' });
    }
});

// GET /api/jobs/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const jobId = Number(req.params.id);
        if (Number.isNaN(jobId)) {
            return res.status(400).json({ error: 'Invalid job ID.' });
        }

        const job = await prisma.job.findUnique({
            where: { id: jobId },
            include: {
                postedBy: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatarUrl: true,
                        profession: true,
                        bio: true,
                        city: true,
                        createdAt: true,
                    }
                }
            }
        });

        if (!job) {
            return res.status(404).json({ error: 'Job not found.' });
        }

        res.json(job);
    } catch (err) {
        console.error('Get job by id error:', err);
        res.status(500).json({ error: 'Failed to fetch job details.' });
    }
});

// POST /api/jobs
router.post('/', auth, async (req, res) => {
    try {
        const { title, company, location, budget, mode, description } = req.body;
        if (!title || !company || !location || !budget || !description) {
            return res.status(400).json({ error: 'Title, company, location, budget, and description are required.' });
        }

        const normalizedMode = (mode || 'Remote').trim();
        const validModes = ['Remote', 'Hybrid', 'Onsite'];
        if (!validModes.includes(normalizedMode)) {
            return res.status(400).json({ error: `Mode must be one of: ${validModes.join(', ')}.` });
        }

        const job = await prisma.job.create({
            data: {
                title: title.trim(),
                company: company.trim(),
                location: location.trim(),
                budget: budget.trim(),
                mode: normalizedMode,
                description: description.trim(),
                postedById: req.user.id,
            },
        });

        res.status(201).json(job);
    } catch (err) {
        console.error('Create job error:', err);
        res.status(500).json({ error: 'Failed to create job listing.' });
    }
});

export default router;
