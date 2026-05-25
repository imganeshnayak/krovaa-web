import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { auth } from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';
import multer from 'multer';
import { sendUserNotification } from './notifications.js';

const prisma = new PrismaClient();
const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024,
        files: 10,
    },
});

const uploadJobAttachments = (req, res, next) => {
    upload.array('attachments', 10)(req, res, (err) => {
        if (!err) {
            return next();
        }

        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Each attachment must be 20MB or smaller.' });
        }

        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ error: 'You can upload up to 10 attachments.' });
        }

        console.error('Job attachment upload error:', err);
        return res.status(400).json({ error: 'Unable to process uploaded files.' });
    });
};

const uploadFileToCloudinary = (file) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
        {
            folder: 'krovaa/jobs',
            resource_type: 'auto',
            access_mode: 'public',
        },
        (error, result) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(result);
        }
    );

    stream.end(file.buffer);
});

const destroyUploadedFile = async (publicId, resourceType) => {
    if (!publicId) {
        return;
    }

    try {
        await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType || 'auto',
        });
    } catch (error) {
        console.error('Failed to clean up uploaded job attachment:', error);
    }
};

// GET /api/jobs
router.get('/', async (req, res) => {
    try {
        const jobs = await prisma.job.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                attachments: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });

        res.json(jobs);
    } catch (err) {
        console.error('Get jobs error:', err);
        res.status(500).json({ error: 'Failed to fetch jobs.' });
    }
});

// GET /api/jobs/my
router.get('/my', auth, async (req, res) => {
    try {
        const jobs = await prisma.job.findMany({
            where: { postedById: req.user.id },
            orderBy: { createdAt: 'desc' },
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
                },
                attachments: {
                    orderBy: { sortOrder: 'asc' },
                },
                _count: {
                    select: { applications: true }
                },
                applications: {
                    select: {
                        id: true,
                        userId: true,
                        status: true,
                        createdAt: true,
                        bidAmount: true,
                        coverLetter: true,
                        user: {
                            select: {
                                id: true,
                                username: true,
                                displayName: true,
                                avatarUrl: true,
                                profession: true,
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' },
                }
            }
        });

        const jobsWithStats = jobs.map(job => ({
            ...job,
            applicationCount: job._count.applications,
            _count: undefined,
        }));

        res.json(jobsWithStats);
    } catch (err) {
        console.error('Get my jobs error:', err);
        res.status(500).json({ error: 'Failed to fetch your jobs.' });
    }
});

// PUT /api/jobs/:id
router.put('/:id', auth, async (req, res) => {
    try {
        const jobId = Number(req.params.id);
        if (Number.isNaN(jobId)) {
            return res.status(400).json({ error: 'Invalid job ID.' });
        }

        const job = await prisma.job.findUnique({
            where: { id: jobId }
        });

        if (!job) {
            return res.status(404).json({ error: 'Job not found.' });
        }

        if (job.postedById !== req.user.id) {
            return res.status(403).json({ error: 'You can only edit your own job listings.' });
        }

        const { title, company, location, budget, mode, description } = req.body;

        const updateData = {};
        if (title !== undefined) updateData.title = title.trim();
        if (company !== undefined) updateData.company = company.trim();
        if (location !== undefined) updateData.location = location.trim();
        if (budget !== undefined) updateData.budget = budget.trim();
        if (mode !== undefined) {
            const normalizedMode = mode.trim();
            const validModes = ['Remote', 'Hybrid', 'Onsite'];
            if (!validModes.includes(normalizedMode)) {
                return res.status(400).json({ error: `Mode must be one of: ${validModes.join(', ')}.` });
            }
            updateData.mode = normalizedMode;
        }
        if (description !== undefined) updateData.description = description.trim();

        const updatedJob = await prisma.job.update({
            where: { id: jobId },
            data: updateData,
            include: {
                attachments: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });

        res.json(updatedJob);
    } catch (err) {
        console.error('Update job error:', err);
        res.status(500).json({ error: 'Failed to update job listing.' });
    }
});

// DELETE /api/jobs/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const jobId = Number(req.params.id);
        if (Number.isNaN(jobId)) {
            return res.status(400).json({ error: 'Invalid job ID.' });
        }

        const job = await prisma.job.findUnique({
            where: { id: jobId },
            include: { attachments: true }
        });

        if (!job) {
            return res.status(404).json({ error: 'Job not found.' });
        }

        if (job.postedById !== req.user.id) {
            return res.status(403).json({ error: 'You can only delete your own job listings.' });
        }

        // Delete attachments from Cloudinary
        for (const attachment of job.attachments) {
            if (attachment.publicId) {
                await destroyUploadedFile(attachment.publicId, attachment.resourceType);
            }
        }

        await prisma.job.delete({
            where: { id: jobId }
        });

        res.json({ message: 'Job listing deleted successfully.' });
    } catch (err) {
        console.error('Delete job error:', err);
        res.status(500).json({ error: 'Failed to delete job listing.' });
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
                attachments: {
                    orderBy: { sortOrder: 'asc' },
                },
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

        // Parse optional auth token to detect ownership and application status
        let reqUser = req.user;
        if (!reqUser) {
            const authHeader = req.header('Authorization');
            const token = authHeader?.replace('Bearer ', '');
            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    reqUser = decoded;
                } catch (err) {
                    // Ignore invalid token
                }
            }
        }

        // If user is authenticated, check their application status and if they own it
        if (reqUser) {
            const application = await prisma.application.findUnique({
                where: {
                    jobId_userId: {
                        jobId,
                        userId: reqUser.id
                    }
                }
            });

            jobWithStatus.hasApplied = !!application;
            jobWithStatus.isOwner = job.postedById === reqUser.id;

            // If owner, fetch and include all applications
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
            // If user has applied but is not owner, include their own application
            else if (jobWithStatus.hasApplied) {
                const userApplication = await prisma.application.findUnique({
                    where: {
                        jobId_userId: {
                            jobId,
                            userId: reqUser.id
                        }
                    },
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
                    }
                });
                // Add user's application to applications array for frontend access
                jobWithStatus.applications = userApplication ? [userApplication] : [];
            }
        }

        res.json(jobWithStatus);
    } catch (err) {
        console.error('Get job by id error:', err);
        res.status(500).json({ error: 'Failed to fetch job details.' });
    }
});

