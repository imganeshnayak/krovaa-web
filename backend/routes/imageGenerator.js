import express from 'express';
import { auth } from '../middleware/auth.js';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import FormData from 'form-data';
import crypto from 'crypto';
import multer from 'multer';

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

// Module-level config variables
const provider = process.env.IMAGE_GENERATOR_PROVIDER || 'pollinations';
const supportsImg2Img = provider === 'stability';

// Generate image using AI
router.post('/generate', auth, upload.single('image'), async (req, res) => {
    try {
        let { prompt, size = '1024x1024', style = 'natural' } = req.body;
        const file = req.file;
        
        // If we are using FormData, basic a base64 conversion might be needed for some providers 
        // or we can send the buffer directly.
        let base64Image = null;
        if (file) {
            base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
        }

        if (!prompt || prompt.trim().length === 0) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        if (prompt.length > 1000) {
            return res.status(400).json({ error: 'Prompt must be less than 1000 characters' });
        }

        // Check if feature is enabled in system settings
        const settings = await prisma.systemSetting.findMany();
        const settingsMap = {};
        settings.forEach(s => { settingsMap[s.key] = s.value; });

        if (settingsMap['image_generator_enabled'] === 'false') {
            return res.status(403).json({ error: 'Image generator is currently disabled' });
        }

        // Check subscription-based monthly limit
        const subscription = await prisma.subscription.findUnique({
            where: { userId: req.user.id }
        });

        const now = new Date();
        let monthlyLimit = 5;
        let imagesThisMonth = 0;

        if (subscription) {
            // Check if we need to reset for new month
            if (subscription.resetDate && now > subscription.resetDate) {
                await prisma.subscription.update({
                    where: { userId: req.user.id },
                    data: {
                        imagesThisMonth: 0,
                        resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
                    },
                });
            } else {
                imagesThisMonth = subscription.imagesThisMonth;
            }
            monthlyLimit = subscription.monthlyLimit;
        }

        const remaining = Math.max(0, monthlyLimit - imagesThisMonth);

        // TODO: Rate limiting temporarily disabled for testing
        // if (remaining <= 0) {
        //     return res.status(429).json({ 
        //         error: `Monthly limit reached. You can generate ${monthlyLimit} images per month.`,
        //         limit: monthlyLimit,
        //         used: imagesThisMonth,
        //         planId: subscription?.planId || 'free',
        //         upgradeUrl: '/image-generator/pricing'
        //     });
        // }

        // ---- Image generation logic start ----
        let imageUrl;
        console.log(`[ImageGen] Using provider: ${provider}`);

        // Helper: upload buffer to Cloudinary
        const uploadToCloud = async (buf) => {
            const cloudinary = await import('cloudinary');
            const cfg = cloudinary.v2;
            cfg.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET,
            });
            return new Promise((resolve, reject) => {
                cfg.uploader.upload_stream(
                    { folder: 'krovai-generated', resource_type: 'image' },
                    (error, result) => error ? reject(error) : resolve(result.secure_url)
                ).end(buf);
            });
        };

        // Determine if the request is image-to-image
        const requestedImg2Img = Boolean(base64Image);
        if (requestedImg2Img && !supportsImg2Img) {
            console.warn('[ImageGen] Reference image provided but provider does not support image-to-image. Falling back to text-to-image.');
            base64Image = null;
        }
        const isImg2Img = requestedImg2Img && supportsImg2Img;
        console.log('[ImageGen] isImg2Img:', isImg2Img, 'provider:', provider);

        if (provider === 'stability') {
            if (!process.env.STABILITY_API_KEY) {
                return res.status(500).json({ error: 'Stability AI key missing. Set STABILITY_API_KEY in .env' });
            }

            const stFormData = new FormData();
            stFormData.append('prompt', prompt);
            stFormData.append('output_format', 'png');
            stFormData.append('model', 'sd3.5-large-turbo');

            if (isImg2Img) {
                // Image-to-image: send image + mode + strength
                const imgBuf = Buffer.from(base64Image.replace(/^data:[^;]+;base64,/, ''), 'base64');
                stFormData.append('image', imgBuf, { filename: 'input.png', contentType: 'image/png' });
                stFormData.append('mode', 'image-to-image');
                stFormData.append('strength', '0.75'); // 0=copy input, 1=ignore input
            } else {
                // Text-to-image: just prompt
                stFormData.append('mode', 'text-to-image');
            }

            const stabilityRes = await axios.post(
                'https://api.stability.ai/v2beta/stable-image/generate/sd3',
                stFormData,
                {
                    headers: {
                        Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
                        Accept: 'application/json',
                        ...stFormData.getHeaders(),
                    },
                    timeout: 90000,
                }
            );

            if (stabilityRes.data?.image) {
                imageUrl = await uploadToCloud(Buffer.from(stabilityRes.data.image, 'base64'));
            } else {
                console.error('[Stability] Unexpected response:', stabilityRes.data);
                return res.status(500).json({ error: 'Unexpected Stability AI response' });
            }
        } else if (provider === 'openai') {
            if (!process.env.OPENAI_API_KEY) {
                return res.status(500).json({ error: 'OpenAI key missing' });
            }
            const openaiRes = await axios.post(
                'https://api.openai.com/v1/images/generations',
                { model: process.env.OPENAI_IMAGE_MODEL || 'dall-e-3', prompt, n: 1, size: size === '512x512' ? '1024x1024' : size, quality: 'standard' },
                { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 60000 }
            );
            imageUrl = openaiRes.data.data[0].url;
        } else if (provider === 'pollinations') {
            const encoded = encodeURIComponent(prompt);
            const pollUrl = `https://image.pollinations.ai/prompt/${encoded}?width=${size === '512x512' ? 512 : 1024}&height=${size === '512x512' ? 512 : 1024}`;
            const resImg = await axios.get(pollUrl, { responseType: 'arraybuffer', timeout: 60000 });
            imageUrl = await uploadToCloud(Buffer.from(resImg.data));
        } else {
            return res.status(500).json({ error: 'Unsupported provider: ' + provider });
        }

        // Save generation to database
        const generation = await prisma.imageGeneration.create({
            data: {
                userId: req.user.id,
                prompt: prompt,
                style: style,
                imageUrl: imageUrl,
                size: size,
            },
        });

        // Update daily generation count (for analytics)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await prisma.imageGenerationDaily.upsert({
            where: {
                userId_date: {
                    userId: req.user.id,
                    date: today
                }
            },
            update: { count: { increment: 1 } },
            create: {
                userId: req.user.id,
                date: today,
                count: 1
            }
        });

        // Update subscription usage
        const sub = await prisma.subscription.findUnique({
            where: { userId: req.user.id }
        });
        if (sub) {
            await prisma.subscription.update({
                where: { userId: req.user.id },
                data: {
                    imagesUsed: { increment: 1 },
                    imagesThisMonth: { increment: 1 },
                },
            });
        } else {
            // Create free subscription if not exists
            const now = new Date();
            await prisma.subscription.create({
                data: {
                    userId: req.user.id,
                    planId: 'free',
                    planName: 'Starter',
                    monthlyLimit: 5,
                    imagesUsed: 1,
                    imagesThisMonth: 1,
                    resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
                    status: 'active',
                },
            });
        }

        res.json({
            id: generation.id,
            imageUrl: imageUrl,
            prompt: generation.prompt,
            style: generation.style,
            size: generation.size,
            createdAt: generation.createdAt,
        });
    } catch (error) {
        console.error('Image generation error:', {
            message: error.message,
            provider: process.env.IMAGE_GENERATOR_PROVIDER || 'pollinations',
            responseData: error.response?.data,
            code: error.code,
        });

        if (error.response?.status === 429) {
            return res.status(429).json({ error: 'Rate limit exceeded. Please try again in a moment.' });
        }

        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            return res.status(504).json({ error: 'Image generation timed out. Please try again.' });
        }

        res.status(500).json({ error: 'Failed to generate image. Please try again.' });
    }
});

