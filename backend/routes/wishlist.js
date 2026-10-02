/**
 * Wishlist / save-for-later.
 *
 * A save button is table stakes on any modern marketplace: it is one of the
 * cheapest conversion levers available, because an unsaved product is a lost
 * sale whether or not the buyer intends to return.
 *
 * The endpoint is idempotent-toggle shaped (`POST /toggle`) because that is what
 * a heart button needs, and a separate `isWishlisted` flag is returned with the
 * listing list so the UI can render filled hearts without N+1 lookups.
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { sendUserNotification } from './notifications.js';

const prisma = new PrismaClient();
const router = express.Router();

const LISTING_SELECT = {
    id: true,
    shareCode: true,
    title: true,
    price: true,
    mrp: true,
    imageUrls: true,
    deliveryType: true,
    status: true,
    stock: true,
    createdAt: true,
};

/**
 * POST /api/wishlist/toggle
 * Body: { listingId }
 * Adds the listing if absent, removes it if present. Returns the new state.
 */
router.post('/toggle', auth, async (req, res) => {
    try {
        const listingId = Number(req.body?.listingId);
        if (!Number.isInteger(listingId) || listingId <= 0) {
            return res.status(400).json({ error: 'A valid listingId is required.' });
        }

        const listing = await prisma.dealListing.findUnique({
            where: { id: listingId },
            select: { id: true, title: true, sellerId: true, status: true },
        });
        if (!listing) return res.status(404).json({ error: 'Listing not found.' });
        if (listing.sellerId === req.user.id) {
            return res.status(400).json({ error: 'You cannot save your own listing.' });
        }

        const existing = await prisma.listingWishlist.findUnique({
            where: { userId_listingId: { userId: req.user.id, listingId } },
        });

        if (existing) {
            await prisma.listingWishlist.delete({ where: { id: existing.id } });
            return res.json({ wishlisted: false, listingId });
        }

        await prisma.listingWishlist.create({ data: { userId: req.user.id, listingId } });
        return res.json({ wishlisted: true, listingId });
    } catch (err) {
        console.error('POST /api/wishlist/toggle error:', err);
        res.status(500).json({ error: 'Failed to update wishlist.' });
    }
});

/** GET /api/wishlist - the signed-in user's saved listings, newest first. */
router.get('/', auth, async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const where = { userId: req.user.id };
        const [items, total] = await Promise.all([
            prisma.listingWishlist.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    listing: {
                        select: {
                            ...LISTING_SELECT,
                            seller: { select: { id: true, displayName: true, username: true, avatarUrl: true, verified: true } },
                        },
                    },
                },
            }),
            prisma.listingWishlist.count({ where }),
        ]);

        res.json({
            items: items.map((i) => ({ ...i.listing, savedAt: i.createdAt })),
            total,
            page,
            hasMore: skip + items.length < total,
        });
    } catch (err) {
        console.error('GET /api/wishlist error:', err);
        res.status(500).json({ error: 'Failed to load wishlist.' });
    }
});

/** GET /api/wishlist/ids - just the ids, for cheap heart-state hydration. */
router.get('/ids', auth, async (req, res) => {
    try {
        const rows = await prisma.listingWishlist.findMany({
            where: { userId: req.user.id },
            select: { listingId: true },
        });
        res.json({ listingIds: rows.map((r) => r.listingId) });
    } catch (err) {
        console.error('GET /api/wishlist/ids error:', err);
        res.status(500).json({ error: 'Failed to load wishlist.' });
    }
});

/** DELETE /api/wishlist/:listingId - explicit remove. */
router.delete('/:listingId', auth, async (req, res) => {
    try {
        const listingId = Number(req.params.listingId);
        if (!Number.isInteger(listingId)) {
            return res.status(400).json({ error: 'A valid listingId is required.' });
        }
        await prisma.listingWishlist.deleteMany({ where: { userId: req.user.id, listingId } });
        res.json({ success: true, wishlisted: false, listingId });
    } catch (err) {
        console.error('DELETE /api/wishlist/:listingId error:', err);
        res.status(500).json({ error: 'Failed to remove from wishlist.' });
    }
});

export default router;
