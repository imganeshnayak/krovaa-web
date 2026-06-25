import express from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';
import multer from 'multer';
import { checkServiceability } from '../services/shiprocketService.js';

const router = express.Router();
const prisma = new PrismaClient();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ─── AUTH: POST /api/deals/upload — upload product image ──────────────────────

router.post('/upload', auth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided.' });
        }

        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            return res.status(400).json({ error: 'Only JPG, PNG, WEBP, and GIF images are allowed.' });
        }

        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;

        const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'deals',
            resource_type: 'image'
        });

        res.json({ imageUrl: result.secure_url });
    } catch (err) {
        console.error('Deal image upload error:', err);
        res.status(500).json({ error: 'Failed to upload product image.' });
    }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEAL_SELECT = {
    id: true,
    shareCode: true,
    sellerId: true,
    title: true,
    description: true,
    price: true,
    currency: true,
    imageUrls: true,
    deliveryType: true,
    deliveryDays: true,
    category: true,
    status: true,
    viewCount: true,
    createdAt: true,
    updatedAt: true,
    seller: {
        select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            verified: true,
            businessName: true,
            accountType: true,
        }
    },
    _count: { select: { inquiries: true } }
};

function generateShareCode() {
    return crypto.randomBytes(6).toString('base64url'); // ~8 URL-safe chars
}

// ─── PUBLIC: GET /api/deals/public — browse all active deals (marketplace tab) ─

router.get('/public', async (req, res) => {
    try {
        const { category, deliveryType, minPrice, maxPrice, search, page = 1, limit = 18 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where = {
            status: 'active',
            ...(category ? { category } : {}),
            ...(deliveryType ? { deliveryType } : {}),
            ...(minPrice || maxPrice ? {
                price: {
                    ...(minPrice ? { gte: Number(minPrice) } : {}),
                    ...(maxPrice ? { lte: Number(maxPrice) } : {}),
                }
            } : {}),
            ...(search ? {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { category: { contains: search, mode: 'insensitive' } },
                ]
            } : {}),
        };

        const [deals, total] = await Promise.all([
            prisma.dealListing.findMany({
                where,
                select: DEAL_SELECT,
                orderBy: { createdAt: 'desc' },
                skip,
                take: Number(limit),
            }),
            prisma.dealListing.count({ where }),
        ]);

        res.json({ deals, total, page: Number(page), hasMore: skip + deals.length < total });
    } catch (err) {
        console.error('GET /api/deals/public error:', err);
        res.status(500).json({ error: 'Failed to load deals.' });
    }
});

// ─── PUBLIC: GET /api/deals/:shareCode — single deal detail ──────────────────

router.get('/:shareCode', async (req, res) => {
    try {
        const { shareCode } = req.params;

        const deal = await prisma.dealListing.findUnique({
            where: { shareCode },
            select: DEAL_SELECT,
        });

        if (!deal) return res.status(404).json({ error: 'Deal not found.' });
        if (deal.status === 'paused') return res.status(410).json({ error: 'This deal is currently paused.' });

        // Increment view count (fire-and-forget)
        prisma.dealListing.update({
            where: { shareCode },
            data: { viewCount: { increment: 1 } }
        }).catch(() => {});

        res.json(deal);
    } catch (err) {
        console.error('GET /api/deals/:shareCode error:', err);
        res.status(500).json({ error: 'Failed to load deal.' });
    }
});

// ─── AUTH: GET /api/deals — get seller's own deal listings ───────────────────

router.get('/', auth, async (req, res) => {
    try {
        const deals = await prisma.dealListing.findMany({
            where: { sellerId: req.user.id },
            select: DEAL_SELECT,
            orderBy: { createdAt: 'desc' },
        });
        res.json(deals);
    } catch (err) {
        console.error('GET /api/deals error:', err);
        res.status(500).json({ error: 'Failed to load your deals.' });
    }
});

// ─── AUTH: POST /api/deals — create a new deal listing ───────────────────────

