/**
 * Integration tests for wallet payouts, against the throwaway krovaa_test DB.
 *
 * These exercise the real arithmetic the payout endpoint uses, proving a user
 * can always withdraw their complete balance even when the stored Float has
 * drifted, and that no money is created or destroyed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, createUser } from './helpers/testDb.js';

useTestDatabase();

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const { roundMoney, hasSufficientBalance, balanceAfterDebit, parseMoneyInput, toPaise } =
    await import('../utils/money.js');
const { toAmount } = await import('../utils/decimalJson.js');

const MIN_PAYOUT = 500;

/** Mirror the validation and debit the payout endpoint performs. */
function evaluatePayoutRequest(balance, rawAmount) {
    const parsed = parseMoneyInput(rawAmount, { min: 0, max: null });
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const amount = parsed.amount;
    if (!hasSufficientBalance(balance, amount)) return { ok: false, error: 'Insufficient wallet balance' };
    const isFullBalance = toPaise(balance) === toPaise(amount);
    if (toPaise(amount) < toPaise(MIN_PAYOUT) && !isFullBalance) {
        return { ok: false, error: `Minimum payout amount is ₹${MIN_PAYOUT}.` };
    }
    return { ok: true, amount, newBalance: balanceAfterDebit(balance, amount) };
}

test.before(async () => {
    await resetDatabase(prisma);
});

test.after(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
});

test('withdrawing the entire balance works even with sub-paise residue', async () => {
    // Both drift directions, seeded directly so the float is genuinely stored.
    const driftedDown = 899.9999999999;
    const driftedUp = 20081.924;

    for (const balance of [driftedDown, driftedUp]) {
        const user = await createUser(prisma);
        await prisma.user.update({
            where: { id: user.id },
            data: { walletBalance: balance },
        });

        const stored = await prisma.user.findUnique({
            where: { id: user.id },
            select: { walletBalance: true },
        });

        const result = evaluatePayoutRequest(stored.walletBalance, roundMoney(stored.walletBalance));
        assert.equal(result.ok, true, `full withdrawal rejected for ${toAmount(stored.walletBalance)}: ${result.error}`);

        const updated = await prisma.user.update({
            where: { id: user.id },
            data: { walletBalance: String(result.newBalance) },
        });
        assert.equal(toAmount(updated.walletBalance), 0, `residue left behind from ${toAmount(stored.walletBalance)}`);
    }
});

test('a partial payout leaves the remainder intact', async () => {
    const user = await createUser(prisma);
    await prisma.user.update({ where: { id: user.id }, data: { walletBalance: 58655.32000000001 } });

    const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } });
    const result = evaluatePayoutRequest(stored.walletBalance, 10000);
    assert.equal(result.ok, true);
    assert.equal(result.amount, 10000);
    assert.equal(result.newBalance, 48655.32);
});

test('a payout larger than the balance is rejected', async () => {
    const user = await createUser(prisma);
    await prisma.user.update({ where: { id: user.id }, data: { walletBalance: 499.9999999999 } });

    const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } });
    const result = evaluatePayoutRequest(stored.walletBalance, 1000);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Insufficient wallet balance');
});

test('the ₹500 minimum still applies to partial withdrawals', async () => {
    const user = await createUser(prisma);
    await prisma.user.update({ where: { id: user.id }, data: { walletBalance: 1000 } });

    const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } });
    const tooSmall = evaluatePayoutRequest(stored.walletBalance, 100);
    assert.equal(tooSmall.ok, false);
    assert.match(tooSmall.error, /Minimum payout amount/);

    const exactlyMin = evaluatePayoutRequest(stored.walletBalance, 500);
    assert.equal(exactlyMin.ok, true);
});

test('a sub-₹500 balance can still be cleared completely (no money gets stuck)', async () => {
    const user = await createUser(prisma);
    await prisma.user.update({ where: { id: user.id }, data: { walletBalance: 300.005 } });

    const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } });
    const result = evaluatePayoutRequest(stored.walletBalance, roundMoney(stored.walletBalance));
    assert.equal(result.ok, true, 'a user must always be able to empty their wallet');
    assert.equal(result.newBalance, 0);
});

test('repeated partial payouts never leak or duplicate money', async () => {
    // Use amounts at or above the ₹500 minimum so this exercises arithmetic,
    // not the minimum-amount rule (covered separately above).
    let balance = 3000;
    for (let i = 0; i < 5; i += 1) {
        const result = evaluatePayoutRequest(balance, 500);
        assert.equal(result.ok, true, `payout ${i + 1} rejected: ${result.error}`);
        balance = result.newBalance;
    }
    assert.equal(balance, 500, '3000 - 500*5 must equal exactly 500');
    assert.equal(roundMoney(balance), balance, 'no residue accumulated over many operations');
});

test('a cancelled payout refunds the exact amount', async () => {
    const user = await createUser(prisma, { walletBalance: 5000 });

    const before = await prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } });
    const beforeBalance = toAmount(before.walletBalance);
    const payout = await prisma.payoutRequest.create({
        data: {
            userId: user.id,
            amount: 2000,
            paymentMethod: 'bank',
            bankAccount: '1234567890',
            ifscCode: 'TEST0000001',
            accountName: 'Test User',
            status: 'pending',
        },
    });
    // The endpoint debits up front.
    const debited = roundMoney(beforeBalance - toAmount(payout.amount));
    await prisma.user.update({ where: { id: user.id }, data: { walletBalance: String(debited) } });
    assert.equal(debited, 3000);

    // Admin cancels -> refund, mirroring routes/admin.js.
    const current = await prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } });
    const refunded = roundMoney(toAmount(current.walletBalance) + toAmount(payout.amount));
    await prisma.user.update({ where: { id: user.id }, data: { walletBalance: String(refunded) } });

    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } });
    assert.equal(toAmount(after.walletBalance), 5000, 'a cancelled payout must restore the exact starting balance');
});
