import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth, adminOnly } from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';
import multer from 'multer';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed for avatars.'), false);
        }
    }
});

// GET /api/users - List all users (admin only)
router.get('/', auth, adminOnly, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, username: true, email: true, displayName: true, avatarUrl: true, role: true, status: true, verified: true, city: true, pincode: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(users);
    } catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/users/search - Search for users to message
router.get('/search', auth, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 2) {
            return res.json([]);
        }

        const users = await prisma.user.findMany({
            where: {
                AND: [
                    { id: { not: req.user.id } },
                    { status: 'active' },
                    {
                        OR: [
                            { username: { contains: q, mode: 'insensitive' } },
                            { displayName: { contains: q, mode: 'insensitive' } }
                        ]
                    }
                ]
            },
            select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true },
            take: 10
        });

        res.json(users);
    } catch (err) {
        console.error('Search users error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/users/username/:username - Get user profile by username
router.get('/username/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const decodedUsername = decodeURIComponent(username);
        const trimmedUsername = decodedUsername.trim();

        const user = await prisma.user.findFirst({
            where: {
                username: {
                    equals: trimmedUsername,
                    mode: 'insensitive'
                }
            },
            select: {
                id: true,
                username: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                coverPhotoUrl: true,
                socialLinks: true,
                role: true,
                status: true,
                verified: true,
                city: true,          // city (general area) is OK to show
                profession: true,
                skills: true,
                userGoal: true,
                createdAt: true
                // email, pincode, phoneNumber intentionally excluded — private fields
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Hide staff and admin profiles from public/regular users
        // Use req?.user to check if authorized, but this endpoint is public (no auth middleware)
        // If we want to allow admins to see it, we'd need to check auth.
        // For now, let's keep it simple: if it's staff/admin, it's hidden from this public route.
        if (user.role === 'staff' || user.role === 'admin') {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userRatings = await prisma.rating.findMany({
            where: { reviewedId: user.id },
            select: { rating: true }
        });
        const ratings = userRatings.map(r => r.rating);
        const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "0.0";

        res.json({
            ...user,
            averageRating: parseFloat(avgRating),
            ratingCount: ratings.length
        });
    } catch (err) {
        console.error('Get user by username error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/users/share-id/:shareId - Get user profile by share ID or username fallback
router.get('/share-id/:shareId', async (req, res) => {
    try {
        const { shareId } = req.params;

        // Fallback: schema may not have `shareId`. Treat incoming value as username if necessary.
        let user;
        if (/^\d+$/.test(shareId)) {
            user = await prisma.user.findUnique({
                where: { id: parseInt(shareId) },
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    bio: true,
                    avatarUrl: true,
                    coverPhotoUrl: true,
                    socialLinks: true,
                    role: true,
                    status: true,
                    verified: true,
                    city: true,
                    profession: true,
                    skills: true,
                    userGoal: true,
                    createdAt: true,
                    ratingReceived: {
                        select: { rating: true }
                    }
                },
            });
        } else {
            user = await prisma.user.findFirst({
                where: { username: { equals: decodeURIComponent(shareId), mode: 'insensitive' } },
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    bio: true,
                    avatarUrl: true,
                    coverPhotoUrl: true,
                    socialLinks: true,
                    role: true,
                    status: true,
                    verified: true,
                    city: true,
                    profession: true,
                    skills: true,
                    userGoal: true,
                    createdAt: true,
                    ratingReceived: {
                        select: { rating: true }
                    }
                },
            });
        }

        if (!user) {

            return res.status(404).json({ error: 'User not found.' });
        }

        if (user.role === 'staff' || user.role === 'admin') {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userRatings = await prisma.rating.findMany({
            where: { reviewedId: user.id },
            select: { rating: true }
        });
        const ratings = userRatings.map(r => r.rating);
        const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "0.0";

        res.json({
            ...user,
            averageRating: parseFloat(avgRating),
            ratingCount: ratings.length
        });
    } catch (err) {
        console.error('Get user by share ID error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/users/:id/rating-eligibility - Check if user can rate another user
router.get('/:id/rating-eligibility', auth, async (req, res) => {
    try {
        const reviewedUserId = parseInt(req.params.id);
        const reviewerId = req.user.id;

        if (reviewerId === reviewedUserId) {
            return res.json({ canRate: false, reason: "You cannot rate yourself." });
        }

        const [hasSent, hasReceived, escrowDeal] = await Promise.all([
            prisma.message.findFirst({
                where: { senderId: reviewerId, receiverId: reviewedUserId },
                select: { id: true }
            }),
            prisma.message.findFirst({
                where: { senderId: reviewedUserId, receiverId: reviewerId },
                select: { id: true }
            }),
            prisma.escrowDeal.findFirst({
                where: {
                    OR: [
                        { clientId: reviewerId, vendorId: reviewedUserId },
                        { clientId: reviewedUserId, vendorId: reviewerId }
                    ]
                },
                select: { id: true }
            })
        ]);

        if (escrowDeal) {
            return res.json({ canRate: true, reason: null });
        }

        if (!hasSent || !hasReceived) {
            return res.json({ canRate: false, reason: "You can rate only users you have a mutual chat or deal with." });
        }

        return res.json({ canRate: true, reason: null });
    } catch (err) {
        console.error('Rating eligibility error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/users/:id/ratings - Get all ratings for a user
router.get('/:id/ratings', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        const ratings = await prisma.rating.findMany({
            where: { reviewedId: userId },
            select: {
                id: true,
                rating: true,
                comment: true,
                createdAt: true,
                reviewer: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatarUrl: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const totalRating = ratings.length > 0
            ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
            : 0;

        res.json({
            ratings,
            totalRating: parseFloat(totalRating),
            count: ratings.length
        });
    } catch (err) {
        console.error('Fetch ratings error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/users/best-profiles - Find best matching profiles using weighted fuzzy scoring
router.get('/best-profiles', auth, async (req, res) => {
    try {
        const { profession, city, pincode, skills, page = 1, limit = 10 } = req.query;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));

        const queryProfession = profession ? String(profession).trim().toLowerCase() : null;
        const queryCity = city ? String(city).trim().toLowerCase() : null;
        const queryPincode = pincode ? String(pincode).trim() : null;
        let querySkills = [];
        if (skills) {
            try { querySkills = typeof skills === 'string' ? JSON.parse(skills) : skills; } catch { querySkills = []; }
        }
        querySkills = querySkills.map(s => String(s).trim().toLowerCase()).filter(Boolean);

        const allUsers = await prisma.user.findMany({
            where: {
                status: 'active',
                role: { notIn: ['staff', 'admin'] },
                id: { not: req.user.id }
            },
            select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                city: true,
                pincode: true,
                profession: true,
                skills: true,
                bio: true,
                verified: true,
                ratingReceived: { select: { rating: true } }
            }
        });

        const scored = allUsers.map(user => {
            let score = 0;
            const matchedSkills = [];

            const userProf = (user.profession || '').toLowerCase().trim();
            const userCity = (user.city || '').toLowerCase().trim();
            const userPincode = (user.pincode || '').trim();
            const userSkills = (Array.isArray(user.skills) ? user.skills : []).map(s => String(s).toLowerCase().trim()).filter(Boolean);

            // 1. Profession similarity (30%) — fuzzy, no strict match
            if (queryProfession && userProf) {
                if (userProf === queryProfession) score += 0.30;
                else if (userProf.includes(queryProfession) || queryProfession.includes(userProf)) score += 0.20;
                else {
                    const qWords = queryProfession.split(/\s+/);
                    const uWords = userProf.split(/\s+/);
                    const anyWordMatch = qWords.some(qw => uWords.some(uw => uw.includes(qw) || qw.includes(uw)));
                    if (anyWordMatch) score += 0.12;
                }
            }

            // 2. City similarity (25%) — fuzzy
            if (queryCity && userCity) {
                if (userCity === queryCity) score += 0.25;
                else if (userCity.includes(queryCity) || queryCity.includes(userCity)) score += 0.15;
                else {
                    const qWords = queryCity.split(/\s+/);
                    const uWords = userCity.split(/\s+/);
                    if (qWords.some(qw => uWords.some(uw => uw.includes(qw) || qw.includes(uw)))) score += 0.08;
                }
            }

            // 3. Pincode exact match (10% bonus)
            if (queryPincode && userPincode && userPincode === queryPincode) {
                score += 0.10;
            }

            // 4. Skill overlap (20%)
            if (querySkills.length > 0 && userSkills.length > 0) {
                const overlap = userSkills.filter(us =>
                    querySkills.some(qs => us.includes(qs) || qs.includes(us))
                );
                const uniqueOverlap = [...new Set(overlap)];
                matchedSkills.push(...uniqueOverlap);
                const maxLen = Math.max(querySkills.length, userSkills.length);
                score += (uniqueOverlap.length / maxLen) * 0.20;
            }

            // 5. Average rating (15%)
            const ratings = user.ratingReceived || [];
            if (ratings.length > 0) {
                const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
                score += (avg / 5) * 0.15;
            }

            // 6. Verified badge (15% bonus — not a hard filter)
            if (user.verified) score += 0.15;

            // 7. Profile completeness (10%)
            let completeness = 0;
            if (user.bio) completeness += 0.25;
            if (user.avatarUrl) completeness += 0.25;
            if (user.displayName) completeness += 0.25;
            if (userSkills.length > 0) completeness += 0.25;
            score += completeness * 0.10;

            const avgRating = ratings.length > 0
                ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
                : 0;

            return {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                city: user.city,
                pincode: user.pincode,
                profession: user.profession,
                verified: user.verified,
                score: Math.round(score * 100) / 100,
                avgRating: Math.round(avgRating * 10) / 10,
                ratingCount: ratings.length,
                matchedSkills: [...new Set(matchedSkills)],
                profileCompleteness: Math.round(completeness * 100)
            };
        });

        scored.sort((a, b) => b.score - a.score);

        const total = scored.length;
        const start = (pageNum - 1) * limitNum;
        const paged = scored.slice(start, start + limitNum);

        res.json({
            users: paged,
            total,
            page: pageNum,
            limit: limitNum,
            hasMore: start + limitNum < total
        });
    } catch (err) {
        console.error('Best profiles search error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/users/:id/profile-full - Get batched profile data: user details + ratings + initial posts + eligibility
router.get('/:id/profile-full', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID.' });
        }

        // Optional Auth parsing
        const authHeader = req.header('Authorization');
        const token = req.cookies?.token || authHeader?.replace('Bearer ', '');
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                req.user = { id: decoded.id, role: decoded.role };
            } catch (err) {}
        }

        const viewerId = req.user?.id;

        // Run ALL queries in parallel - massive speed boost!
        const [user, ratingAgg, posts, ratingEligibilityData] = await Promise.all([
            // 1. User profile
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true, username: true, displayName: true, bio: true,
                    avatarUrl: true, coverPhotoUrl: true, socialLinks: true,
                    role: true, status: true, verified: true, city: true,
                    profession: true, skills: true, userGoal: true, createdAt: true,
                    email: true, phoneNumber: true, pincode: true, gender: true,
                    age: true, walletBalance: true, shareId: true
                },
            }),
            // 2. Rating aggregate (no need to fetch all rows!)
            prisma.rating.aggregate({
                where: { reviewedId: userId },
                _avg: { rating: true },
                _count: { rating: true }
            }),
            // 3. Posts
            prisma.post.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                    user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                    likes: true,
                    comments: {
                        include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
                        orderBy: { createdAt: 'desc' },
                        take: 3,
                    },
                },
            }),
            // 4. Rating eligibility (only if logged in and viewing someone else's profile)
            viewerId && viewerId !== userId ? Promise.all([
                prisma.message.findFirst({ where: { senderId: viewerId, receiverId: userId }, select: { id: true } }),
                prisma.message.findFirst({ where: { senderId: userId, receiverId: viewerId }, select: { id: true } }),
                prisma.escrowDeal.findFirst({
                    where: { OR: [{ clientId: viewerId, vendorId: userId }, { clientId: userId, vendorId: viewerId }] },
                    select: { id: true }
                })
            ]) : Promise.resolve(null)
        ]);

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if ((user.role === 'staff' || user.role === 'admin') && (!req.user || req.user.role !== 'admin')) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const isOwner = viewerId === userId;
        const isAdmin = req.user?.role === 'admin';
        if (!isOwner && !isAdmin) {
            delete user.email;
            delete user.phoneNumber;
            delete user.pincode;
            delete user.gender;
            delete user.age;
            delete user.walletBalance;
        }

        const avgRating = ratingAgg._avg.rating ? parseFloat(ratingAgg._avg.rating.toFixed(1)) : 0;
        const ratingCount = ratingAgg._count.rating;

        let ratingEligibility = { canRate: false, reason: null };
        if (ratingEligibilityData) {
            const [hasSent, hasReceived, escrowDeal] = ratingEligibilityData;
            if (escrowDeal) {
                ratingEligibility = { canRate: true, reason: null };
            } else if (hasSent && hasReceived) {
                ratingEligibility = { canRate: true, reason: null };
            } else {
                ratingEligibility = { canRate: false, reason: "You can rate only users you have a mutual chat or deal with." };
            }
        } else if (viewerId === userId) {
            ratingEligibility = { canRate: false, reason: "You cannot rate yourself." };
        }

        res.json({
            user: { ...user, averageRating: avgRating, ratingCount },
            posts,
            ratingEligibility
        });
    } catch (err) {
        console.error('Get profile full error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


// GET /api/users/:id - Get user profile with rating
router.get('/:id', auth, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID.' });
        }
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                coverPhotoUrl: true,
                socialLinks: true,
                role: true,
                status: true,
                verified: true,
                city: true,
                pincode: true,
                profession: true,
                phoneNumber: true,
                gender: true,
                age: true,
                userGoal: true,
                skills: true,
                createdAt: true
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Hide staff and admin from regular users
        if ((user.role === 'staff' || user.role === 'admin') && req.user.role === 'client') {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userRatings = await prisma.rating.findMany({
            where: { reviewedId: user.id },
            select: { rating: true }
        });
        const ratings = userRatings.map(r => r.rating);
        const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "0.0";

        res.json({
            ...user,
            averageRating: parseFloat(avgRating),
            ratingCount: ratings.length
        });
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/users/profile/:id - Get detailed user profile with rating
router.get('/profile/:id', auth, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (req.user.id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized.' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                coverPhotoUrl: true,
                role: true,
                status: true,
                verified: true,
                telegramId: true,
                socialLinks: true,
                createdAt: true,
                city: true,
                pincode: true,
                profession: true,
                phoneNumber: true,
                gender: true,
                age: true,
                userGoal: true,
                skills: true
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userRatings = await prisma.rating.findMany({
            where: { reviewedId: user.id },
            select: { rating: true }
        });
        const ratings = userRatings.map(r => r.rating);
        const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "0.0";

        res.json({
            ...user,
            averageRating: parseFloat(avgRating),
            ratingCount: ratings.length
        });
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/users/profile/:id - Update user profile
router.put('/profile/:id', auth, async (req, res) => {
    try {
        if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized.' });
        }

        const { displayName, bio, email, avatarUrl, role, socialLinks, skills, phoneNumber, city, pincode, profession, gender, age, userGoal } = req.body;

        const updateData = {};
        if (displayName !== undefined) updateData.displayName = displayName?.trim();
        if (bio !== undefined) updateData.bio = bio?.trim();
        if (email !== undefined) updateData.email = email?.trim()?.toLowerCase();
        if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
        if (socialLinks !== undefined) updateData.socialLinks = socialLinks;
        if (skills !== undefined) updateData.skills = skills;
        if (profession !== undefined) updateData.profession = profession?.trim() || null;
        if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber?.trim();
        if (city !== undefined) updateData.city = city?.trim();
        if (pincode !== undefined) {
            const trimmedPincode = pincode?.trim();
            if (trimmedPincode && !/^\d{6}$/.test(trimmedPincode)) {
                return res.status(400).json({ error: 'Pincode must be exactly 6 digits.' });
            }
            updateData.pincode = trimmedPincode;
        }
        if (gender !== undefined) updateData.gender = gender;
        if (age !== undefined) updateData.age = parseInt(age) || null;
        if (userGoal !== undefined) updateData.userGoal = userGoal;
        if (role !== undefined && ['client', 'admin'].includes(role)) updateData.role = role;

        const updatedUser = await prisma.user.update({
            where: { id: parseInt(req.params.id) },
            data: updateData,
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                coverPhotoUrl: true,
                role: true,
                status: true,
                verified: true,
                telegramId: true,
                socialLinks: true,
                phoneNumber: true,
                city: true,
                pincode: true,
                profession: true,
                gender: true,
                age: true,
                userGoal: true,
                skills: true,
                createdAt: true
            }
        });

        res.json(updatedUser);
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/users/avatar - Upload avatar
router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
    try {
        console.log('Avatar upload endpoint called');
        console.log('File object:', req.file ? { fieldname: req.file.fieldname, originalname: req.file.originalname, encoding: req.file.encoding, mimetype: req.file.mimetype, size: req.file.size, buffer: req.file.buffer ? 'exists' : 'missing' } : 'no file');
        console.log('User ID:', req.user.id);

        if (!req.file) {
            console.log('No file provided in request');
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        if (!req.file.buffer) {
            console.log('File buffer is missing');
            return res.status(400).json({ error: 'File buffer is missing.' });
        }

        console.log('Cloudinary config:', {
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'set' : 'missing',
            api_key: process.env.CLOUDINARY_API_KEY ? 'set' : 'missing',
            api_secret: process.env.CLOUDINARY_API_SECRET ? 'set' : 'missing'
        });

        console.log('Cloudinary upload starting...');

        // Convert buffer to base64 for more reliable upload in some environments
        const b64 = req.file.buffer.toString('base64');
        const dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'krovaa/avatars',
            transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'auto' }],
            access_mode: 'public'
        });

        console.log('Cloudinary full response:', JSON.stringify(result, null, 2));

        if (!result || (!result.secure_url && !result.url)) {
            throw new Error('Cloudinary returned an invalid response: ' + JSON.stringify(result));
        }

        const finalAvatarUrl = result.secure_url || result.url;
        console.log('Using avatar URL:', finalAvatarUrl);

        // Update user's avatar URL
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: { avatarUrl: finalAvatarUrl },
            select: { id: true, avatarUrl: true }
        });
        console.log('User updated:', updatedUser);

        res.json({ avatarUrl: finalAvatarUrl });
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.status(500).json({ error: 'Upload failed.', details: err.message });
    }
});

// POST /api/users/cover-photo - Upload cover photo
router.post('/cover-photo', auth, upload.single('coverPhoto'), async (req, res) => {
    try {
        console.log('Cover photo upload endpoint called');
        console.log('File object:', req.file ? { fieldname: req.file.fieldname, originalname: req.file.originalname, encoding: req.file.encoding, mimetype: req.file.mimetype, size: req.file.size, buffer: req.file.buffer ? 'exists' : 'missing' } : 'no file');
        console.log('User ID:', req.user.id);

        if (!req.file) {
            console.log('No file provided in request');
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        if (!req.file.buffer) {
            console.log('File buffer is missing');
            return res.status(400).json({ error: 'File buffer is missing.' });
        }

        console.log('Cloudinary config:', {
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'set' : 'missing',
            api_key: process.env.CLOUDINARY_API_KEY ? 'set' : 'missing',
            api_secret: process.env.CLOUDINARY_API_SECRET ? 'set' : 'missing'
        });

        console.log('Cloudinary cover upload starting...');

        const b64 = req.file.buffer.toString('base64');
        const dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'krovaa/covers',
            transformation: [{ width: 1200, height: 300, crop: 'fill', gravity: 'auto' }],
            access_mode: 'public'
        });

        console.log('Cloudinary cover full response:', JSON.stringify(result, null, 2));

        if (!result || (!result.secure_url && !result.url)) {
            throw new Error('Cloudinary returned an invalid response for cover: ' + JSON.stringify(result));
        }

        const finalCoverUrl = result.secure_url || result.url;
        console.log('Using cover URL:', finalCoverUrl);

        // Update user's cover photo URL
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: { coverPhotoUrl: result.secure_url },
            select: { id: true, coverPhotoUrl: true }
        });
        console.log('User updated:', updatedUser);

        res.json({ coverPhotoUrl: result.secure_url });
    } catch (err) {
        console.error('Cover photo upload error:', err);
        res.status(500).json({ error: 'Upload failed.', details: err.message });
    }
});

// DELETE /api/users/avatar - Remove avatar
router.delete('/avatar', auth, async (req, res) => {
    try {
        await prisma.user.update({
            where: { id: req.user.id },
            data: { avatarUrl: null },
        });
        res.json({ message: 'Avatar removed.' });
    } catch (err) {
        console.error('Delete avatar error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/users/cover-photo - Remove cover photo
router.delete('/cover-photo', auth, async (req, res) => {
    try {
        await prisma.user.update({
            where: { id: req.user.id },
            data: { coverPhotoUrl: null },
        });
        res.json({ message: 'Cover photo removed.' });
    } catch (err) {
        console.error('Delete cover photo error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/users/:id/avatar - Upload avatar to Cloudinary (legacy endpoint)
router.put('/:id/avatar', auth, upload.single('avatar'), async (req, res) => {
    try {
        if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized.' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: 'krovaa/avatars', transformation: [{ width: 200, height: 200, crop: 'fill' }] },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });

        await prisma.user.update({
            where: { id: parseInt(req.params.id) },
            data: { avatarUrl: result.secure_url },
        });

        res.json({ avatar_url: result.secure_url });
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.status(500).json({ error: 'Upload failed.' });
    }
});

// POST /api/users/rate - Rate a user
router.post('/rate', auth, async (req, res) => {
    try {
        const { reviewedId, rating, comment } = req.body;

        if (!reviewedId || !rating) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        if (!comment || comment.trim().length === 0) {
            return res.status(400).json({ error: "Comment is required to submit a rating." });
        }

        if (req.user.id === parseInt(reviewedId)) {
            return res.status(400).json({ error: "You cannot rate yourself." });
        }

        const ratingVal = parseInt(rating);
        if (ratingVal < 1 || ratingVal > 5) {
            return res.status(400).json({ error: "Rating must be between 1 and 5." });
        }

        const reviewerId = req.user.id;
        const reviewedUserId = parseInt(reviewedId);

        const [hasSent, hasReceived, escrowDeal] = await Promise.all([
            prisma.message.findFirst({
                where: { senderId: reviewerId, receiverId: reviewedUserId },
                select: { id: true }
            }),
            prisma.message.findFirst({
                where: { senderId: reviewedUserId, receiverId: reviewerId },
                select: { id: true }
            }),
            prisma.escrowDeal.findFirst({
                where: {
                    OR: [
                        { clientId: reviewerId, vendorId: reviewedUserId },
                        { clientId: reviewedUserId, vendorId: reviewerId }
                    ]
                },
                select: { id: true }
            })
        ]);

        if (!escrowDeal && (!hasSent || !hasReceived)) {
            return res.status(403).json({ error: "You can rate only users you have a mutual chat or deal with." });
        }

        const trimmedComment = comment.trim();

        const ratingObj = await prisma.rating.upsert({
            where: {
                reviewerId_reviewedId: {
                    reviewerId: req.user.id,
                    reviewedId: parseInt(reviewedId)
                }
            },
            update: { rating: ratingVal, comment: trimmedComment },
            create: {
                reviewerId: reviewerId,
                reviewedId: reviewedUserId,
                rating: ratingVal,
                comment: trimmedComment
            }
        });

        await prisma.activityLog.create({ data: { userId: req.user.id, action: 'Rated user', details: `User ID: ${reviewedId}, Rating: ${ratingVal}` } });

        res.json(ratingObj);
    } catch (err) {
        console.error('Rate user error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


export default router;