router.post('/', auth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { accountType: true } });
        if (!user || user.accountType !== 'business') {
            return res.status(403).json({ error: 'Only business accounts can create deal listings. Please complete your business profile first.' });
        }

        const { title, description, price, imageUrls = [], deliveryType = 'shipping', deliveryDays, category, shippingWeight, shippingDimensions, pickupAddress } = req.body;

        if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });
        if (!description?.trim()) return res.status(400).json({ error: 'Description is required.' });
        if (!price || isNaN(Number(price)) || Number(price) <= 0) {
            return res.status(400).json({ error: 'A valid price is required.' });
        }


        const shareCode = generateShareCode();

        const deal = await prisma.dealListing.create({
            data: {
                shareCode,
                sellerId: req.user.id,
                title: title.trim(),
                description: description.trim(),
                price: Number(price),
                imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
                deliveryType,
                deliveryDays: deliveryDays ? Number(deliveryDays) : null,
                category: category?.trim() || null,
                shippingWeight: shippingWeight ? parseFloat(shippingWeight) : null,
                shippingDimensions: shippingDimensions?.trim() || null,
                pickupAddress: pickupAddress?.trim() || null,
            },
            select: DEAL_SELECT,
        });

        const shareUrl = `${process.env.FRONTEND_URL}/deal/${shareCode}`;
        res.status(201).json({ deal, shareUrl });
    } catch (err) {
        console.error('POST /api/deals error:', err);
        res.status(500).json({ error: 'Failed to create deal.' });
    }
});

// ─── AUTH: PUT /api/deals/:id — edit own deal ─────────────────────────────────

router.put('/:id', auth, async (req, res) => {
    try {
        const dealId = Number(req.params.id);
        const existing = await prisma.dealListing.findUnique({ where: { id: dealId } });

        if (!existing) return res.status(404).json({ error: 'Deal not found.' });
        if (existing.sellerId !== req.user.id) return res.status(403).json({ error: 'Not your deal.' });

        const { title, description, price, imageUrls, deliveryType, deliveryDays, category, shippingWeight, shippingDimensions, pickupAddress } = req.body;

        const updated = await prisma.dealListing.update({
            where: { id: dealId },
            data: {
                ...(title ? { title: title.trim() } : {}),
                ...(description ? { description: description.trim() } : {}),
                ...(price !== undefined ? { price: Number(price) } : {}),
                ...(imageUrls !== undefined ? { imageUrls } : {}),
                ...(deliveryType ? { deliveryType } : {}),
                ...(deliveryDays !== undefined ? { deliveryDays: deliveryDays ? Number(deliveryDays) : null } : {}),
                ...(category !== undefined ? { category: category?.trim() || null } : {}),
                ...(shippingWeight !== undefined ? { shippingWeight: shippingWeight ? parseFloat(shippingWeight) : null } : {}),
                ...(shippingDimensions !== undefined ? { shippingDimensions: shippingDimensions?.trim() || null } : {}),
                ...(pickupAddress !== undefined ? { pickupAddress: pickupAddress?.trim() || null } : {}),
            },
            select: DEAL_SELECT,
        });

        res.json(updated);
    } catch (err) {
        console.error('PUT /api/deals/:id error:', err);
        res.status(500).json({ error: 'Failed to update deal.' });
    }
});

// ─── AUTH: PUT /api/deals/:id/status — pause / activate / mark sold ──────────

