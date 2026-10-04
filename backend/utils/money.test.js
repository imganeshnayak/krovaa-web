/**
 * Tests for wallet money handling.
 *
 * The headline case is a real reported bug: a user whose balance held sub-paise
 * float residue (e.g. 20081.924) could not withdraw their entire balance,
 * because the UI showed 20081.92 and the naive `balance < amount` check
 * rejected it as insufficient funds.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    roundMoney,
    toPaise,
    hasSufficientBalance,
    isSameAmount,
    clampToBalance,
    balanceAfterDebit,
    parseMoneyInput,
} from './money.js';

// --------------------------------------------------------------------------------------
// Rounding
// --------------------------------------------------------------------------------------

test('roundMoney: collapses sub-paise residue', () => {
    assert.equal(roundMoney(20081.924), 20081.92);
    assert.equal(roundMoney(58655.32000000001), 58655.32);
    assert.equal(roundMoney(0.1 + 0.2), 0.3);
    assert.equal(roundMoney(1000 * 0.1), 100);
    assert.equal(roundMoney(19.999), 20);
    assert.equal(roundMoney(-5.005), -5.01);
    assert.equal(roundMoney(NaN), 0);
    assert.equal(roundMoney(undefined), 0);
    assert.equal(roundMoney(Infinity), 0);
});

test('toPaise: converts to exact integer cents', () => {
    assert.equal(toPaise(20081.92), 2008192);
    assert.equal(toPaise(20081.924), 2008192, 'residue rounds to the same paise');
    assert.equal(toPaise(-10.5), -1050);
    assert.equal(toPaise('900'), 90000);
    assert.equal(toPaise(NaN), 0);
});

test('roundMoney output is always stable under re-rounding', () => {
    for (const v of [0.005, 0.015, 1.005, 20081.924, 58655.32000000001, 1e7 + 0.004]) {
        assert.equal(roundMoney(roundMoney(v)), roundMoney(v), `unstable rounding at ${v}`);
    }
});

// --------------------------------------------------------------------------------------
// The reported bug
// --------------------------------------------------------------------------------------

test('DOWNWARD residue no longer blocks a full withdrawal (the reported bug)', () => {
    // A balance that drifted below its true 2dp value, e.g. 899.9999999999
    // after repeated float decrements. The UI renders 900.00, the user types
    // 900, and the naive check 899.9999999999 < 900 is TRUE, so the payout is
    // rejected as "Insufficient wallet balance" despite the user having enough.
    const balance = 899.9999999999;
    const userTyped = 900;

    assert.equal(balance < userTyped, true, 'the old check rejected a full withdrawal');
    assert.equal(hasSufficientBalance(balance, userTyped), true, 'must now be allowed');
    assert.equal(balanceAfterDebit(balance, userTyped), 0, 'balance must land exactly on zero');
});

test('UPWARD residue no longer strands dust the user can never withdraw', () => {
    // The live value found in the dev database: 20081.924, i.e. ₹0.004 above
    // the displayed 20081.92. The naive check lets 20081.92 through, which
    // leaves 0.004 permanently stuck — below the ₹500 minimum, so it could
    // never be paid out again.
    const balance = 20081.924;
    const displayed = roundMoney(balance);

    assert.equal(balanceAfterDebit(balance, displayed), 0, 'no residue may be stranded');
    assert.ok(displayed < balance, 'this value does drift upward');
});

test('withdrawing the full balance always leaves exactly zero', () => {
    const cases = [20081.924, 58655.32000000001, 1000.0000000001, 899.9999999999, 500, 0.1 + 0.2, 12345.678];
    for (const balance of cases) {
        const amount = roundMoney(balance);
        assert.equal(hasSufficientBalance(balance, amount), true, `full withdrawal blocked at ${balance}`);
        assert.equal(balanceAfterDebit(balance, amount), 0, `residue left behind at ${balance}`);
    }
});

test('a genuinely insufficient balance is still rejected', () => {
    assert.equal(hasSufficientBalance(1000, 1000.01), false);
    assert.equal(hasSufficientBalance(499.99, 500), false);
    assert.equal(hasSufficientBalance(0, 500), false);
    assert.equal(hasSufficientBalance(-10, 500), false);
    // ...but one paisa of residue must not flip the decision.
    assert.equal(hasSufficientBalance(1000.001, 1000), true);
});

test('isSameAmount ignores sub-paise residue', () => {
    assert.equal(isSameAmount(20081.924, 20081.92), true);
    assert.equal(isSameAmount(20081.92, 20081.92), true);
    assert.equal(isSameAmount(20081.93, 20081.92), false);
});

test('balanceAfterDebit: never goes negative and returns rupees, not paise', () => {
    assert.equal(balanceAfterDebit(100, 500), 0);
    assert.equal(balanceAfterDebit(0, 500), 0);
    assert.equal(balanceAfterDebit(1000, 400.5), 599.5);
    assert.equal(balanceAfterDebit(1000.004, 1000), 0);
    // Guards the paise/rupee mix-up that would have made payouts 100x too large.
    assert.ok(balanceAfterDebit(1000, 400.5) < 1000, 'result must be rupees');
});

// --------------------------------------------------------------------------------------
// clampToBalance
// --------------------------------------------------------------------------------------

test('clampToBalance: withdraw-all never exceeds the real balance', () => {
    assert.equal(clampToBalance(99999, 20081.924), 20081.92);
    assert.equal(clampToBalance(500, 20081.924), 500);
    assert.equal(clampToBalance(500, 0), 0);
    assert.equal(clampToBalance(500, -20), 0);
});

// --------------------------------------------------------------------------------------
// parseMoneyInput
// --------------------------------------------------------------------------------------

test('parseMoneyInput: accepts valid amounts as numbers and strings', () => {
    assert.deepEqual(parseMoneyInput(1000), { ok: true, amount: 1000 });
    assert.deepEqual(parseMoneyInput('1000'), { ok: true, amount: 1000 });
    assert.deepEqual(parseMoneyInput('1000.555'), { ok: true, amount: 1000.56 });
    assert.deepEqual(parseMoneyInput(1000, { min: 500 }), { ok: true, amount: 1000 });
    assert.deepEqual(parseMoneyInput(500, { min: 500 }), { ok: true, amount: 500 });
});

test('parseMoneyInput: rejects the values the old code let through', () => {
    // The original `if (!amount || amount < 500)` let non-numeric strings past
    // validation, because "abc" < 500 is false.
    for (const bad of ['abc', 'NaN', null, undefined, '', {}, [], true]) {
        assert.equal(parseMoneyInput(bad).ok, false, `accepted garbage: ${JSON.stringify(bad)}`);
    }
    assert.equal(parseMoneyInput(0).ok, false);
    assert.equal(parseMoneyInput(-100).ok, false);
    assert.equal(parseMoneyInput(499.99, { min: 500 }).ok, false);
});

test('parseMoneyInput: reports a helpful error for amounts under the minimum', () => {
    const r = parseMoneyInput(100, { min: 500 });
    assert.equal(r.ok, false);
    assert.match(r.error, /Minimum payout amount is ₹500/);
});

test('parseMoneyInput: enforces the balance ceiling when a max is supplied', () => {
    // A balance whose residue rounds up to 900 is treated as 900 — that is the
    // entire point of the fix, so a full withdrawal is never blocked.
    assert.equal(parseMoneyInput(900, { max: 899.9999999999 }).ok, true);
    assert.equal(parseMoneyInput(900.01, { max: 900 }).ok, false);
    assert.equal(parseMoneyInput(20081.92, { max: 20081.924 }).ok, true, 'full balance must pass');
});

test('parseMoneyInput: rounds to paise so the ledger stays exact', () => {
    assert.equal(parseMoneyInput(100.005).amount, 100.01);
    assert.equal(parseMoneyInput(100.004).amount, 100);
    assert.equal(toPaise(parseMoneyInput(20081.924).amount), 2008192);
});

test('parseMoneyInput: accepts Decimal values, since money columns are Decimal', async () => {
    const { Prisma } = await import('@prisma/client');
    const d = new Prisma.Decimal(20081.92);
    const r = parseMoneyInput(d);
    assert.equal(r.ok, true, 'a Decimal must be accepted as a valid amount');
    assert.equal(r.amount, 20081.92);
    assert.equal(parseMoneyInput(new Prisma.Decimal('500')).ok, true);
    // ...while still rejecting plain objects and booleans.
    assert.equal(parseMoneyInput({}).ok, false);
    assert.equal(parseMoneyInput(true).ok, false);
    assert.equal(parseMoneyInput([]).ok, false);
});
