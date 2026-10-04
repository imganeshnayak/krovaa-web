/**
 * Regression test for the 3-day escrow auto-release cron.
 *
 * The cron used to write `releasedAmount` to EscrowDeal, a column that does not
 * exist in the Prisma schema. Every run threw inside the per-deal try/catch and
 * logged "Failed to auto-release deal N", so no deal was ever auto-released and
 * the vendor silently kept waiting for money that would never arrive.
 *
 * This test runs the real cron function against a delivered, paid deal and
 * asserts the vendor actually gets paid.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    useTestDatabase,
    resetDatabase,
    createUser,
    createPaidDeal,
    reloadDeal,
    balance,
} from './helpers/testDb.js';

useTestDatabase();

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const { checkAndAutoReleaseEscrow } = await import('../services/cronService.js');
const { computeFeeSplit, sumRecordedPlatformFee, sumReleasedToVendor } = await import('../utils/fees.js');

const GROSS = 10000;
const FEE_PCT = 0.10;
const { fee: FEE, net: NET } = computeFeeSplit(GROSS, FEE_PCT);

/** Mark a deal delivered and backdate it past the 3-day confirmation window. */
async function markDeliveredAndAged(dealId) {
    const threeDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    await prisma.escrowDeal.update({
        where: { id: dealId },
        data: { shippingStatus: 'delivered', updatedAt: threeDaysAgo },
    });
}

test.before(async () => {
    await resetDatabase(prisma);
});

test.after(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
});

test('cron auto-releases a delivered deal and pays the vendor the net', async () => {
    const client = await createUser(prisma, { walletBalance: 50000 });
    const vendor = await createUser(prisma, { walletBalance: 0 });
    const deal = await createPaidDeal(prisma, { client, vendor, gross: GROSS, feePercent: FEE_PCT });
    await markDeliveredAndAged(deal.id);

    await checkAndAutoReleaseEscrow();

    // The regression: this used to throw on the phantom `releasedAmount` field.
    const stored = await reloadDeal(prisma, deal.id);
    assert.notEqual(stored.status, 'active', 'deal should have left the active state');
    assert.equal(stored.releasedPercent, 100, 'deal must be marked fully released');

    const vendorAfter = await balance(prisma, vendor.id);
    assert.equal(vendorAfter.walletBalance, NET, 'vendor must receive gross minus the platform fee');

    // The payout must be recorded, so seller stats and audits can see it.
    assert.equal(sumReleasedToVendor(stored.transactions), NET);
    assert.equal(sumRecordedPlatformFee(stored.transactions), FEE, 'the fee row must survive auto-release');
});

test('cron settles on the recorded fee even after the configured rate changes', async () => {
    const client = await createUser(prisma, { walletBalance: 50000 });
    const vendor = await createUser(prisma, { walletBalance: 0 });
    const deal = await createPaidDeal(prisma, { client, vendor, gross: GROSS, feePercent: FEE_PCT });
    await markDeliveredAndAged(deal.id);

    // Admin raises the live rate to 25% before the cron fires.
    await prisma.systemSetting.upsert({
        where: { key: 'platform_fee_percent' },
        update: { value: '0.25' },
        create: { key: 'platform_fee_percent', value: '0.25' },
    });

    await checkAndAutoReleaseEscrow();

    const vendorAfter = await balance(prisma, vendor.id);
    assert.equal(vendorAfter.walletBalance, NET, 'must settle at the fee recorded at payment (9000, not 7500)');
});

test('cron leaves deals that are not yet past the confirmation window alone', async () => {
    const client = await createUser(prisma, { walletBalance: 50000 });
    const vendor = await createUser(prisma, { walletBalance: 0 });
    const deal = await createPaidDeal(prisma, { client, vendor, gross: GROSS, feePercent: FEE_PCT });

    // Delivered, but only just — still inside the 3-day window.
    await prisma.escrowDeal.update({
        where: { id: deal.id },
        data: { shippingStatus: 'delivered' },
    });

    await checkAndAutoReleaseEscrow();

    const stored = await reloadDeal(prisma, deal.id);
    assert.equal(stored.status, 'active', 'deal should still be active');
    assert.equal(stored.releasedPercent, 0);
    assert.equal((await balance(prisma, vendor.id)).walletBalance, 0, 'vendor must not be paid early');
});

test('cron skips unpaid deals entirely', async () => {
    const client = await createUser(prisma);
    const vendor = await createUser(prisma);
    const deal = await prisma.escrowDeal.create({
        data: {
            chatId: `test_chat_cron_${Date.now()}`,
            clientId: client.id,
            vendorId: vendor.id,
            title: 'Unpaid delivered deal',
            totalAmount: GROSS,
            status: 'active',
            paymentStatus: 'pending',
            shippingStatus: 'delivered',
            updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        },
    });

    await checkAndAutoReleaseEscrow();

    const stored = await reloadDeal(prisma, deal.id);
    assert.equal(stored.status, 'active');
    assert.equal((await balance(prisma, vendor.id)).walletBalance, 0);
});

test('cron is idempotent: a second run does not pay the vendor again', async () => {
    const client = await createUser(prisma, { walletBalance: 50000 });
    const vendor = await createUser(prisma, { walletBalance: 0 });
    const deal = await createPaidDeal(prisma, { client, vendor, gross: GROSS, feePercent: FEE_PCT });
    await markDeliveredAndAged(deal.id);

    await checkAndAutoReleaseEscrow();
    assert.equal((await balance(prisma, vendor.id)).walletBalance, NET);

    // Re-age the deal and run again, as if the cron fired twice.
    await markDeliveredAndAged(deal.id);
    await checkAndAutoReleaseEscrow();

    assert.equal(
        (await balance(prisma, vendor.id)).walletBalance,
        NET,
        'a second cron run must not pay the vendor a second time'
    );
});