router.put('/:id/status', auth, async (req, res) => {
    try {
        const dealId = Number(req.params.id);
        const { status } = req.body;

        if (!['active', 'paused', 'sold'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Use active, paused, or sold.' });
        }

        const existing = await prisma.dealListing.findUnique({ where: { id: dealId } });
        if (!existing) return res.status(404).json({ error: 'Deal not found.' });
        if (existing.sellerId !== req.user.id) return res.status(403).json({ error: 'Not your deal.' });

        const updated = await prisma.dealListing.update({
            where: { id: dealId },
            data: { status },
            select: DEAL_SELECT,
        });

        res.json(updated);
    } catch (err) {
        console.error('PUT /api/deals/:id/status error:', err);
        res.status(500).json({ error: 'Failed to update deal status.' });
    }
});

// ─── AUTH: DELETE /api/deals/:id — delete own deal ───────────────────────────

router.delete('/:id', auth, async (req, res) => {
    try {
        const dealId = Number(req.params.id);
        const existing = await prisma.dealListing.findUnique({ where: { id: dealId } });

        if (!existing) return res.status(404).json({ error: 'Deal not found.' });
        if (existing.sellerId !== req.user.id) return res.status(403).json({ error: 'Not your deal.' });

        await prisma.dealListing.delete({ where: { id: dealId } });
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/deals/:id error:', err);
        res.status(500).json({ error: 'Failed to delete deal.' });
    }
});

// ─── AUTH: POST /api/deals/:shareCode/inquire — buyer starts chat ─────────────

router.post('/:shareCode/inquire', auth, async (req, res) => {
    try {
        const { shareCode } = req.params;
        const buyerId = req.user.id;

        const deal = await prisma.dealListing.findUnique({
            where: { shareCode },
            include: { seller: { select: { id: true, displayName: true } } }
        });

        if (!deal) return res.status(404).json({ error: 'Deal not found.' });
        if (deal.status !== 'active') return res.status(410).json({ error: 'This deal is no longer active.' });
        if (deal.sellerId === buyerId) return res.status(400).json({ error: 'You cannot inquire on your own deal.' });

        // Build a deterministic chat ID from the two user IDs (same pattern as existing DM logic)
        const [a, b] = [buyerId, deal.sellerId].sort((x, y) => x - y);
        const chatId = `${a}_${b}`;

        // Upsert the inquiry record
        await prisma.dealInquiry.upsert({
            where: { dealId_buyerId: { dealId: deal.id, buyerId } },
            create: { dealId: deal.id, buyerId, chatId, status: 'inquired' },
            update: { chatId, status: 'inquired' },
        });

        // Send a system message in the chat so seller sees context immediately
        const buyer = await prisma.user.findUnique({ where: { id: buyerId }, select: { displayName: true, username: true } });
        const buyerName = buyer?.displayName || buyer?.username || 'Someone';
        const priceStr = `₹${Number(deal.price).toLocaleString('en-IN')}`;
        const systemMessage = `🛍️ *${buyerName}* is interested in buying *${deal.title}* (${priceStr})\n\nDeal: ${process.env.FRONTEND_URL}/deal/${shareCode}`;

        await prisma.message.create({
            data: {
                senderId: buyerId,
                receiverId: deal.sellerId,
                chatId,
                content: systemMessage,
                messageType: 'deal_inquiry',
            }
        });

        // Emit socket event so seller sees the message in real time
        // (app.get('io') is set in server.js)
        try {
            const io = req.app.get('io');
            if (io) {
                io.to(chatId).emit('new_message', {
                    chatId,
                    content: systemMessage,
                    messageType: 'deal_inquiry',
                    senderId: buyerId,
                });
            }
        } catch (_) {}

        res.json({ chatId, message: 'Chat started. Redirecting to chat.' });
    } catch (err) {
        console.error('POST /api/deals/:shareCode/inquire error:', err);
        res.status(500).json({ error: 'Failed to start chat.' });
    }
});

// ─── AUTH: POST /api/deals/:shareCode/accept — buyer accepts deal ─────────────

router.post('/:shareCode/accept', auth, async (req, res) => {
    try {
        const { shareCode } = req.params;
        const buyerId = req.user.id;

        const deal = await prisma.dealListing.findUnique({
            where: { shareCode },
            include: { seller: { select: { id: true, displayName: true } } }
        });

        if (!deal) return res.status(404).json({ error: 'Deal not found.' });
        if (deal.status !== 'active') return res.status(400).json({ error: 'This deal is no longer active.' });
        if (deal.sellerId === buyerId) return res.status(400).json({ error: 'You cannot buy your own deal.' });

        // Deterministic chat ID
        const [a, b] = [buyerId, deal.sellerId].sort((x, y) => x - y);
        const chatId = `${a}_${b}`;

        // Upsert the inquiry
        await prisma.dealInquiry.upsert({
            where: { dealId_buyerId: { dealId: deal.id, buyerId } },
            create: { dealId: deal.id, buyerId, chatId, status: 'accepted' },
            update: { chatId, status: 'accepted' },
        });

        // Check if there's an existing unpaid escrow deal
        let escrowDeal = await prisma.escrowDeal.findFirst({
            where: {
                dealListingId: deal.id,
                clientId: buyerId,
                status: 'pending_payment'
            }
        });

        if (!escrowDeal) {
            // Calculate Shipping
            let shippingFee = 0;
            if (deal.deliveryType === 'shipping') {
                const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
                if (!buyer.pincode) {
                    return res.status(400).json({ error: 'Please add a delivery pincode in your settings before buying a shipped item.' });
                }
                
                try {
                    // Extract origin pincode from seller's pickupAddress if possible, or assume a default format.
                    // For now, we'll try to extract a 6 digit number from pickupAddress.
                    const pincodeMatch = deal.pickupAddress?.match(/\b\d{6}\b/);
                    const originPincode = pincodeMatch ? pincodeMatch[0] : '110001'; // Default if not found

                    const serviceability = await checkServiceability({
                        pickup_postcode: originPincode,
                        delivery_postcode: buyer.pincode,
                        weight: deal.shippingWeight || 1.0,
                        cod: 0
                    });

                    if (serviceability.status === 200 && serviceability.data.available_courier_companies?.length > 0) {
                        shippingFee = serviceability.data.available_courier_companies[0].rate;
                    } else {
                        return res.status(400).json({ error: 'Delivery is not serviceable to your pincode.' });
                    }
                } catch (shippingErr) {
                    console.error('Shipping calculation error:', shippingErr);
                    return res.status(500).json({ error: 'Failed to calculate shipping cost.' });
                }
            }

            const totalAmount = deal.price + shippingFee;

            // Create a new EscrowDeal in pending_payment status
            escrowDeal = await prisma.escrowDeal.create({
                data: {
                    chatId,
                    clientId: buyerId,
                    vendorId: deal.sellerId,
                    title: deal.title,
                    description: deal.description + (shippingFee > 0 ? `\n\nIncludes ₹${shippingFee} shipping fee.` : ''),
                    totalAmount: totalAmount,
                    status: 'pending_payment',
                    paymentStatus: 'pending',
                    dealListingId: deal.id
                }
            });

            // Create a system message in the chat
            const buyerInfo = await prisma.user.findUnique({ where: { id: buyerId }, select: { displayName: true, username: true } });
            const buyerName = buyerInfo?.displayName || buyerInfo?.username || 'Buyer';
            const priceStr = `₹${Number(deal.price).toLocaleString('en-IN')}`;
            const systemMessage = `🛍️ *${buyerName}* accepted the deal *${deal.title}* (${priceStr}).\n\nComplete payment to secure the deal.`;

            await prisma.message.create({
                data: {
                    senderId: buyerId,
                    receiverId: deal.sellerId,
                    chatId,
                    content: systemMessage,
                    messageType: 'escrow_created',
                }
            });

            // Socket emissions
            try {
                const io = req.app.get('io');
                if (io) {
                    io.to(chatId).emit('new_message', {
                        chatId,
                        content: systemMessage,
                        messageType: 'escrow_created',
                        senderId: buyerId,
                    });
                    io.to(`user_${deal.sellerId}`).emit('escrowUpdate', escrowDeal);
                    io.to(`user_${buyerId}`).emit('escrowUpdate', escrowDeal);
                }
            } catch (_) {}
        }

        res.json(escrowDeal);
    } catch (err) {
        console.error('POST /api/deals/:shareCode/accept error:', err);
        res.status(500).json({ error: 'Failed to accept deal.' });
    }
});

// ─── AUTH: GET /api/deals/:id/inquiries — seller sees all buyers ──────────────

router.get('/:id/inquiries', auth, async (req, res) => {
    try {
        const dealId = Number(req.params.id);
        const deal = await prisma.dealListing.findUnique({ where: { id: dealId } });

        if (!deal) return res.status(404).json({ error: 'Deal not found.' });
        if (deal.sellerId !== req.user.id) return res.status(403).json({ error: 'Not your deal.' });

        const inquiries = await prisma.dealInquiry.findMany({
            where: { dealId },
            include: {
                buyer: { select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true } }
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(inquiries);
    } catch (err) {
        console.error('GET /api/deals/:id/inquiries error:', err);
        res.status(500).json({ error: 'Failed to load inquiries.' });
    }
});

// ─── PUBLIC: GET /api/deals/seller/:userId — deals for a seller profile page ──

router.get('/seller/:userId', async (req, res) => {
    try {
        const sellerId = Number(req.params.userId);

        const deals = await prisma.dealListing.findMany({
            where: { sellerId, status: 'active' },
            select: DEAL_SELECT,
            orderBy: { createdAt: 'desc' },
            take: 12,
        });

        res.json(deals);
    } catch (err) {
        console.error('GET /api/deals/seller/:userId error:', err);
        res.status(500).json({ error: 'Failed to load seller deals.' });
    }
});

export default router;