// POST /api/jobs
router.post('/', auth, uploadJobAttachments, async (req, res) => {
    try {
        const { title, company, location, budget, mode, description, terms, termsAndConditions } = req.body;
        if (!title || !company || !location || !budget || !description) {
            return res.status(400).json({ error: 'Title, company, location, budget, and description are required.' });
        }

        const normalizedMode = (mode || 'Remote').trim();
        const validModes = ['Remote', 'Hybrid', 'Onsite'];
        if (!validModes.includes(normalizedMode)) {
            return res.status(400).json({ error: `Mode must be one of: ${validModes.join(', ')}.` });
        }

        const termsData = terms || termsAndConditions;
        const termsArray = Array.isArray(termsData)
            ? termsData.map(t => typeof t === 'string' ? t.trim() : '').filter(Boolean)
            : (typeof termsData === 'string' && termsData.trim() ? [termsData.trim()] : []);

        const files = Array.isArray(req.files) ? req.files : [];
        const uploadedFiles = [];

        for (const [index, file] of files.entries()) {
            const uploadResult = await uploadFileToCloudinary(file);
            uploadedFiles.push({
                fileName: file.originalname,
                fileUrl: uploadResult.secure_url,
                publicId: uploadResult.public_id,
                mimeType: file.mimetype,
                fileSize: file.size,
                sortOrder: index,
                resourceType: uploadResult.resource_type,
            });
        }

        const job = await prisma.$transaction(async (tx) => {
            return tx.job.create({
                data: {
                    title: title.trim(),
                    company: company.trim(),
                    location: location.trim(),
                    budget: budget.trim(),
                    mode: normalizedMode,
                    description: description.trim(),
                    terms: termsArray,
                    postedById: req.user.id,
                    attachments: uploadedFiles.length > 0 ? {
                        create: uploadedFiles.map((attachment) => ({
                            fileName: attachment.fileName,
                            fileUrl: attachment.fileUrl,
                            publicId: attachment.publicId,
                            mimeType: attachment.mimeType,
                            fileSize: attachment.fileSize,
                            sortOrder: attachment.sortOrder,
                        })),
                    } : undefined,
                },
                include: {
                    attachments: {
                        orderBy: { sortOrder: 'asc' },
                    },
                },
            });
        });

        res.status(201).json(job);
    } catch (err) {
        console.error('Create job error:', err);

        const files = Array.isArray(req.files) ? req.files : [];
        if (files.length > 0) {
            await Promise.allSettled(files.map((file) => destroyUploadedFile(file.public_id, file.resource_type)));
        }

        res.status(500).json({ error: 'Failed to create job listing.' });
    }
});

