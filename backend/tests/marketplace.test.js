/**
 * Tests for the marketplace hardening pass: webhook security, commission
 * base, NDR handling, wishlist, public tracking and search/sort.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { resetDatabase, createUser, createPaidDeal } from './helpers/testDb.js';
import { startTestApp } from './helpers/httpApp.js';



const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const { verifyWebhookSignature, isNdrStatus, computeSignatures } =
    await import('../utils/webhookSecurity.js');
const { computeFeeSplit, computeCommissionableBase } = await import('../utils/fees.js');
const { toAmount } = await import('../utils/decimalJson.js');


// ======================================================================================
// 1. Webhook signature verification
// ======================================================================================

test('verifyWebhookSignature: accepts a correct hex signature', () => {
    const secret = 'shhh-secret';
    const body = JSON.stringify({ awb: 'ABC123', current_status: 'Delivered' });
    const { hex } = computeSignatures(body, secret);
    const res = verifyWebhookSignature({ rawBody: body, signature: hex, secret });
    assert.equal(res.ok, true);
});

test('verifyWebhookSignature: accepts a correct base64 signature too', () => {
    const secret = 'shhh-secret';
    const body = JSON.stringify({ awb: 'ABC123' });
    const { base64 } = computeSignatures(body, secret);
    assert.equal(verifyWebhookSignature({ rawBody: body, signature: base64, secret }).ok, true);
});

test('verifyWebhookSignature: rejects a forged payload', () => {
    const secret = 'real-secret';
    const res = verifyWebhookSignature({
        rawBody: JSON.stringify({ current_status: 'Delivered' }),
        signature: crypto.createHmac('sha256', 'attacker-secret').update('x').digest('hex'),
        secret,
    });
    assert.equal(res.ok, false, 'a signature from the wrong secret must never pass');
});

test('verifyWebhookSignature: rejects a missing signature even in development', () => {
    // The old code let unsigned requests through when NODE_ENV !== production.
    // That was the hole that made forged delivery updates possible.
    for (const isProduction of [false, true]) {
        const res = verifyWebhookSignature({
            rawBody: '{}',
            signature: undefined,
            secret: 'configured',
            isProduction,
        });
        assert.equal(res.ok, false, `unsigned request accepted (isProduction=${isProduction})`);
        assert.match(res.reason, /Missing/);
    }
});

test('verifyWebhookSignature: fails closed in production when unconfigured', () => {
    const res = verifyWebhookSignature({ rawBody: '{}', signature: 'x', secret: undefined, isProduction: true });
    assert.equal(res.ok, false, 'production must refuse an unconfigured webhook');
    assert.match(res.reason, /not configured/);
});

test('verifyWebhookSignature: warns but allows in dev when unconfigured', () => {
    const res = verifyWebhookSignature({ rawBody: '{}', signature: 'x', secret: undefined, isProduction: false });
    assert.equal(res.ok, true);
    assert.ok(res.warning, 'the missing secret must be surfaced loudly');
    assert.equal(res.unverified, true);
});

test('verifyWebhookSignature: a one-character body change invalidates the signature', () => {
    const secret = 'k';
    const a = JSON.stringify({ current_status: 'Delivered' });
    const b = JSON.stringify({ current_status: 'delivered' });
    const { hex } = computeSignatures(a, secret);
    assert.equal(verifyWebhookSignature({ rawBody: a, signature: hex, secret }).ok, true);
    assert.equal(verifyWebhookSignature({ rawBody: b, signature: hex, secret }).ok, false);
});

// ======================================================================================
// 2. Commission must not be charged on the courier's shipping fee
// ======================================================================================

test('the platform fee excludes the shipping charge', () => {
    const gross = 1000;
    const shipping = 150;
    const split = computeFeeSplit(gross, 0.10, { shippingFee: shipping });
    assert.equal(split.commissionable, 850, 'commission applies to the product value only');
    assert.equal(split.fee, 85, '10% of 850, not 10% of 1000');
    assert.equal(split.shippingFee, 150);
    // The seller still receives everything the buyer paid, minus the fee.
    assert.equal(split.net, 915);
    assert.equal(split.fee + split.net, gross, 'fee + net must still reconstruct gross');
});

test('excluding shipping does not change zero-shipping behaviour', () => {
    const a = computeFeeSplit(1000, 0.10);
    const b = computeFeeSplit(1000, 0.10, { shippingFee: 0 });
    assert.equal(a.fee, b.fee);
    assert.equal(a.net, b.net);
});

test('computeCommissionableBase: never goes negative', () => {
    assert.equal(computeCommissionableBase({ grossAmount: 100, shippingFee: 150 }), 0);
    assert.equal(computeCommissionableBase({ grossAmount: 100, shippingFee: -50 }), 100);
    assert.equal(computeCommissionableBase({ grossAmount: 0, shippingFee: 0 }), 0);
});

// ======================================================================================
// 3. NDR detection
// ======================================================================================

test('isNdrStatus: recognises the courier phrasings for a failed delivery', () => {
    const ndr = [
        'NDR', 'ndr', 'Delivery Failed', 'Not Delivered', 'Undelivered',
        'Address Validation Failed', 'Customer Not Available', 'RTO Initiated',
        'RTO Delivered', 'Return Initiated', 'Recipient Not Available',
        'Address Incomplete', 'Incorrect Address', 'delivery failed attempt',
    ];
    for (const s of ndr) {
        assert.equal(isNdrStatus(s), true, `"${s}" should be an NDR`);
    }
});

test('isNdrStatus: does not misclassify normal transit statuses', () => {
    for (const s of ['Delivered', 'Out For Delivery', 'Picked Up', 'In Transit', 'Shipped', undefined, '']) {
        assert.equal(isNdrStatus(s), false, `"${s}" must not be an NDR`);
    }
});

// ======================================================================================
// 4. HTTP: wishlist, tracking, search hardening
// ======================================================================================

let app;

test.before(async () => {
    await resetDatabase(prisma);
    app = await startTestApp();
});

test.after(async () => {
    await app?.close();
    await resetDatabase(prisma);
    await prisma.$disconnect();
});

async function makeListing(seller, overrides = {}) {
    return prisma.dealListing.create({
        data: {
            shareCode: `W${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
            sellerId: seller.id,
            title: 'Test product',
            description: 'A description',
            price: 500,
            stock: 3,
            ...overrides,
        },
    });
}

test('wishlist: toggle adds, toggles again removes', async () => {
    const seller = await createUser(prisma);
    const buyer = await createUser(prisma);
    const listing = await makeListing(seller);
    const token = app.tokenFor(buyer);

    const add = await app.post('/api/wishlist/toggle', { token, body: { listingId: listing.id } });
    assert.equal(add.status, 200, add.text);
    assert.equal(add.body.wishlisted, true);

    const list = await app.get('/api/wishlist', { token });
    assert.equal(list.status, 200);
    assert.equal(list.body.total, 1);
    assert.equal(list.body.items[0].id, listing.id);

    const remove = await app.post('/api/wishlist/toggle', { token, body: { listingId: listing.id } });
    assert.equal(remove.body.wishlisted, false);

    const after = await app.get('/api/wishlist', { token });
    assert.equal(after.body.total, 0, 'toggling off must remove the entry');
});

test('wishlist: a seller cannot save their own listing', async () => {
    const seller = await createUser(prisma);
    const listing = await makeListing(seller);
    const res = await app.post('/api/wishlist/toggle', {
        token: app.tokenFor(seller),
        body: { listingId: listing.id },
    });
    assert.equal(res.status, 400);
});

test('wishlist: requires auth and validates input', async () => {
    const res1 = await app.post('/api/wishlist/toggle', { body: { listingId: 1 } });
    assert.equal(res1.status, 401);
    const res2 = await app.post('/api/wishlist/toggle', { token: app.tokenFor(await createUser(prisma)), body: { listingId: 'abc' } });
    assert.equal(res2.status, 400);
});

test('wishlist: /ids returns ids for cheap heart hydration', async () => {
    const seller = await createUser(prisma);
    const buyer = await createUser(prisma);
    const a = await makeListing(seller);
    await makeListing(seller);
    await app.post('/api/wishlist/toggle', { token: app.tokenFor(buyer), body: { listingId: a.id } });

    const res = await app.get('/api/wishlist/ids', { token: app.tokenFor(buyer) });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.listingIds, [a.id]);
});

test('tracking: a shipment is trackable by tracking id with no auth', async () => {
    const client = await createUser(prisma, { walletBalance: 10000 });
    const vendor = await createUser(prisma);
    const deal = await createPaidDeal(prisma, { client, vendor, gross: 10000, feePercent: 0.1 });
    await prisma.escrowDeal.update({
        where: { id: deal.id },
        data: {
            trackingId: 'TRK123456',
            shiprocketAwbCode: 'TRK123456',
            shippingStatus: 'in_transit',
            shippingEvents: [{ status: 'in_transit', title: 'Shipped', description: 'Picked up' }],
        },
    });

    const res = await app.get('/api/shipping/track/TRK123456');
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.trackingId, 'TRK123456');
    assert.equal(res.body.delivered, false);
    assert.equal(res.body.isNdr, false);
    assert.ok(Array.isArray(res.body.timeline));

    // The public payload must never leak money.
    assert.equal(res.body.totalAmount, undefined);
    assert.equal(res.body.walletBalance, undefined);
    assert.equal(res.body.clientId, undefined);
});

test('tracking: an unknown id 404s, and a too-short id 400s', async () => {
    assert.equal((await app.get('/api/shipping/track/NOPE12345')).status, 404);
    assert.equal((await app.get('/api/shipping/track/ab')).status, 400);
});

test('tracking: an NDR shipment is flagged for the buyer', async () => {
    const client = await createUser(prisma, { walletBalance: 10000 });
    const vendor = await createUser(prisma);
    const deal = await createPaidDeal(prisma, { client, vendor, gross: 500, feePercent: 0.1 });
    await prisma.escrowDeal.update({
        where: { id: deal.id },
        data: { trackingId: 'NDR999', shippingStatus: 'ndr', shippingEvents: [] },
    });
    const res = await app.get('/api/shipping/track/NDR999');
    assert.equal(res.status, 200);
    assert.equal(res.body.isNdr, true);
    assert.equal(res.body.delivered, false);
});

test('search: limit is clamped so one request cannot dump the table', async () => {
    const seller = await createUser(prisma);
    for (let i = 0; i < 5; i += 1) await makeListing(seller);

    const res = await app.get('/api/deals/public?limit=100000');
    assert.equal(res.status, 200);
    assert.ok(res.body.limit <= 60, `limit must be clamped, got ${res.body.limit}`);
    assert.ok(res.body.deals.length <= 60);
});

test('search: sort options are whitelisted and actually apply', async () => {
    const seller = await createUser(prisma);
    const cheap = await makeListing(seller, { title: 'Cheap thing', price: 100 });
    const dear = await makeListing(seller, { title: 'Pricey thing', price: 9000 });

    const asc = await app.get('/api/deals/public?sort=price_asc');
    assert.equal(asc.status, 200);
    const ascPrices = asc.body.deals.map((d) => Number(d.price));
    assert.deepEqual(ascPrices, [...ascPrices].sort((a, b) => a - b), 'price_asc must be sorted');

    const desc = await app.get('/api/deals/public?sort=price_desc');
    const descPrices = desc.body.deals.map((d) => Number(d.price));
    assert.deepEqual(descPrices, [...descPrices].sort((a, b) => b - a), 'price_desc must be sorted');

    // A bogus sort must fall back rather than error or inject.
    const bogus = await app.get('/api/deals/public?sort=;DROP TABLE');
    assert.equal(bogus.status, 200);
    assert.equal(bogus.body.sort, 'recent');
});

test('search: out-of-stock listings are hidden unless requested', async () => {
    const seller = await createUser(prisma);
    await makeListing(seller, { title: 'In stock item', stock: 5 });
    await makeListing(seller, { title: 'Sold out item', stock: 0 });

    const normal = await app.get('/api/deals/public');
    const titles = normal.body.deals.map((d) => d.title);
    assert.ok(titles.includes('In stock item'));
    assert.ok(!titles.includes('Sold out item'), 'sold-out items must not surface by default');

    const all = await app.get('/api/deals/public?includeOutOfStock=true');
    assert.ok(all.body.deals.map((d) => d.title).includes('Sold out item'));
});

test('search: money fields are JSON numbers, never Decimal strings', async () => {
    const seller = await createUser(prisma);
    await makeListing(seller, { price: 1234.56, mrp: 2000 });
    const res = await app.get('/api/deals/public');
    assert.equal(res.status, 200);
    const d = res.body.deals[0];
    assert.equal(typeof d.price, 'number');
    assert.equal(typeof d.mrp, 'number');
    assert.equal(toAmount(d.price), 1234.56);
});

test('shipping fee is persisted on the deal and excluded from the fee', async () => {
    const client = await createUser(prisma, { walletBalance: 50000 });
    const vendor = await createUser(prisma);
    const listing = await makeListing(vendor, { price: 1000 });
    const deal = await createPaidDeal(prisma, { client, vendor, gross: 1150, feePercent: 0.1 });

    await prisma.escrowDeal.update({ where: { id: deal.id }, data: { shippingFee: 150 } });
    const stored = await prisma.escrowDeal.findUnique({ where: { id: deal.id } });
    assert.equal(toAmount(stored.shippingFee), 150);

    const { fee } = computeFeeSplit(toAmount(stored.totalAmount), 0.1, {
        shippingFee: toAmount(stored.shippingFee),
    });
    // Product value is 1000, so the platform earns 100 - not 115, which is what
    // 10% of the 1150 total (i.e. including the courier's 150) would have given.
    assert.equal(fee, 100, 'commission applies to the 1000 product value only');
    const withoutFix = computeFeeSplit(toAmount(stored.totalAmount), 0.1).fee;
    assert.equal(withoutFix, 115, 'without the fix the platform would take a cut of shipping');
    assert.ok(listing.id);
});
