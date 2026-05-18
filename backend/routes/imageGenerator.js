import express from 'express';
import { auth } from '../middleware/auth.js';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import FormData from 'form-data';
import crypto from 'crypto';

const router = express.Router();
const prisma = new PrismaClient();

// Generate image using AI
router.post('/generate', auth, async (req, res) => {
    try {
        const { prompt, size = '1024x1024', style = 'natural' } = req.body;

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

        let imageUrl;
        const provider = process.env.IMAGE_GENERATOR_PROVIDER || 'pollinations';
        console.log(`[ImageGen] Using provider: ${provider}, prompt: ${prompt.substring(0, 50)}...`);

        if (provider === 'openai') {
            // OpenAI DALL-E
            if (!process.env.OPENAI_API_KEY) {
                console.error('[ImageGen] OpenAI provider selected but OPENAI_API_KEY not configured');
                return res.status(500).json({ error: 'Image generation service not configured. Please set OPENAI_API_KEY.' });
            }

            const openaiRes = await axios.post(
                'https://api.openai.com/v1/images/generations',
                {
                    model: process.env.OPENAI_IMAGE_MODEL || 'dall-e-3',
                    prompt: prompt,
                    n: 1,
                    size: size === '512x512' ? '1024x1024' : size,
                    quality: 'standard',
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 60000,
                }
            );

            imageUrl = openaiRes.data.data[0].url;
        } else if (provider === 'stability') {
            // Stability AI
            if (!process.env.STABILITY_API_KEY) {
                return res.status(500).json({ error: 'Image generation service not configured' });
            }

            const form = new FormData();
            form.append('prompt', prompt);
            form.append('output_format', 'png');

            const stabilityRes = await axios.post(
                'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
                {
                    text_prompts: [{ text: prompt, weight: 1 }],
                    cfg_scale: 7,
                    width: size === '512x512' ? 512 : 1024,
                    height: size === '512x512' ? 512 : 1024,
                    samples: 1,
                    steps: 30,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    timeout: 60000,
                    responseType: 'arraybuffer',
                }
            );

            // Upload to Cloudinary for persistent URL
            const cloudinary = await import('cloudinary');
            const cloudinaryConfig = cloudinary.v2;
            cloudinaryConfig.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET,
            });

            const uploadResult = await new Promise((resolve, reject) => {
                cloudinaryConfig.uploader.upload_stream(
                    { folder: 'krovai-generated', resource_type: 'image' },
                    (error, result) => error ? reject(error) : resolve(result)
                ).end(Buffer.from(stabilityRes.data));
            });

            imageUrl = uploadResult.secure_url;
        } else if (provider === 'pollinations') {
            // Pollinations AI (free, no API key needed)
            // Download image and proxy through Cloudinary for CORS compatibility
            const encodedPrompt = encodeURIComponent(prompt);
            const seed = Math.floor(Math.random() * 1000000);
            const pollUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${size === '512x512' ? 512 : 1024}&height=${size === '512x512' ? 512 : 1024}&seed=${seed}&nologo=true`;
            
            try {
                console.log('[ImageGen] Downloading from pollinations:', pollUrl.substring(0, 80) + '...');
                const imgRes = await axios.get(pollUrl, { 
                    timeout: 60000,
                    responseType: 'arraybuffer' 
                });

                // Upload to Cloudinary for persistent, CORS-enabled URL
                const cloudinary = await import('cloudinary');
                const cloudinaryConfig = cloudinary.v2;
                cloudinaryConfig.config({
                    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                    api_key: process.env.CLOUDINARY_API_KEY,
                    api_secret: process.env.CLOUDINARY_API_SECRET,
                });

                const uploadResult = await new Promise((resolve, reject) => {
                    cloudinaryConfig.uploader.upload_stream(
                        { folder: 'krovai-generated', resource_type: 'image' },
                        (error, result) => error ? reject(error) : resolve(result)
                    ).end(Buffer.from(imgRes.data));
                });

                imageUrl = uploadResult.secure_url;
                console.log('[ImageGen] Uploaded to Cloudinary:', imageUrl.substring(0, 80) + '...');
            } catch (e) {
                console.error('[ImageGen] Pollinations download/upload error:', e.message);
                throw new Error(`Failed to process pollinations image: ${e.message}`);
            }
        } else if (provider === 'puter') {
            // Puter.ai provider (server-side)
            if (!process.env.PUTER_API_KEY || !process.env.PUTER_API_URL) {
                return res.status(500).json({ error: 'Image generation service not configured' });
            }

            try {
                const puterRes = await axios.post(
                    process.env.PUTER_API_URL,
                    {
                        prompt: prompt,
                        size,
                        style,
                        // preserve any other options
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${process.env.PUTER_API_KEY}`,
                            'Content-Type': 'application/json',
                        },
                        timeout: 60000,
                    }
                );

                // Provider may return an accessible URL or base64 image data
                if (puterRes.data?.url) {
                    imageUrl = puterRes.data.url;
                } else if (puterRes.data?.b64_image) {
                    const b64 = puterRes.data.b64_image;
                    const buffer = Buffer.from(b64, 'base64');

                    const cloudinary = await import('cloudinary');
                    const cloudinaryConfig = cloudinary.v2;
                    cloudinaryConfig.config({
                        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                        api_key: process.env.CLOUDINARY_API_KEY,
                        api_secret: process.env.CLOUDINARY_API_SECRET,
                    });

                    const uploadResult = await new Promise((resolve, reject) => {
                        cloudinaryConfig.uploader.upload_stream(
                            { folder: 'krovai-generated', resource_type: 'image' },
                            (error, result) => error ? reject(error) : resolve(result)
                        ).end(buffer);
                    });

                    imageUrl = uploadResult.secure_url;
                } else {
                    throw new Error('Unexpected response from puter.ai provider');
                }
            } catch (e) {
                console.error('Puter provider error:', e.response?.data || e.message);
                if (e.response?.status === 429) {
                    return res.status(429).json({ error: 'Rate limit exceeded by provider. Please try again later.' });
                }
                throw e;
            }
        } else {
            return res.status(500).json({ error: 'Invalid image generation provider configured' });
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

// Get generation stats (for admin)
router.get('/stats', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'staff') {
            return res.status(403).json({ error: 'Admin access required' });
        }

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

        res.json({
            totalGenerations,
            todayGenerations,
            topStyles,
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
