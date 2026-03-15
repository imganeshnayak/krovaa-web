import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth, adminOnly } from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';
import multer from 'multer';

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
                    { role: { notIn: ['staff', 'admin'] } },
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
                createdAt: true,
                ratingsReceived: {
                    select: { rating: true }
                }
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

        const ratings = user.ratingsReceived.map(r => r.rating);
        const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "0.0";

        res.json({
            ...user,
            averageRating: parseFloat(avgRating),
            ratingCount: ratings.length,
            ratingsReceived: undefined
        });
    } catch (err) {
        console.error('Get user by username error:', err);
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

        if (!hasSent || !hasReceived) {
            return res.json({ canRate: false, reason: "You can rate only users you have a mutual chat with." });
        }

        if (!escrowDeal) {
            return res.json({ canRate: false, reason: "You can rate only users you have an  deal with." });
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

// GET /api/users/best-profiles - Get verified profiles by location (Moved up to avoid conflict with /:id)
router.get('/best-profiles', auth, async (req, res) => {
    try {
        const { city, pincode, profession } = req.query;

        if (!city && !pincode && !profession) {
            return res.status(400).json({ error: "City, Pincode or Profession is required." });
        }

        const users = await prisma.user.findMany({
            where: {
                verified: true,
                status: 'active',
                role: { notIn: ['staff', 'admin'] },
                AND: [
                    city ? { city: { contains: city, mode: 'insensitive' } } : {},
                    pincode ? { pincode: pincode } : {},
                    profession ? { profession: { contains: profession, mode: 'insensitive' } } : {}
                ]
            },
            select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                city: true,
                pincode: true,
                verified: true
            },
            take: 5
        });

        res.json(users);
    } catch (err) {
        console.error('Best profiles search error:', err);
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
                createdAt: true,
                ratingsReceived: {
                    select: { rating: true }
                }
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Hide staff and admin from regular users
        if ((user.role === 'staff' || user.role === 'admin') && req.user.role === 'client') {
            return res.status(404).json({ error: 'User not found.' });
        }

        const ratings = user.ratingsReceived.map(r => r.rating);
        const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "0.0";

        res.json({
            ...user,
            averageRating: parseFloat(avgRating),
            ratingCount: ratings.length,
            ratingsReceived: undefined
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
                skills: true,
                ratingsReceived: {
                    select: { rating: true }
                }
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const ratings = user.ratingsReceived.map(r => r.rating);
        const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "0.0";

        res.json({
            ...user,
            averageRating: parseFloat(avgRating),
            ratingCount: ratings.length,
            ratingsReceived: undefined
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
        if (pincode !== undefined) updateData.pincode = pincode?.trim();
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

        if (!hasSent || !hasReceived) {
            return res.status(403).json({ error: "You can rate only users you have a mutual chat with." });
        }

        if (!escrowDeal) {
            return res.status(403).json({ error: "You can rate only users you have an  deal with." });
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
