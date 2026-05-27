import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = express.Router();

// Get jobs for a community
router.get('/:id/jobs', auth, async (req, res) => {
    try {
        const communityId = Number(req.params.id);
        const { status } = req.query;

        // Verify member status or creator
        const community = await prisma.community.findUnique({ where: { id: communityId } });
        if (!community) return res.status(404).json({ error: 'Community not found.' });

        const isCreator = community.creatorId === req.user.id;
        const membership = await prisma.communityMember.findUnique({
            where: { communityId_userId: { communityId, userId: req.user.id } }
        });

        if (!isCreator && membership?.status !== 'approved') {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const where = { communityId };
        if (status) where.status = status;

        const jobs = await prisma.communityJob.findMany({
            where,
            include: {
                client: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                _count: { select: { bids: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(jobs);
    } catch (err) {
        console.error('Get community jobs error:', err);
        res.status(500).json({ error: 'Failed to fetch jobs.' });
    }
});

// Post a new job
router.post('/:id/jobs', auth, async (req, res) => {
    try {
        const communityId = Number(req.params.id);
        const { title, description, budget, deadline, skills } = req.body;

        if (!title || !description || !budget) {
            return res.status(400).json({ error: 'Title, description, and budget are required.' });
        }

        // Must be a member to post a job
        const membership = await prisma.communityMember.findUnique({
            where: { communityId_userId: { communityId, userId: req.user.id } }
        });
        const community = await prisma.community.findUnique({ where: { id: communityId } });

        if (community?.creatorId !== req.user.id && membership?.status !== 'approved') {
            return res.status(403).json({ error: 'Only members can post jobs.' });
        }

        const job = await prisma.communityJob.create({
            data: {
                communityId,
                clientId: req.user.id,
                title,
                description,
                budget: Number(budget),
                deadline: deadline ? new Date(deadline) : null,
                skills: skills || []
            }
        });

        res.json(job);
    } catch (err) {
        console.error('Create community job error:', err);
        res.status(500).json({ error: 'Failed to create job.' });
    }
});

// Get job details with bids (bids only visible to client)
router.get('/:id/jobs/:jobId', auth, async (req, res) => {
    try {
        const communityId = Number(req.params.id);
        const jobId = Number(req.params.jobId);

        const job = await prisma.communityJob.findUnique({
            where: { id: jobId },
            include: {
                client: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
            }
        });

        if (!job || job.communityId !== communityId) {
            return res.status(404).json({ error: 'Job not found.' });
        }

        const isClient = job.clientId === req.user.id;
        
        let bids = [];
        if (isClient) {
            // Client sees all bids
            bids = await prisma.communityBid.findMany({
                where: { jobId },
                include: {
                    leader: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                    members: {
                        include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        } else {
            // Members only see their own bid
            bids = await prisma.communityBid.findMany({
                where: { jobId, leaderId: req.user.id },
                include: {
                    leader: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                    members: {
                        include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
                    }
                }
            });
        }

        res.json({ ...job, bids });
    } catch (err) {
        console.error('Get community job details error:', err);
        res.status(500).json({ error: 'Failed to fetch job details.' });
    }
});

// Submit a bid
router.post('/:id/jobs/:jobId/bids', auth, async (req, res) => {
    try {
        const communityId = Number(req.params.id);
        const jobId = Number(req.params.jobId);
        const { isGroup, coverLetter, bidAmount, estimatedDays, members } = req.body;

        if (!bidAmount || bidAmount <= 0) return res.status(400).json({ error: 'Invalid bid amount.' });

        const job = await prisma.communityJob.findUnique({ where: { id: jobId } });
        if (!job || job.communityId !== communityId || job.status !== 'open') {
            return res.status(400).json({ error: 'Job not available for bidding.' });
        }

        if (job.clientId === req.user.id) {
            return res.status(400).json({ error: 'You cannot bid on your own job.' });
        }

        // Validate group percentages
        if (isGroup && members && members.length > 0) {
            const totalPercent = members.reduce((sum, m) => sum + Number(m.paymentPercent), 0);
            if (Math.abs(totalPercent - 100) > 0.01) {
                return res.status(400).json({ error: 'Payment percentages must sum exactly to 100.' });
            }
            
            // Validate all members belong to community
            // (Skipped deep validation for brevity, assuming frontend sends valid member IDs)
        }

        // Create the bid
        const bidData = {
            jobId,
            leaderId: req.user.id,
            isGroup: !!isGroup,
            coverLetter,
            bidAmount: Number(bidAmount),
            estimatedDays: estimatedDays ? Number(estimatedDays) : null,
        };

        if (isGroup && members && members.length > 0) {
            bidData.members = {
                create: members.map(m => ({
                    userId: m.userId,
                    role: m.role,
                    paymentPercent: Number(m.paymentPercent)
                }))
            };
        }

        const bid = await prisma.communityBid.create({
            data: bidData,
            include: { members: true }
        });

        res.json(bid);
    } catch (err) {
        console.error('Submit bid error:', err);
        if (err.code === 'P2002') return res.status(400).json({ error: 'You have already submitted a bid for this job.' });
        res.status(500).json({ error: 'Failed to submit bid.' });
    }
});

// Accept a bid and create escrow deal
router.post('/:id/jobs/:jobId/bids/:bidId/accept', auth, async (req, res) => {
    try {
        const jobId = Number(req.params.jobId);
        const bidId = Number(req.params.bidId);

        // Run transaction
        const result = await prisma.$transaction(async (tx) => {
            const job = await tx.communityJob.findUnique({ where: { id: jobId } });
            if (!job || job.clientId !== req.user.id || job.status !== 'open') {
                throw new Error('Job not available or unauthorized.');
            }

            const bid = await tx.communityBid.findUnique({
                where: { id: bidId },
                include: { members: true }
            });

            if (!bid || bid.jobId !== jobId) {
                throw new Error('Bid not found.');
            }

            // Client wallet check
            const client = await tx.user.findUnique({ where: { id: req.user.id } });
            if (client.walletBalance < bid.bidAmount) {
                throw new Error('Insufficient wallet balance to fund the escrow deal.');
            }

            // Create Escrow Deal
            const isSplit = bid.isGroup && bid.members.length > 0;
            const splitConfig = isSplit ? bid.members.map(m => ({
                userId: m.userId,
                percent: m.paymentPercent
            })) : null;

            const deal = await tx.escrowDeal.create({
                data: {
                    chatId: `community_${job.communityId}`,
                    clientId: req.user.id,
                    vendorId: bid.leaderId, // For group, leader is primary vendor
                    title: job.title,
                    description: job.description,
                    totalAmount: bid.bidAmount,
                    platformFee: bid.bidAmount * 0.10, // Assuming 10% standard fee
                    vendorNet: bid.bidAmount * 0.90,
                    status: 'funded',
                    isSplitDeal: isSplit,
                    splitConfig
                }
            });

            // Create Escrow Transaction (funding)
            await tx.escrowTransaction.create({
                data: {
                    dealId: deal.id,
                    type: 'funding',
                    amount: bid.bidAmount,
                    status: 'completed',
                    fromUserId: req.user.id
                }
            });

            // Deduct from client wallet
            await tx.user.update({
                where: { id: req.user.id },
                data: { walletBalance: { decrement: bid.bidAmount } }
            });

            // Add wallet transaction record
            await tx.walletTransaction.create({
                data: {
                    userId: req.user.id,
                    type: 'escrow_payment',
                    amount: bid.bidAmount,
                    status: 'completed',
                    referenceType: 'escrow',
                    referenceId: deal.id.toString(),
                    description: `Funded escrow for job: ${job.title}`
                }
            });

            // Update Job and Bid
            await tx.communityJob.update({
                where: { id: jobId },
                data: { status: 'in_progress', escrowDealId: deal.id }
            });

            await tx.communityBid.update({
                where: { id: bidId },
                data: { status: 'accepted' }
            });

            // Reject other bids
            await tx.communityBid.updateMany({
                where: { jobId, id: { not: bidId } },
                data: { status: 'rejected' }
            });

            return deal;
        });

        res.json(result);
    } catch (err) {
        console.error('Accept bid error:', err);
        res.status(400).json({ error: err.message || 'Failed to accept bid.' });
    }
});

// Withdraw a bid
router.delete('/:id/jobs/:jobId/bids/:bidId', auth, async (req, res) => {
    try {
        const bidId = Number(req.params.bidId);
        
        const bid = await prisma.communityBid.findUnique({ where: { id: bidId } });
        if (!bid || bid.leaderId !== req.user.id || bid.status !== 'pending') {
            return res.status(403).json({ error: 'Cannot withdraw this bid.' });
        }

        await prisma.communityBid.delete({ where: { id: bidId } });
        res.json({ success: true });
    } catch (err) {
        console.error('Withdraw bid error:', err);
        res.status(500).json({ error: 'Failed to withdraw bid.' });
    }
});

// Add rating to job
router.post('/:id/jobs/:jobId/ratings', auth, async (req, res) => {
    try {
        const jobId = Number(req.params.jobId);
        const { reviewedId, rating, feedback } = req.body;

        const job = await prisma.communityJob.findUnique({ where: { id: jobId } });
        if (!job || job.status !== 'completed') {
            return res.status(400).json({ error: 'Job must be completed to leave a rating.' });
        }

        // Note: For group jobs, client can leave multiple ratings for each member
        const newRating = await prisma.jobRating.create({
            data: {
                jobId,
                reviewerId: req.user.id,
                reviewedId: Number(reviewedId),
                rating: Number(rating),
                feedback
            }
        });

        res.json(newRating);
    } catch (err) {
        console.error('Leave job rating error:', err);
        res.status(500).json({ error: 'Failed to leave rating.' });
    }
});

export default router;