// Get user's generation history
router.get('/history', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const generations = await prisma.imageGeneration.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        });

        const total = await prisma.imageGeneration.count({
            where: { userId: req.user.id },
        });

        res.json({
            generations,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error('Get history error:', error.message);
        res.status(500).json({ error: 'Failed to fetch generation history' });
    }
});

// Get configuration (public - accessible to all authenticated users)
router.get('/config', auth, async (req, res) => {
    try {
        const settings = await prisma.systemSetting.findMany();
        const settingsMap = {};
        settings.forEach(s => { settingsMap[s.key] = s.value; });

        const isEnabled = settingsMap['image_generator_enabled'] !== 'false';

        res.json({
            isEnabled,
            provider,
            supportsImg2Img
        });
    } catch (error) {
        console.error('Get config error:', error.message);
        res.status(500).json({ error: 'Failed to fetch image generator config' });
    }
});

// Delete a generation
router.delete('/:id', auth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const generation = await prisma.imageGeneration.findUnique({
            where: { id },
        });

        if (!generation) {
            return res.status(404).json({ error: 'Generation not found' });
        }

        if (generation.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await prisma.imageGeneration.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete generation error:', error.message);
        res.status(500).json({ error: 'Failed to delete generation' });
    }
});

// Get user's daily generation count
router.get('/daily-limit/check', auth, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const settings = await prisma.systemSetting.findMany();
        const settingsMap = {};
        settings.forEach(s => { settingsMap[s.key] = s.value; });

        const dailyLimit = parseInt(settingsMap['image_generation_daily_limit'] || '5');

        const todayCount = await prisma.imageGenerationDaily.findUnique({
            where: {
                userId_date: {
                    userId: req.user.id,
                    date: today
                }
            }
        });

        const used = todayCount?.count || 0;
        const remaining = Math.max(0, dailyLimit - used);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        res.json({
            limit: dailyLimit,
            used: used,
            remaining: remaining,
            resetTime: tomorrow
        });
    } catch (error) {
        console.error('Get daily limit error:', error.message);
        res.status(500).json({ error: 'Failed to fetch daily limit info' });
    }
});

