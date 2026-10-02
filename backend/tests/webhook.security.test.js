/**
 * Proves the delivery webhook is no longer forgeable.
 *
 * A forged "Delivered" update makes a deal eligible for the 3-day auto-release
 * payout, so this exercises the real endpoint: an unsigned or wrongly-signed
 * request must be refused, and a correctly-signed one must be accepted.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { resetDatabase, createUser, createPaidDeal } from './helpers/testDb.js';
import { startTestApp } from './helpers/httpApp.js';

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const { computeSignatures } = await import('../utils/webhookSecurity.js');
const { toAmount } = await import('../utils/decimalJson.js');

const SECRET = 'test-webhook-secret-value';

let app;

test.before(async () => {
    await resetDatabase(prisma);
    process.env.SHIPROCKET_WEBHOOK_SECRET = SECRET;
    process.env.NODE_ENV = 'test';
    app = await startTestApp();
});

test.after(async () => {
    await app?.close();
    delete process.env.SHIPROCKET_WEBHOOK_SECRET;
    await resetDatabase(prisma);
    await prisma.$disconnect();
});

/** A shipped, in-transit deal with a known AWB, ready to receive a webhook. */
async function shippedDeal() {
    const client = await createUser(prisma, { walletBalance: 10000 });
    const vendor = await createUser(prisma, { walletBalance: 0 });
    const deal = await createPaidDeal(prisma, { client, vendor, gross: 10000, feePercent: 0.1 });
    const awb = `AWB${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    await prisma.escrowDeal.update({
        where: { id: deal.id },
        data: { trackingId: awb, shiprocketAwbCode: awb, shippingStatus: 'in_transit' },
    });
    return { client, vendor, deal, awb };
}

function postUpdate(payload, signature) {
    return app.post('/api/webhooks/delivery-updates', {
        body: payload,
        ...(signature === undefined ? {} : { headers: { 'x-shiprocket-signature': signature } }),
    });
}

test('an UNSIGNED delivery update is rejected', async () => {
    const { deal, awb } = await shippedDeal();
    const res = await postUpdate({ awb, current_status: 'Delivered', scans: [] });
    assert.equal(res.status, 401, 'a forged unsigned update must be refused');

    const after = await prisma.escrowDeal.findUnique({ where: { id: deal.id } });
    assert.equal(after.shippingStatus, 'in_transit', 'the status must not change');
    assert.equal(toAmount((await prisma.user.findUnique({ where: { id: after.vendorId } })).walletBalance), 0,
        'no money may move from a forged webhook');
});

test('a WRONGLY SIGNED delivery update is rejected', async () => {
    const { deal, awb } = await shippedDeal();
    const res = await postUpdate({ awb, current_status: 'Delivered' }, 'deadbeef'.repeat(8));
    assert.equal(res.status, 401);
    const after = await prisma.escrowDeal.findUnique({ where: { id: deal.id } });
    assert.equal(after.shippingStatus, 'in_transit');
});

test('a correctly SIGNED delivery update is accepted and marks the deal delivered', async () => {
    const { deal, awb } = await shippedDeal();
    const payload = { awb, current_status: 'Delivered', scans: [{ activity: 'Delivered at doorstep' }] };
    // The endpoint hashes the raw body, so sign exactly what it will receive.
    const body = JSON.stringify(payload);
    const { hex } = computeSignatures(body, SECRET);

    const res = await postUpdate(payload, hex);
    assert.equal(res.status, 200, `signed update rejected: ${res.text}`);

    const after = await prisma.escrowDeal.findUnique({ where: { id: deal.id } });
    assert.equal(after.shippingStatus, 'delivered');
});

test('a signed NDR update is accepted and flagged, and does NOT release funds', async () => {
    const { vendor, deal, awb } = await shippedDeal();
    const payload = { awb, current_status: 'Delivery Failed', scans: [{ activity: 'Address incomplete' }] };
    const { hex } = computeSignatures(JSON.stringify(payload), SECRET);

    const res = await postUpdate(payload, hex);
    assert.equal(res.status, 200, res.text);

    const after = await prisma.escrowDeal.findUnique({ where: { id: deal.id } });
    assert.equal(after.shippingStatus, 'ndr', 'a failed attempt must be recorded as an NDR');
    assert.notEqual(after.shippingStatus, 'delivered');
    assert.equal(toAmount((await prisma.user.findUnique({ where: { id: vendor.id } })).walletBalance), 0,
        'an NDR must never be treated as delivery');
});