// POST /api/jobs/:id/apply
router.post('/:id/apply', auth, async (req, res) => {
    try {
        const jobId = Number(req.params.id);
        const { bidAmount, deliveryTime, coverLetter, teamId } = req.body;
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

        // Check if already applied (simplified: check user or team)
        const whereClause = teamId 
            ? { jobId, teamId }
            : { jobId, userId };

        const existingApplication = await prisma.application.findFirst({
            where: whereClause
        });

        if (existingApplication) {
            return res.status(400).json({ error: 'You or your team have already applied for this job.' });
        }

        const termsString = Array.isArray(termsAndConditions)
            ? termsAndConditions.join('\n')
            : typeof termsAndConditions === 'string'
                ? termsAndConditions
                : '';

        const termsString = Array.isArray(termsAndConditions)
            ? termsAndConditions.join('\n')
            : typeof termsAndConditions === 'string'
                ? termsAndConditions
                : '';

        // Create application
        const application = await prisma.application.create({
            data: {
                jobId,
                userId,
                status: 'pending',
                bidAmount: bidAmount ? parseFloat(bidAmount) : null,
                coverLetter: coverLetter || null,
                terms: termsString || null
            }
        });

        // Send a message to the job poster automatically
        const chatId = `chat_${userId}_${job.postedById}_${Date.now()}`;
        let applicationMessage = `Hi, I applied for your job: **${job.title}** at ${job.company}.`;
        if (bidAmount) {
            applicationMessage += `\n\n**Bid Amount:** ₹${bidAmount}`;
        }
        if (coverLetter) {
            applicationMessage += `\n\n**Cover Letter:**\n${coverLetter}`;
        }
        if (termsString) {
            applicationMessage += `\n\n**Terms and Conditions:**\n${termsString}`;
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

// PUT /api/jobs/:id/terms
router.put('/:id/terms', auth, async (req, res) => {
    try {
        const jobId = Number(req.params.id);
        if (Number.isNaN(jobId)) {
            return res.status(400).json({ error: 'Invalid job ID.' });
        }

        const { terms } = req.body;
        if (!Array.isArray(terms)) {
            return res.status(400).json({ error: 'Terms must be an array of strings.' });
        }

        const job = await prisma.job.findUnique({
            where: { id: jobId }
        });

        if (!job) {
            return res.status(404).json({ error: 'Job not found.' });
        }

        if (job.postedById !== req.user.id) {
            return res.status(403).json({ error: 'You are not authorized to update this job\'s terms.' });
        }

        const filteredTerms = terms.map(t => typeof t === 'string' ? t.trim() : '').filter(Boolean);

        const updatedJob = await prisma.job.update({
            where: { id: jobId },
            data: {
                terms: filteredTerms
            }
        });

        res.json(updatedJob);
    } catch (err) {
        console.error('Update job terms error:', err);
        res.status(500).json({ error: 'Failed to update job terms.' });
    }
});

export default router;
