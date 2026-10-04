import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { checkServiceability } from '../services/shiprocketService.js';

const prisma = new PrismaClient();
const router = express.Router();

// ─── Validation helpers (per deliverydata.md) ─────────────────────────────────

const VALID_STATE_CODES = [
    'AN', 'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'CT',
    'DD', 'DL', 'DN', 'GA', 'GJ', 'HR', 'HP', 'JK',
    'JH', 'KA', 'KL', 'LA', 'LD', 'MH', 'ML', 'MN',
    'ME', 'MZ', 'NL', 'OD', 'PB', 'PY', 'RJ', 'SK',
    'TN', 'TR', 'TS', 'UP', 'UK', 'WB'
];

function validateAddressFields({ fullName, phoneNumber, addressLine1, city, state, pincode }) {
    const errors = [];

    if (!fullName || fullName.trim().length < 3) errors.push('Full name must be at least 3 characters');
    if (!/^[a-zA-Z\s\-']+$/.test(fullName?.trim())) errors.push('Name can only contain letters, spaces, hyphens, and apostrophes');

    if (!/^[6-9]\d{9}$/.test(phoneNumber)) errors.push('Invalid Indian phone number (must be 10 digits starting with 6-9)');

    if (!addressLine1 || addressLine1.trim().length < 10) errors.push('Street address must be at least 10 characters');
    const blocked = ['PO BOX', 'P.O BOX', 'P O BOX', 'POST BOX'];
    if (blocked.some(kw => addressLine1?.toUpperCase().includes(kw))) errors.push('PO Box addresses are not supported by couriers');

    if (!city || city.trim().length < 2) errors.push('City is required');

    if (!VALID_STATE_CODES.includes(state)) errors.push(`Invalid state code '${state}'. Use 2-letter code like MH, DL, KA`);

    if (!/^\d{6}$/.test(pincode)) errors.push('Pincode must be exactly 6 digits');

    return errors;
}

// ─── POST /api/order-addresses — Save buyer delivery address ──────────────────

router.post('/', auth, async (req, res) => {
    try {
        const {
            fullName,
            phoneNumber,
            email,
            addressType = 'home',
            addressLine1,
            addressLine2,
            landmark,
            city,
            state,
            pincode,
            isDefault = false,
            isBillingSame = true,
            dealId, // optional: link address directly to a deal
            checkPincodeServiceability = true
        } = req.body;

        // Validate required fields
        const validationErrors = validateAddressFields({ fullName, phoneNumber, addressLine1, city, state, pincode });
        if (validationErrors.length > 0) {
            return res.status(400).json({ error: 'Validation failed', details: validationErrors });
        }

        // Optional: Check ShipRocket serviceability for pincode
        if (checkPincodeServiceability) {
            try {
                const serviceabilityData = await checkServiceability({
                    pickup_postcode: process.env.SHIPROCKET_DEFAULT_PICKUP_PINCODE || '400001',
                    delivery_postcode: pincode,
                    weight: 0.5,
                    cod: 0
                });

                const couriers = serviceabilityData?.data?.available_courier_companies || [];
                if (couriers.length === 0 && !process.env.SHIPROCKET_EMAIL) {
                    // Only fail in production when SR is properly configured
                    // In dev/dummy mode, always proceed
                }
            } catch (srErr) {
                console.warn('[OrderAddress] ShipRocket serviceability check failed (non-blocking):', srErr.message);
                // Non-blocking — let the address save proceed
            }
        }

        // If setting as default, unset previous defaults for this user
        if (isDefault) {
            await prisma.orderAddress.updateMany({
                where: { buyerId: req.user.id, isDefault: true },
                data: { isDefault: false }
            });
        }

        const address = await prisma.orderAddress.create({
            data: {
                buyerId: req.user.id,
                fullName: fullName.trim(),
                phoneNumber: phoneNumber.trim(),
                email: email?.trim() || null,
                addressType: ['home', 'work', 'other'].includes(addressType) ? addressType : 'home',
                addressLine1: addressLine1.trim(),
                addressLine2: addressLine2?.trim() || null,
                landmark: landmark?.trim() || null,
                city: city.trim(),
                state: state.trim().toUpperCase(),
                country: 'IN',
                pincode: pincode.trim(),
                isDefault,
                isBillingSame
            }
        });

        // If dealId provided, link address to escrow deal
        if (dealId) {
            const deal = await prisma.escrowDeal.findUnique({ where: { id: parseInt(dealId) } });
            if (deal && deal.clientId === req.user.id) {
                await prisma.escrowDeal.update({
                    where: { id: parseInt(dealId) },
                    data: { shippingAddressId: address.id }
                });
            }
        }

        res.status(201).json(address);
    } catch (err) {
        console.error('Create order address error:', err);
        res.status(500).json({ error: 'Failed to save delivery address.' });
    }
});

// ─── GET /api/order-addresses — Get all addresses for current user ─────────────

router.get('/', auth, async (req, res) => {
    try {
        const addresses = await prisma.orderAddress.findMany({
            where: { buyerId: req.user.id },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
        });
        res.json(addresses);
    } catch (err) {
        console.error('Get order addresses error:', err);
        res.status(500).json({ error: 'Failed to fetch addresses.' });
    }
});

// ─── GET /api/order-addresses/deal/:dealId — Get address for a specific deal ──

router.get('/deal/:dealId', auth, async (req, res) => {
    try {
        const dealId = parseInt(req.params.dealId);
        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId },
            include: { shippingAddress: true }
        });

        if (!deal) return res.status(404).json({ error: 'Deal not found.' });

        // Only client or vendor can view the shipping address
        if (deal.clientId !== req.user.id && deal.vendorId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized.' });
        }

        res.json(deal.shippingAddress || null);
    } catch (err) {
        console.error('Get deal address error:', err);
        res.status(500).json({ error: 'Failed to fetch shipping address.' });
    }
});

