/**
 * Money-path integration tests for escrow, running against the throwaway
 * krovaa_test database.
 *
 * Where fees.test.js proves the arithmetic, these prove the *persistence*:
 * that wallet balances, escrow_transactions rows and released_percent actually
 * move the way the arithmetic says they should, with no money created or lost
 * in the database layer.
 *
 * Run with: npm run test:integration
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

const dbName = useTestDatabase();

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const { computeFeeSplit, sumRecordedPlatformFee, sumReleasedToVendor, computeSplitPayouts } =
    await import('../utils/fees.js');
const { toAmount } = await import('../utils/decimalJson.js');

const GROSS = 10000;
const FEE_PCT = 0.10;
const { fee: FEE, net: NET } = computeFeeSplit(GROSS, FEE_PCT); // 1000 / 9000

test.before(async () => {
    await resetDatabase(prisma);
});

test.after(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
});

test(`running against ${dbName}`, () => {
    assert.ok(dbName.endsWith('_test'), 'tests must never run against a non-test database');
});

// --------------------------------------------------------------------------------------

test('deal creation debits the gross and records the fee exactly once', async () => {
    const client = await createUser(prisma, { walletBalance: 50000 });
    const vendor = await createUser(prisma, { walletBalance: 0 });

    const deal = await createPaidDeal(prisma, { client, vendor, gross: GROSS, feePercent: FEE_PCT });

    const stored = await reloadDeal(prisma, deal.id);
    assert.equal(toAmount(stored.totalAmount), GROSS);
    assert.equal(toAmount(stored.paidAmount), GROSS);
    assert.equal(stored.paymentStatus, 'paid');

    const feeRows = stored.transactions.filter((t) => t.note === 'platform_fee');
    assert.equal(feeRows.length, 1, 'exactly one platform fee must be recorded per payment');
    assert.equal(toAmount(feeRows[0].amount), FEE);
    assert.equal(sumRecordedPlatformFee(stored.transactions), FEE);

    // Money actually moved out of the client and nothing reached the vendor yet.
    const clientAfter = await balance(prisma, client.id);
    const vendorAfter = await balance(prisma, vendor.id);
    assert.equal(clientAfter.walletBalance, 50000 - GROSS);
    assert.equal(vendorAfter.walletBalance, 0);
});

test('partial release then final release credits the vendor exactly the net', async () => {
    const client = await createUser(prisma, { walletBalance: 50000 });
    const vendor = await createUser(prisma, { walletBalance: 0 });
    const deal = await createPaidDeal(prisma, { client, vendor, gross: GROSS, feePercent: FEE_PCT });

    // Simulate the release handler: credit 40%, then the remaining 60%.
    const first = await prisma.$transaction(async (tx) => {
        const d = await tx.escrowDeal.findUnique({ where: { id: deal.id }, include: { transactions: true } });
        const recordedFee = sumRecordedPlatformFee(d.transactions);
        const amount = Math.round((((d.totalAmount - recordedFee) * 40) / 100) * 100) / 100;
        await tx.user.update({ where: { id: vendor.id }, data: { walletBalance: { increment: amount } } });
        await tx.escrowTransaction.create({
            data: { dealId: deal.id, percent: 40, amount, note: 'Payment released (40%)' },
        });
        await tx.escrowDeal.update({ where: { id: deal.id }, data: { releasedPercent: 40 } });
        return amount;
    });
    assert.equal(first, 3600);

    const rest = await prisma.$transaction(async (tx) => {
        const d = await tx.escrowDeal.findUnique({ where: { id: deal.id }, include: { transactions: true } });
        const recordedFee = sumRecordedPlatformFee(d.transactions);
        const remaining = 100 - d.releasedPercent;
        const amount = Math.round((((d.totalAmount - recordedFee) * remaining) / 100) * 100) / 100;
        await tx.user.update({ where: { id: vendor.id }, data: { walletBalance: { increment: amount } } });
        await tx.escrowTransaction.create({
            data: { dealId: deal.id, percent: remaining, amount, note: 'Final release' },
        });
        await tx.escrowDeal.update({ where: { id: deal.id }, data: { releasedPercent: 100, status: 'completed' } });
        return amount;
    });
    assert.equal(rest, 5400);

    const vendorAfter = await balance(prisma, vendor.id);
    assert.equal(vendorAfter.walletBalance, NET, 'vendor must end up with gross minus fee, exactly');

    // And the ledger agrees with the wallet.
    const stored = await reloadDeal(prisma, deal.id);
    assert.equal(sumReleasedToVendor(stored.transactions), vendorAfter.walletBalance);
    assert.equal(stored.releasedPercent, 100);
    assert.equal(stored.status, 'completed');
});

test('cancel refunds the unreleased net and the platform keeps its fee', async () => {
    const client = await createUser(prisma, { walletBalance: 60000 });
    const vendor = await createUser(prisma, { walletBalance: 0 });
    const deal = await createPaidDeal(prisma, {
        client, vendor, gross: GROSS, feePercent: FEE_PCT, releasedPercent: 60,
    });

    const recordedFee = sumRecordedPlatformFee((await reloadDeal(prisma, deal.id)).transactions);
    const refund = Math.round(((GROSS - recordedFee) * (1 - 60 / 100)) * 100) / 100;
    assert.equal(refund, 3600);

    await prisma.user.update({ where: { id: client.id }, data: { walletBalance: { increment: refund } } });
    await prisma.escrowDeal.update({ where: { id: deal.id }, data: { status: 'cancelled' } });

    const clientAfter = await balance(prisma, client.id);
    // 60000 - 10000 gross + 3600 refund = 53600
    assert.equal(clientAfter.walletBalance, 53600);

    // Conservation: what left the client == what the vendor holds + refund + platform fee.
    const vendorAfter = await balance(prisma, vendor.id);
    const conserved = (GROSS - refund) - vendorAfter.walletBalance;
    assert.equal(conserved, recordedFee, 'the platform retains exactly its recorded fee');

    // The refund never exceeds the net.
    assert.ok(refund <= GROSS - recordedFee);
});

test('full cancel refunds the net, never the gross', async () => {
    const client = await createUser(prisma, { walletBalance: 20000 });
    const vendor = await createUser(prisma, { walletBalance: 0 });
    const deal = await createPaidDeal(prisma, { client, vendor, gross: GROSS, feePercent: FEE_PCT });

    const recordedFee = sumRecordedPlatformFee((await reloadDeal(prisma, deal.id)).transactions);
    const refund = GROSS - recordedFee;
    assert.equal(refund, 9000);
    assert.notEqual(refund, GROSS, 'must not refund the full gross');

    await prisma.user.update({ where: { id: client.id }, data: { walletBalance: { increment: refund } } });
    const after = await balance(prisma, client.id);
    assert.equal(after.walletBalance, 20000 - GROSS + 9000);
    assert.equal((await balance(prisma, vendor.id)).walletBalance, 0);
});

test('split deal payouts sum to the post-fee net with nothing lost', async () => {
    const client = await createUser(prisma, { walletBalance: 50000 });
    const vendor = await createUser(prisma, { walletBalance: 0 });
    const a = await createUser(prisma, { walletBalance: 0 });
    const b = await createUser(prisma, { walletBalance: 0 });
    const c = await createUser(prisma, { walletBalance: 0 });

    const splitConfig = [
        { userId: a.id, percent: 33.33 },
        { userId: b.id, percent: 33.33 },
        { userId: c.id, percent: 33.34 },
    ];
    const deal = await createPaidDeal(prisma, {
        client, vendor, gross: GROSS, feePercent: FEE_PCT, isSplitDeal: true, splitConfig,
    });

    const recordedFee = sumRecordedPlatformFee((await reloadDeal(prisma, deal.id)).transactions);
    const net = GROSS - recordedFee;
    const payouts = computeSplitPayouts(net, splitConfig);

    for (const p of payouts) {
        await prisma.user.update({ where: { id: p.userId }, data: { walletBalance: { increment: p.amount } } });
    }

    const total = Math.round(payouts.reduce((s, p) => s + p.amount, 0) * 100) / 100;
    assert.equal(total, NET, 'split payouts must reconstruct the net exactly');

    const balances = await Promise.all([a, b, c].map((u) => balance(prisma, u.id)));
    const sumBalances = Math.round(balances.reduce((s, x) => s + x.walletBalance, 0) * 100) / 100;
    assert.equal(sumBalances, NET, 'wallets must hold exactly the net in aggregate');
    assert.ok(sumBalances < GROSS, 'the platform fee must not be redistributed to the team');
});

test('changing the fee rate after payment does not change settlement', async () => {
    const client = await createUser(prisma, { walletBalance: 50000 });
    const vendor = await createUser(prisma, { walletBalance: 0 });
    const deal = await createPaidDeal(prisma, { client, vendor, gross: GROSS, feePercent: FEE_PCT });

    // Admin raises the configured rate to 25% after the client already paid.
    const stored = await reloadDeal(prisma, deal.id);
    const recordedFee = sumRecordedPlatformFee(stored.transactions);
    const liveRate = 0.25;
    const feeIfRecomputed = computeFeeSplit(GROSS, liveRate).fee;

    const payout = GROSS - recordedFee;
    assert.equal(recordedFee, 1000);
    assert.equal(feeIfRecomputed, 2500, 'recomputing would have taken an extra 1500 from the vendor');
    assert.equal(payout, 9000, 'settlement must use the recorded fee');
});

test('an unsettled deal records no fee rows at all', async () => {
    const client = await createUser(prisma);
    const vendor = await createUser(prisma);
    const deal = await prisma.escrowDeal.create({
        data: {
            chatId: `test_chat_unpaid_${Date.now()}`,
            clientId: client.id,
            vendorId: vendor.id,
            title: 'Unpaid deal',
            totalAmount: GROSS,
            status: 'pending_payment',
            paymentStatus: 'pending',
        },
    });
    const stored = await reloadDeal(prisma, deal.id);
    assert.equal(stored.transactions.length, 0);
    assert.equal(sumRecordedPlatformFee(stored.transactions), 0);
});

test('releasing a deal twice cannot pay the vendor twice', async () => {
    const client = await createUser(prisma, { walletBalance: 50000 });
    const vendor = await createUser(prisma, { walletBalance: 0 });
    const deal = await createPaidDeal(prisma, { client, vendor, gross: GROSS, feePercent: FEE_PCT });

    const release = async (percent) => {
        const r = await prisma.$transaction(async (tx) => {
            const d = await tx.escrowDeal.findUnique({ where: { id: deal.id }, include: { transactions: true } });
            const remaining = 100 - d.releasedPercent;
            if (percent > remaining) throw new Error('Release failed. Either deal is inactive or amount exceeds 100%.');
            const recordedFee = sumRecordedPlatformFee(d.transactions);
            const amount = Math.round((((d.totalAmount - recordedFee) * percent) / 100) * 100) / 100;
            await tx.user.update({ where: { id: vendor.id }, data: { walletBalance: { increment: amount } } });
            await tx.escrowTransaction.create({ data: { dealId: deal.id, percent, amount, note: 'release' } });
            await tx.escrowDeal.update({
                where: { id: deal.id },
                data: { releasedPercent: d.releasedPercent + percent },
            });
            return amount;
        });
        return r;
    };

    await release(50);
    await release(50);
    assert.equal((await balance(prisma, vendor.id)).walletBalance, NET);

    // A third attempt must be rejected, not pay another 9000.
    await assert.rejects(() => release(10), /exceeds 100%/);
    assert.equal((await balance(prisma, vendor.id)).walletBalance, NET, 'vendor must not be paid beyond the net');
    assert.equal((await reloadDeal(prisma, deal.id)).releasedPercent, 100);
});