// Get generation stats (for admin)
router.get('/stats', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'staff') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const totalGenerations = await prisma.imageGeneration.count();
        const todayGenerations = await prisma.imageGeneration.count({
            where: {
                createdAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                },
            },
        });

        const topStyles = await prisma.imageGeneration.groupBy({
            by: ['style'],
            _count: true,
            orderBy: { _count: { style: 'desc' } },
            take: 10,
        });

        // Get daily limit stats
        const settings = await prisma.systemSetting.findMany();
        const settingsMap = {};
        settings.forEach(s => { settingsMap[s.key] = s.value; });

        const dailyLimit = parseInt(settingsMap['image_generation_daily_limit'] || '5');
        const isEnabled = settingsMap['image_generator_enabled'] !== 'false';

        // Get users who hit the daily limit today
        const usersAtLimit = await prisma.imageGenerationDaily.findMany({
            where: {
                date: today,
                count: { gte: dailyLimit }
            }
        });

        // Get total users who generated today
        const uniqueUsersToday = await prisma.imageGenerationDaily.findMany({
            where: { date: today }
        });

        res.json({
            totalGenerations,
            todayGenerations,
            topStyles,
            dailyLimit,
            isEnabled,
            provider,
            supportsImg2Img,
            usersAtLimitToday: usersAtLimit.length,
            uniqueUsersToday: uniqueUsersToday.length,
            totalDailyUsers: uniqueUsersToday.map(u => u.userId),
            averagePerUser: uniqueUsersToday.length > 0 
                ? (todayGenerations / uniqueUsersToday.length).toFixed(2)
                : 0
        });
    } catch (error) {
        console.error('Get stats error:', error.message);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Share generated image to a chat
router.post('/:id/share-to-chat', auth, async (req, res) => {
    try {
        const { chatId, receiverId, caption } = req.body;

        if (!chatId || !receiverId) {
            return res.status(400).json({ error: 'chatId and receiverId are required' });
        }

        const generationId = parseInt(req.params.id);
        const generation = await prisma.imageGeneration.findUnique({
            where: { id: generationId },
        });

        if (!generation) {
            return res.status(404).json({ error: 'Image generation not found' });
        }

        // Check if user is authorized to share this (owner or admin)
        if (generation.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to share this image' });
        }

        // Send message with image
        const message = await prisma.message.create({
            data: {
                senderId: req.user.id,
                receiverId: receiverId,
                chatId: chatId,
                content: caption || `Check out this AI-generated image: "${generation.prompt}"`,
                messageType: 'image',
                attachmentUrl: generation.imageUrl,
                attachmentName: `generated-image-${generation.id}.png`,
            },
        });

        res.json({
            success: true,
            message: {
                id: message.id,
                content: message.content,
                attachmentUrl: message.attachmentUrl,
                createdAt: message.createdAt,
            },
        });
    } catch (error) {
        console.error('Share image to chat error:', error.message);
        res.status(500).json({ error: 'Failed to share image to chat' });
    }
});

export default router;
