import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth, adminOnly } from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';
import multer from 'multer';

const prisma = new PrismaClient();
const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for videos
});

// ─── Admin: Create ad ────────────────────────────────────────────
// POST /api/ads
router.post('/', auth, adminOnly, upload.single('file'), async (req, res) => {
    try {
        const { title, description, ctaText, externalUrl, type, targetProfessions } = req.body;

        if (!title?.trim()) {
            return res.status(400).json({ error: 'Title is required.' });
        }

        let imageUrl = null;
        let videoUrl = null;

        if (req.file) {
            const isVideo = req.file.mimetype.startsWith('video/');
            const uploadResult = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'krovaa/ads', resource_type: isVideo ? 'video' : 'image', access_mode: 'public' },
                    (error, result) => { if (error) reject(error); else resolve(result); }
                );
                stream.end(req.file.buffer);
            });
            if (isVideo) {
                videoUrl = uploadResult.secure_url;
            } else {
                imageUrl = uploadResult.secure_url;
            }
        }

        let parsedProfessions = [];
        if (targetProfessions) {
            try {
                parsedProfessions = typeof targetProfessions === 'string' ? JSON.parse(targetProfessions) : targetProfessions;
            } catch { parsedProfessions = []; }
        }

        const ad = await prisma.ad.create({
            data: {
                title: title.trim(),
                description: description?.trim() || null,
                imageUrl,
                videoUrl,
                externalUrl: externalUrl?.trim() || null,
                ctaText: ctaText?.trim() || 'More Details',
                type: type || 'text',
                targetProfessions: parsedProfessions,
                status: 'active',
                sentBy: req.user.id
            },
            include: {
                admin: { select: { displayName: true, username: true } },
                _count: { select: { clicks: true } }
            }
        });

        res.status(201).json(ad);
    } catch (err) {
        console.error('Create ad error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─── Admin: List all ads with analytics ─────────────────────────
// GET /api/ads
router.get('/', auth, adminOnly, async (req, res) => {
    try {
        const ads = await prisma.ad.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                admin: { select: { displayName: true, username: true } },
                _count: { select: { clicks: true } }
            }
        });

        const adsWithStats = ads.map(ad => ({
            ...ad,
            clickCount: ad._count.clicks,
            ctr: ad.impressions > 0 ? ((ad._count.clicks / ad.impressions) * 100).toFixed(1) : '0.0'
        }));

        res.json(adsWithStats);
    } catch (err) {
        console.error('Get ads error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─── Admin: Update ad ────────────────────────────────────────────
// PUT /api/ads/:id
router.put('/:id', auth, adminOnly, upload.single('file'), async (req, res) => {
    try {
        const adId = parseInt(req.params.id);
        const existing = await prisma.ad.findUnique({ where: { id: adId } });
        if (!existing) return res.status(404).json({ error: 'Ad not found.' });

        const { title, description, ctaText, externalUrl, type, targetProfessions, status } = req.body;

        let imageUrl = existing.imageUrl;
        let videoUrl = existing.videoUrl;

        if (req.file) {
            const isVideo = req.file.mimetype.startsWith('video/');
            const uploadResult = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'krovaa/ads', resource_type: isVideo ? 'video' : 'image', access_mode: 'public' },
                    (error, result) => { if (error) reject(error); else resolve(result); }
                );
                stream.end(req.file.buffer);
            });
            if (isVideo) { videoUrl = uploadResult.secure_url; imageUrl = null; }
            else { imageUrl = uploadResult.secure_url; videoUrl = null; }
        }

        let parsedProfessions = existing.targetProfessions;
        if (targetProfessions !== undefined) {
            try {
                parsedProfessions = typeof targetProfessions === 'string' ? JSON.parse(targetProfessions) : targetProfessions;
            } catch { parsedProfessions = []; }
        }

        const ad = await prisma.ad.update({
            where: { id: adId },
            data: {
                title: title?.trim() ?? existing.title,
                description: description?.trim() ?? existing.description,
                imageUrl,
                videoUrl,
                externalUrl: externalUrl?.trim() ?? existing.externalUrl,
                ctaText: ctaText?.trim() ?? existing.ctaText,
                type: type ?? existing.type,
                targetProfessions: parsedProfessions,
                status: status ?? existing.status
            },
            include: {
                admin: { select: { displayName: true, username: true } },
                _count: { select: { clicks: true } }
            }
        });

        res.json(ad);
    } catch (err) {
        console.error('Update ad error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─── Admin: Delete ad ────────────────────────────────────────────
// DELETE /api/ads/:id
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        const adId = parseInt(req.params.id);
        await prisma.ad.delete({ where: { id: adId } });
        res.json({ success: true });
    } catch (err) {
        console.error('Delete ad error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─── User: Get active ad targeted to current user ────────────────
// GET /api/ads/active
router.get('/active', auth, async (req, res) => {
    try {
        // Fetch current user's profession
        const dbUser = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { profession: true }
        });

        const profession = dbUser?.profession || null;

        // Find active ads that target this user's profession OR "all users" (empty targetProfessions)
        const allActiveAds = await prisma.ad.findMany({
            where: { status: 'active' },
            select: {
                id: true, title: true, description: true, imageUrl: true, videoUrl: true,
                externalUrl: true, ctaText: true, type: true, targetProfessions: true
            }
        });

        // Filter by profession: include ads with empty target (broadcast) or matching
        const targeted = allActiveAds.filter(ad => {
            const targets = Array.isArray(ad.targetProfessions) ? ad.targetProfessions : [];
            return targets.length === 0 || (profession && targets.includes(profession));
        });

        if (targeted.length === 0) return res.json(null);

        // Pick one randomly
        const chosen = targeted[Math.floor(Math.random() * targeted.length)];

        // Increment impressions
        await prisma.ad.update({
            where: { id: chosen.id },
            data: { impressions: { increment: 1 } }
        });

        res.json(chosen);
    } catch (err) {
        console.error('Get active ad error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─── User: Record a click ────────────────────────────────────────
// POST /api/ads/:id/click
router.post('/:id/click', auth, async (req, res) => {
    try {
        const adId = parseInt(req.params.id);
        await prisma.adClick.create({
            data: {
                adId,
                userId: req.user.id,
                clickedAt: new Date()
            }
        });
        res.json({ success: true });
    } catch (err) {
        console.error('Record ad click error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─── Admin: Push ad as notification ─────────────────────────────
// POST /api/ads/:id/push
router.post('/:id/push', auth, adminOnly, async (req, res) => {
    try {
        const adId = parseInt(req.params.id);
        const ad = await prisma.ad.findUnique({
            where: { id: adId },
            include: { admin: true }
        });

        if (!ad) return res.status(404).json({ error: 'Ad not found.' });

        const targets = Array.isArray(ad.targetProfessions) ? ad.targetProfessions : [];

        // Find users to notify
        const userQuery = { status: 'active' };
        if (targets.length > 0) {
            userQuery.profession = { in: targets };
        }

        const usersToNotify = await prisma.user.findMany({
            where: userQuery,
            select: { id: true }
        });

        // Create notification record (Broadcast style if targets empty, otherwise we'd need multiple records or handle it in fetch)
        // For simplicity, we create a broadcast-type notification with metadata pointing to the ad
        const notification = await prisma.notification.create({
            data: {
                title: `📢 ${ad.title}`,
                message: ad.description || "Check out this new update!",
                type: 'info',
                sentBy: req.user.id,
                metadata: { type: 'ad_push', adId: ad.id }
            }
        });

        // Socket emit
        const io = req.app.get('io');
        if (io) {
            const socketData = {
                id: notification.id,
                title: notification.title,
                message: notification.message,
                type: notification.type,
                createdAt: notification.createdAt,
                sentBy: 'Krovaa',
                metadata: notification.metadata
            };

            if (targets.length === 0) {
                io.emit('admin:notification', socketData);
            } else {
                // If specific targets, we'd ideally emit to those specific users
                // For now, emit to all and let client filter if needed, or loop
                io.emit('admin:notification', socketData);
            }
        }

        res.json({ success: true, notifiedCount: usersToNotify.length });
    } catch (err) {
        console.error('Push ad error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

export default router;
