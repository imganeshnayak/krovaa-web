import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { sendUserNotification } from './notifications.js';

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/jobs
router.get('/', async (req, res) => {
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
router.get('/:id', async (req, res) => {
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

        const jobWithStatus = {
            ...job,
            hasApplied: false,
            isOwner: false,
            applications: []
        };

        // If user is authenticated, check their application status and if they own it
        if (req.user) {
            const application = await prisma.application.findUnique({
                where: {
                    jobId_userId: {
                        jobId,
                        userId: req.user.id
                    }
                }
            });

            jobWithStatus.hasApplied = !!application;
            jobWithStatus.isOwner = job.postedById === req.user.id;

            // If owner, fetch and include applications
            if (jobWithStatus.isOwner) {
                const applications = await prisma.application.findMany({
                    where: { jobId },
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                displayName: true,
                                avatarUrl: true,
                                profession: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                });
                jobWithStatus.applications = applications;
            }
        }

        res.json(jobWithStatus);
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

// POST /api/jobs/:id/apply
router.post('/:id/apply', auth, async (req, res) => {
    try {
        const jobId = Number(req.params.id);
        if (Number.isNaN(jobId)) {
            return res.status(400).json({ error: 'Invalid job ID.' });
        }

        const userId = req.user.id;
        const { termsAndConditions } = req.body;

        // Check if job exists
        const job = await prisma.job.findUnique({
            where: { id: jobId }
        });

        if (!job) {
            return res.status(404).json({ error: 'Job not found.' });
        }

        // Prevent users from applying to their own job
        if (job.postedById === userId) {
            return res.status(400).json({ error: 'You cannot apply to your own job listing.' });
        }

        // Check if already applied
        const existingApplication = await prisma.application.findUnique({
            where: {
                jobId_userId: {
                    jobId,
                    userId
                }
            }
        });

        if (existingApplication) {
            return res.status(400).json({ error: 'You have already applied for this job.' });
        }

        // Create application
        const application = await prisma.application.create({
            data: {
                jobId,
                userId,
                status: 'pending',
                terms: termsAndConditions
            }
        });

        // Send a message to the job poster automatically
        const chatId = `chat_${userId}_${job.postedById}_${Date.now()}`;
        let applicationMessage = `Hi, I just applied for your job: **${job.title}** at ${job.company}.`;
        if (termsAndConditions) {
            applicationMessage += `\n\n**Terms and Conditions:**\n${termsAndConditions}`;
        }

        const message = await prisma.message.create({
            data: {
                senderId: userId,
                receiverId: job.postedById,
                chatId: chatId,
                content: applicationMessage,
                messageType: 'text'
            },
            include: {
                sender: { select: { displayName: true, avatarUrl: true, username: true, role: true } }
            }
        });

        // Notify via Socket.IO
        const io = req.app.get('io');
        if (io) {
            const socketMessage = {
                ...message,
                sender_name: message.sender.displayName,
                sender_avatar: message.sender.avatarUrl,
                sender_username: message.sender.username,
            };
            io.to(chatId).emit('newMessage', socketMessage);
            io.to(`user_${job.postedById}`).emit('newMessage', socketMessage);
            
            // Also send a system notification (bell icon)
            const applicant = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true, username: true } });
            const applicantName = applicant?.displayName || applicant?.username || 'Someone';
            await sendUserNotification(
                io, 
                job.postedById, 
                "New Job Application", 
                `${applicantName} has applied for your job: ${job.title}`, 
                'info',
                { jobId: job.id }
            );
        }

        res.status(201).json({
            message: 'Application submitted successfully and message sent to poster.',
            application
        });
    } catch (err) {
        console.error('Apply for job error:', err);
        res.status(500).json({ error: 'Failed to submit application.' });
    }
});

export default router;