// ─── PUT /api/order-addresses/:id — Update an address ─────────────────────────

router.put('/:id', auth, async (req, res) => {
    try {
        const addressId = parseInt(req.params.id);
        const existing = await prisma.orderAddress.findUnique({ where: { id: addressId } });

        if (!existing) return res.status(404).json({ error: 'Address not found.' });
        if (existing.buyerId !== req.user.id) return res.status(403).json({ error: 'Not authorized.' });

        const {
            fullName, phoneNumber, email, addressType,
            addressLine1, addressLine2, landmark,
            city, state, pincode, isDefault, isBillingSame
        } = req.body;

        // Validate any provided fields
        const toValidate = {
            fullName: fullName ?? existing.fullName,
            phoneNumber: phoneNumber ?? existing.phoneNumber,
            addressLine1: addressLine1 ?? existing.addressLine1,
            city: city ?? existing.city,
            state: state ?? existing.state,
            pincode: pincode ?? existing.pincode
        };
        const validationErrors = validateAddressFields(toValidate);
        if (validationErrors.length > 0) {
            return res.status(400).json({ error: 'Validation failed', details: validationErrors });
        }

        if (isDefault) {
            await prisma.orderAddress.updateMany({
                where: { buyerId: req.user.id, isDefault: true, id: { not: addressId } },
                data: { isDefault: false }
            });
        }

        const updated = await prisma.orderAddress.update({
            where: { id: addressId },
            data: {
                ...(fullName !== undefined && { fullName: fullName.trim() }),
                ...(phoneNumber !== undefined && { phoneNumber: phoneNumber.trim() }),
                ...(email !== undefined && { email: email?.trim() || null }),
                ...(addressType !== undefined && { addressType }),
                ...(addressLine1 !== undefined && { addressLine1: addressLine1.trim() }),
                ...(addressLine2 !== undefined && { addressLine2: addressLine2?.trim() || null }),
                ...(landmark !== undefined && { landmark: landmark?.trim() || null }),
                ...(city !== undefined && { city: city.trim() }),
                ...(state !== undefined && { state: state.trim().toUpperCase() }),
                ...(pincode !== undefined && { pincode: pincode.trim() }),
                ...(isDefault !== undefined && { isDefault }),
                ...(isBillingSame !== undefined && { isBillingSame })
            }
        });

        res.json(updated);
    } catch (err) {
        console.error('Update order address error:', err);
        res.status(500).json({ error: 'Failed to update address.' });
    }
});

// ─── DELETE /api/order-addresses/:id — Delete an address ──────────────────────

router.delete('/:id', auth, async (req, res) => {
    try {
        const addressId = parseInt(req.params.id);
        const existing = await prisma.orderAddress.findUnique({ where: { id: addressId } });

        if (!existing) return res.status(404).json({ error: 'Address not found.' });
        if (existing.buyerId !== req.user.id) return res.status(403).json({ error: 'Not authorized.' });

        await prisma.orderAddress.delete({ where: { id: addressId } });
        res.json({ success: true });
    } catch (err) {
        console.error('Delete order address error:', err);
        res.status(500).json({ error: 'Failed to delete address.' });
    }
});

// ─── POST /api/order-addresses/link-deal — Link existing address to a deal ────

router.post('/link-deal', auth, async (req, res) => {
    try {
        const { addressId, dealId } = req.body;

        if (!addressId || !dealId) {
            return res.status(400).json({ error: 'addressId and dealId are required.' });
        }

        const [address, deal] = await Promise.all([
            prisma.orderAddress.findUnique({ where: { id: parseInt(addressId) } }),
            prisma.escrowDeal.findUnique({ where: { id: parseInt(dealId) } })
        ]);

        if (!address) return res.status(404).json({ error: 'Address not found.' });
        if (!deal) return res.status(404).json({ error: 'Deal not found.' });
        if (address.buyerId !== req.user.id) return res.status(403).json({ error: 'Not authorized.' });
        if (deal.clientId !== req.user.id) return res.status(403).json({ error: 'Not authorized.' });

        const updated = await prisma.escrowDeal.update({
            where: { id: parseInt(dealId) },
            data: { shippingAddressId: parseInt(addressId) }
        });

        res.json({ success: true, shippingAddressId: parseInt(addressId) });
    } catch (err) {
        console.error('Link deal address error:', err);
        res.status(500).json({ error: 'Failed to link address to deal.' });
    }
});

export default router;
