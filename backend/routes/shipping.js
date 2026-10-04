import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { checkServiceability, trackShipment } from '../services/shiprocketService.js';
import { isNdrStatus } from '../utils/webhookSecurity.js';
import { toAmount } from '../utils/decimalJson.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Public order tracking.
 *
 * Buyers expect to track a parcel from a link or order number, and support staff
 * need to look up an AWB. This exposes tracking by id with no authentication -
 * the response is deliberately limited to non-sensitive, non-financial fields so
 * it cannot leak order values or wallet data.
 */
router.get('/track/:trackingId', async (req, res) => {
    try {
        const { trackingId } = req.params;
        if (!trackingId || trackingId.length < 4) {
            return res.status(400).json({ error: 'A valid tracking ID is required.' });
        }

        const deal = await prisma.escrowDeal.findFirst({
            where: {
                OR: [
                    { trackingId: { equals: trackingId, mode: 'insensitive' } },
                    { shiprocketAwbCode: { equals: trackingId, mode: 'insensitive' } },
                ],
            },
            include: { shippingAddress: { select: { city: true, state: true } } },
        });

        if (!deal) {
            return res.status(404).json({ error: 'No shipment found for that tracking ID.' });
        }

        // Live courier status when the provider is reachable; otherwise fall back
        // to the stored webhook events, so tracking never renders blank.
        let live = null;
        try {
            const res2 = await trackShipment(trackingId);
            if (res2 && res2.status === 200 && res2.data) live = res2.data;
        } catch {
            live = null;
        }

        const events = Array.isArray(deal.shippingEvents) ? deal.shippingEvents : [];
        const scans = Array.isArray(live?.scans) ? live.scans : [];
        const timeline = (scans.length ? scans : events).slice(0, 25);

        res.json({
            trackingId: deal.trackingId || deal.shiprocketAwbCode,
            courier: live?.courier_name || null,
            status: deal.shippingStatus,
            isNdr: isNdrStatus(deal.shippingStatus),
            delivered: deal.shippingStatus === 'delivered',
            destination: deal.shippingAddress
                ? [deal.shippingAddress.city, deal.shippingAddress.state].filter(Boolean).join(', ')
                : null,
            timeline: timeline.map((e) => ({
                status: e.status || e.current_status || null,
                title: e.title || e.activity || null,
                description: e.description || null,
                location: e.location || null,
                at: e.date || e.timestamp || e.createdAt || null,
            })),
            updatedAt: deal.updatedAt,
        });
    } catch (err) {
        console.error('GET /api/shipping/track/:trackingId error:', err);
        res.status(500).json({ error: 'Failed to fetch tracking details.' });
    }
});

// ─── AUTH: GET /api/shipping/rates — Calculate shipping rates ──────────────

router.get('/rates', auth, async (req, res) => {
    try {
        const { dealId, pincode } = req.query;

        if (!dealId || !pincode) {
            return res.status(400).json({ error: 'dealId and pincode are required.' });
        }

        const deal = await prisma.dealListing.findUnique({
            where: { id: Number(dealId) },
            include: { seller: true }
        });

        if (!deal) return res.status(404).json({ error: 'Deal not found.' });

        const pickup_postcode = deal.seller.businessPincode;
        if (!pickup_postcode) {
            return res.status(400).json({ error: 'Seller has not set up a pickup location.' });
        }

        const weight = deal.shippingWeight || 0.5;

        const result = await checkServiceability({
            pickup_postcode,
            delivery_postcode: pincode,
            weight,
            cod: 0
        });

        if (result && result.status === 200 && result.data && result.data.available_courier_companies) {
            // Return cheapest-first so clients can present the best price first.
            const rates = [...result.data.available_courier_companies]
                .filter((c) => Number.isFinite(Number(c.rate)))
                .sort((a, b) => Number(a.rate) - Number(b.rate))
                .map((c) => ({ ...c, rate: toAmount(c.rate) }));
            res.json({ rates });
        } else {
             res.status(400).json({ error: 'No shipping available for this pincode.', details: result });
        }
    } catch (err) {
        console.error('GET /api/shipping/rates error:', err);
        res.status(500).json({ error: 'Failed to calculate shipping rates.' });
    }
});

export default router;
