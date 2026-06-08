import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { sendUserNotification } from './notifications.js';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';

const prisma = new PrismaClient();
const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024,
        files: 10,
    },
});

const uploadCollabAttachments = (req, res, next) => {
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

        console.error('Collab attachment upload error:', err);
        return res.status(400).json({ error: 'Unable to process uploaded files.' });
    });
};

const uploadFileToCloudinary = (file) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
        {
            folder: 'krovaa/collab',
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

// CREATE: POST /api/collab
router.post('/', auth, uploadCollabAttachments, async (req, res) => {
    try {
        const { title, description, baseBudget, mode, singleVendorId, chatId, seats, milestones, tags, company, location, duration, deadline, terms } = req.body;
        
        // Input validation
        if (!title || !baseBudget) return res.status(400).json({ error: 'Title and baseBudget are required' });

        // Parse JSON fields from form data
        const parsedSeats = typeof seats === 'string' ? JSON.parse(seats) : (seats || []);
        const parsedMilestones = typeof milestones === 'string' ? JSON.parse(milestones) : (milestones || []);
        const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : (tags || []);
        const parsedTerms = typeof terms === 'string' ? JSON.parse(terms) : (terms || []);

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

        const project = await prisma.projectListing.create({
            data: {
                title,
                description: description || '',
                baseBudget: parseFloat(baseBudget),
                mode: mode || 'GROUP',
                tags: parsedTags,
                company: company || null,
                location: location || null,
                duration: duration || null,
                deadline: deadline ? new Date(deadline) : null,
                terms: parsedTerms,
                creatorId: req.user.id,
                singleVendorId: singleVendorId ? parseInt(singleVendorId) : null,
                chatId: chatId || null,
                status: 'AUCTION_ACTIVE',
                attachments: uploadedFiles.length > 0 ? {
                    create: uploadedFiles.map((attachment) => ({
                        fileName: attachment.fileName,
                        fileUrl: attachment.fileUrl,
                        publicId: attachment.publicId,
                        mimeType: attachment.mimeType,
                        fileSize: attachment.fileSize,
                        sortOrder: attachment.sortOrder,
                        resourceType: attachment.resourceType,
                    }))
                } : undefined
            }
        });

        if (mode === 'GROUP' || !mode) { // GROUP is default
            // Create seats
            if (parsedSeats && Array.isArray(parsedSeats)) {
                for (const seatDef of parsedSeats) {
                    const count = seatDef.amount || 1;
                    for (let i = 0; i < count; i++) {
                        await prisma.groupSeat.create({
                            data: {
                                projectId: project.id,
                                roleName: seatDef.roleName,
                                splitPercent: parseFloat(seatDef.splitPercent)
                            }
                        });
                    }
                }
            }

            // Create milestones
            if (parsedMilestones && Array.isArray(parsedMilestones)) {
                for (const ms of parsedMilestones) {
                    await prisma.groupMilestone.create({
                        data: {
                            projectId: project.id,
                            title: ms.title,
                            amount: parseFloat(ms.amount)
                        }
                    });
                }
            }
        }

        res.json(project);
    } catch (err) {
        console.error('Error creating collab project:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// LIST: GET /api/collab
router.get('/', auth, async (req, res) => {
    try {
        const { status, mode } = req.query;
        const where = {};
        if (status) where.status = status;
        if (mode) where.mode = mode;
        
        // Usually explore page wants active group auctions
        if (!status) where.status = 'AUCTION_ACTIVE';

        const projects = await prisma.projectListing.findMany({
            where,
            include: {
                creator: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                seats: {
                    include: {
                        bids: { select: { id: true } } // just to get bid count
                    }
                },
                milestones: true,
                attachments: true
            },
            orderBy: { createdAt: 'desc' }
        });
        
        // Add bid counts to seats
        const formattedProjects = projects.map(p => ({
            ...p,
            seats: p.seats.map(s => ({
                ...s,
                bidCount: s.bids.length
            }))
        }));

        res.json(formattedProjects);
    } catch (err) {
        console.error('Error listing collab projects:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET MY PROJECTS: GET /api/collab/my
router.get('/my', auth, async (req, res) => {
    try {
        const projects = await prisma.projectListing.findMany({
            where: {
                OR: [
                    { creatorId: req.user.id },
                    { singleVendorId: req.user.id },
                    { seats: { some: { userId: req.user.id, status: 'OCCUPIED' } } }
                ]
            },
            include: {
                creator: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                seats: {
                    include: {
                        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                        bids: { include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } } }
                    }
                },
                milestones: true,
                attachments: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(projects);
    } catch (err) {
        console.error('Error getting my collab projects:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/collab/saved - Get saved collab projects
router.get('/saved', auth, async (req, res) => {
    try {
        const saved = await prisma.savedProjectListing.findMany({
            where: { userId: req.user.id },
            include: {
                project: {
                    include: {
                        creator: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                        seats: {
                            include: {
                                user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                                bids: { include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } } }
                            }
                        },
                        milestones: true,
                        attachments: true,
                        savedBy: {
                            where: { userId: req.user.id }
                        }
                    }
                }
            },
            orderBy: { savedAt: 'desc' }
        });
        
        // Map the results to just return the project with hasSaved property
        const projects = saved.map(s => ({
            ...s.project,
            hasSaved: true
        }));
        
        res.json(projects);
    } catch (err) {
        console.error('Error getting saved collab projects:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET SINGLE: GET /api/collab/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const project = await prisma.projectListing.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                creator: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                collabCommunity: true,
                seats: {
                    include: {
                        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                        bids: {
                            include: {
                                user: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
                            }
                        }
                    }
                },
                milestones: true,
                attachments: true
            }
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });
        
        // Check if the user has saved this project
        const hasSaved = await prisma.savedProjectListing.findFirst({
            where: { userId: req.user.id, projectId: project.id }
        });
        
        res.json({
            ...project,
            hasSaved: !!hasSaved
        });
    } catch (err) {
        console.error('Error getting single collab project:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/collab/:id/save - Save a collab project
router.post('/:id/save', auth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const project = await prisma.projectListing.findUnique({ where: { id: projectId } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const existing = await prisma.savedProjectListing.findUnique({
            where: { userId_projectId: { userId: req.user.id, projectId } }
        });

        if (existing) return res.json({ message: 'Already saved', saved: true });

        await prisma.savedProjectListing.create({
            data: { userId: req.user.id, projectId }
        });
        res.json({ message: 'Saved successfully', saved: true });
    } catch (err) {
        console.error('Error saving collab project:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/collab/:id/unsave - Unsave a collab project
router.delete('/:id/unsave', auth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        await prisma.savedProjectListing.deleteMany({
            where: { userId: req.user.id, projectId }
        });
        res.json({ message: 'Unsaved successfully', saved: false });
    } catch (err) {
        console.error('Error unsaving collab project:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// SUBMIT BID: POST /api/collab/:id/bids?seatId=123
router.post('/:id/bids', auth, async (req, res) => {
    try {
        const { seatId } = req.query;
        const { bidAmount, proposalPitch } = req.body;
        
        if (!seatId || !bidAmount) return res.status(400).json({ error: 'seatId and bidAmount are required' });

        const seat = await prisma.groupSeat.findUnique({ where: { id: parseInt(seatId) } });
        if (!seat || seat.projectId !== parseInt(req.params.id)) return res.status(404).json({ error: 'Seat not found' });
        if (seat.status === 'OCCUPIED') return res.status(400).json({ error: 'Seat already occupied' });

        // Get user rating
        const userRatingAgg = await prisma.userRating.aggregate({
            where: { reviewedId: req.user.id },
            _avg: { rating: true }
        });
        const rating = userRatingAgg._avg.rating || 0;

        const bid = await prisma.seatBid.upsert({
            where: {
                seatId_userId: {
                    seatId: parseInt(seatId),
                    userId: req.user.id
                }
            },
            update: {
                bidAmount: parseFloat(bidAmount),
                proposalPitch: proposalPitch || '',
                userRatingAtTime: rating,
                status: 'PENDING'
            },
            create: {
                seatId: parseInt(seatId),
                userId: req.user.id,
                bidAmount: parseFloat(bidAmount),
                proposalPitch: proposalPitch || '',
                userRatingAtTime: rating
            }
        });

        // Update seat status if vacant
        if (seat.status === 'VACANT') {
            await prisma.groupSeat.update({
                where: { id: parseInt(seatId) },
                data: { status: 'APPLIED' }
            });
        }

        // Notify project creator
        const project = await prisma.projectListing.findUnique({ where: { id: parseInt(req.params.id) } });
        if (project && project.creatorId !== req.user.id) {
            await sendUserNotification(project.creatorId, 'New bid received', `Someone placed a bid on seat: ${seat.roleName}`);
        }

        res.json(bid);
    } catch (err) {
        console.error('Error submitting bid:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ACCEPT BID: PUT /api/collab/:id/seats/:seatId/accept/:bidId
router.put('/:id/seats/:seatId/accept/:bidId', auth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const seatId = parseInt(req.params.seatId);
        const bidId = parseInt(req.params.bidId);

        const project = await prisma.projectListing.findUnique({
            where: { id: projectId },
            include: { seats: true }
        });

        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (project.creatorId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
        if (project.status !== 'AUCTION_ACTIVE') return res.status(400).json({ error: 'Project not in auction phase' });

        const seat = project.seats.find(s => s.id === seatId);
        if (!seat) return res.status(404).json({ error: 'Seat not found' });
        if (seat.status === 'OCCUPIED') return res.status(400).json({ error: 'Seat already occupied' });

        const bid = await prisma.seatBid.findUnique({ where: { id: bidId } });
        if (!bid || bid.seatId !== seatId) return res.status(404).json({ error: 'Bid not found' });

        await prisma.$transaction(async (tx) => {
            // 1. Mark bid as accepted
            await tx.seatBid.update({
                where: { id: bidId },
                data: { status: 'ACCEPTED' }
            });

            // 2. Reject other bids for this seat
            await tx.seatBid.updateMany({
                where: { seatId, id: { not: bidId } },
                data: { status: 'REJECTED' }
            });

            // 3. Occupy seat
            await tx.groupSeat.update({
                where: { id: seatId },
                data: {
                    status: 'OCCUPIED',
                    userId: bid.userId
                }
            });

            // 4. Check if all seats are occupied, if so -> transition project to FUNDING_PENDING
            const updatedSeats = await tx.groupSeat.findMany({ where: { projectId } });
            const allOccupied = updatedSeats.every(s => s.status === 'OCCUPIED');
            
            if (allOccupied) {
                await tx.projectListing.update({
                    where: { id: projectId },
                    data: { status: 'FUNDING_PENDING' }
                });
                
                // Notify creator to fund
                await sendUserNotification(project.creatorId, 'Squad Assembled!', 'All seats are filled. Fund the project to launch your Collab Space.');
            }
            
            // Notify accepted user
            await sendUserNotification(bid.userId, 'Bid Accepted!', `Your bid for ${seat.roleName} was accepted.`);
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Error accepting bid:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// FUND ESCROW & LAUNCH WORKSPACE: POST /api/collab/:id/fund
router.post('/:id/fund', auth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const project = await prisma.projectListing.findUnique({
            where: { id: projectId },
            include: { seats: { include: { bids: { where: { status: 'ACCEPTED' } } } } }
        });

        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (project.creatorId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
        if (project.status !== 'FUNDING_PENDING' && project.mode === 'GROUP') return res.status(400).json({ error: 'Project not ready for funding' });

        let totalToDeduct = project.baseBudget; // Max budget

        // Check wallet
        const client = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (client.walletBalance < totalToDeduct) {
            return res.status(400).json({ error: 'Insufficient wallet balance', required: totalToDeduct });
        }

        await prisma.$transaction(async (tx) => {
            // 1. Deduct from client
            await tx.user.update({
                where: { id: req.user.id },
                data: { walletBalance: { decrement: totalToDeduct } }
            });

            // Log tx
            await tx.transaction.create({
                data: {
                    userId: req.user.id,
                    type: 'debit',
                    label: 'Project Escrow Funding',
                    amount: totalToDeduct,
                    description: `Funded Collab Project: ${project.title}`,
                    relatedModel: 'ProjectListing',
                    relatedId: String(project.id)
                }
            });

            let communityId = null;

            // 2. If GROUP, spawn Collab Space (Community)
            if (project.mode === 'GROUP') {
                const community = await tx.community.create({
                    data: {
                        name: `Collab: ${project.title}`,
                        slug: `collab-${project.id}-${Date.now()}`,
                        description: project.description,
                        isPrivate: true,
                        creatorId: req.user.id
                    }
                });
                communityId = community.id;

                // Add creator to community
                await tx.communityMember.create({
                    data: {
                        communityId,
                        userId: req.user.id,
                        role: 'ADMIN',
                        status: 'approved'
                    }
                });

                // Add seat occupants to community
                for (const seat of project.seats) {
                    if (seat.userId) {
                        await tx.communityMember.upsert({
                            where: { communityId_userId: { communityId, userId: seat.userId } },
                            update: {},
                            create: {
                                communityId,
                                userId: seat.userId,
                                role: 'MEMBER',
                                status: 'approved'
                            }
                        });
                        
                        // Notify occupant
                        // Note: Prisma transaction doesn't allow calling non-transactional async functions safely without side-effects risk, 
                        // but sendUserNotification is safe enough.
                        await sendUserNotification(seat.userId, 'Workspace Launched', `Escrow funded! You've been added to the Collab Space for ${project.title}`);
                    }
                }
            }

            // 3. Update project status
            await tx.projectListing.update({
                where: { id: projectId },
                data: { 
                    status: 'ACTIVE_WORKSPACE',
                    collabCommunityId: communityId
                }
            });
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Error funding project:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// RELEASE MILESTONE ESCROW: POST /api/collab/:id/milestones/:milestoneId/release
router.post('/:id/milestones/:milestoneId/release', auth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const milestoneId = parseInt(req.params.milestoneId);

        const project = await prisma.projectListing.findUnique({
            where: { id: projectId },
            include: { seats: true, milestones: true }
        });

        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (project.creatorId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
        if (project.status !== 'ACTIVE_WORKSPACE') return res.status(400).json({ error: 'Project not active' });

        const milestone = project.milestones.find(m => m.id === milestoneId);
        if (!milestone) return res.status(404).json({ error: 'Milestone not found' });
        if (milestone.isReleased) return res.status(400).json({ error: 'Milestone already released' });

        let systemMessage = null;
        await prisma.$transaction(async (tx) => {
            if (project.mode === 'SINGLE') {
                if (project.singleVendorId) {
                    await tx.user.update({
                        where: { id: project.singleVendorId },
                        data: { walletBalance: { increment: milestone.amount } }
                    });

                    await tx.transaction.create({
                        data: {
                            userId: project.singleVendorId,
                            type: 'credit',
                            label: 'Milestone Released',
                            amount: milestone.amount,
                            description: `Milestone release: ${milestone.title}`,
                            relatedModel: 'ProjectListing',
                            relatedId: String(project.id)
                        }
                    });
                }
            } else if (project.mode === 'GROUP') {
                const payouts = [];
                for (const seat of project.seats) {
                    if (seat.status === 'OCCUPIED' && seat.userId) {
                        const payoutAmount = milestone.amount * (seat.splitPercent / 100);
                        if (payoutAmount > 0) {
                            await tx.user.update({
                                where: { id: seat.userId },
                                data: { walletBalance: { increment: payoutAmount } }
                            });

                            await tx.transaction.create({
                                data: {
                                    userId: seat.userId,
                                    type: 'credit',
                                    label: 'Collab Milestone Released',
                                    amount: payoutAmount,
                                    description: `Milestone release: ${milestone.title} (${seat.splitPercent}%)`,
                                    relatedModel: 'ProjectListing',
                                    relatedId: String(project.id)
                                }
                            });
                            
                            payouts.push({ userId: seat.userId, amount: payoutAmount });
                        }
                    }
                }

                // Append system receipt log to community chat
                if (project.collabCommunityId) {
                    const messageContent = `💰 Milestone Released: ${milestone.title} (₹${milestone.amount})`;
                    systemMessage = await tx.communityMessage.create({
                        data: {
                            communityId: project.collabCommunityId,
                            senderId: req.user.id, // client
                            content: messageContent,
                            messageType: 'system'
                        }
                    });
                    
                    // Notify each recipient
                    for (const p of payouts) {
                         await sendUserNotification(p.userId, 'Milestone Released!', `You received ₹${p.amount} from milestone ${milestone.title}`);
                    }
                }
            }

            // Mark milestone as released
            await tx.groupMilestone.update({
                where: { id: milestoneId },
                data: { isReleased: true }
            });

            // Check if all milestones released -> COMPLETED
            const remaining = project.milestones.filter(m => m.id !== milestoneId && !m.isReleased);
            if (remaining.length === 0) {
                await tx.projectListing.update({
                    where: { id: projectId },
                    data: { status: 'COMPLETED' }
                });
            }
        });

        if (systemMessage && project.collabCommunityId) {
            const io = req.app.get('io');
            if (io) {
                const fullMsg = await prisma.communityMessage.findUnique({
                    where: { id: systemMessage.id },
                    include: { sender: true }
                });
                if (fullMsg) {
                    const socketMessage = {
                        ...fullMsg,
                        chatId: `community_${project.collabCommunityId}`,
                        senderId: fullMsg.senderId,
                        sender_name: fullMsg.sender?.displayName,
                        sender_avatar: fullMsg.sender?.avatarUrl,
                        sender_username: fullMsg.sender?.username,
                    };
                    io.to(`community_${project.collabCommunityId}`).emit('newMessage', socketMessage);
                }
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error releasing milestone:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE PROJECT: DELETE /api/collab/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const project = await prisma.projectListing.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (project.creatorId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
        if (project.status === 'ACTIVE_WORKSPACE' || project.status === 'COMPLETED') {
            return res.status(400).json({ error: 'Cannot delete active or completed project' });
        }

        await prisma.projectListing.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting project:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// UPDATE PROJECT: PUT /api/collab/:id
router.put('/:id', auth, async (req, res) => {
    try {
        const { title, description, company, location, workMode, duration, deadline, skills, terms } = req.body;
        
        const project = await prisma.projectListing.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (project.creatorId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
        
        const parsedTags = skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : [];
        const parsedTerms = terms ? terms.split('\n').map(t => t.trim()).filter(Boolean) : [];
        const finalLocation = workMode === "Remote" ? "Remote" : location;

        // Ensure we don't update fields that shouldn't be updated when bids are active, though here we just update basic string fields
        const updated = await prisma.projectListing.update({
            where: { id: parseInt(req.params.id) },
            data: {
                title,
                description,
                company,
                location: finalLocation,
                duration,
                deadline: deadline ? new Date(deadline) : null,
                tags: parsedTags,
                terms: parsedTerms
            }
        });

        res.json(updated);
    } catch (err) {
        console.error('Error updating collab project:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
