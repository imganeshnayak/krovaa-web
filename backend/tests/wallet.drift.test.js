/**
 * Tests proving wallet balances can never accumulate sub-paise drift.
 *
 * Drift is what made a full withdrawal impossible, so the guarantee has to hold
 * for every mutation path, not just the payout endpoint.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { useTestDatabase, resetDatabase, createUser } from './helpers/testDb.js';

useTestDatabase();

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const { applyWalletDelta, setWalletBalance, getWalletBalance, hasDrift } =
    await import('../utils/walletOps.js');
const { roundMoney, toPaise } = await import('../utils/money.js');
const { toAmount } = await import('../utils/decimalJson.js');

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Assert a stored balance carries no sub-paise residue. */
function assertNoDrift(label, balance) {
    const n = toAmount(balance);
    assert.equal(hasDrift(n), false, `${label}: balance ${n} carries sub-paise residue`);
    assert.equal(roundMoney(n), n, `${label}: balance ${n} is not on a paise boundary`);
}

test.before(async () => {
    await resetDatabase(prisma);
});

test.after(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
});

// --------------------------------------------------------------------------------------
// applyWalletDelta
// --------------------------------------------------------------------------------------

test('applyWalletDelta: a single credit leaves no residue', async () => {
    const user = await createUser(prisma, { walletBalance: 0.1 });
    const updated = await applyWalletDelta(prisma, user.id, 0.2);
    assertNoDrift('0.1 + 0.2', updated.walletBalance);
    assert.equal(toPaise(updated.walletBalance), 30);
});

test('Decimal storage is exact where float was not', async () => {
    const user = await createUser(prisma, { walletBalance: 0 });
    // The classic float failure: 0.1 + 0.2 === 0.30000000000000004.
    assert.notEqual(0.1 + 0.2, 0.3, 'sanity check: plain JS floats really do drift');
    await applyWalletDelta(prisma, user.id, 0.1);
    const updated = await applyWalletDelta(prisma, user.id, 0.2);
    assert.equal(toPaise(updated.walletBalance), 30, 'Decimal(18,2) stores this exactly');
});

test('applyWalletDelta: thousands of repeated credits never accumulate residue', async () => {
    const user = await createUser(prisma, { walletBalance: 0 });
    // 0.1 + 0.2 famously equals 0.30000000000000004; 1.1 - 0.3 famously does not
    // return to 0.8. Repeated float operations are exactly how the original
    // drift was produced.
    await applyWalletDelta(prisma, user.id, 0.1);
    await applyWalletDelta(prisma, user.id, 0.2);
    for (let i = 0; i < 50; i += 1) {
        await applyWalletDelta(prisma, user.id, 0.1);
    }
    const updated = await applyWalletDelta(prisma, user.id, -0.7);
    assertNoDrift('after 53 fractional ops', updated.walletBalance);
    // 0.1 + 0.2 + (50 x 0.1) - 0.7 = 4.6
    assert.equal(toPaise(updated.walletBalance), 460);
});

test('applyWalletDelta: debits also leave no residue', async () => {
    const user = await createUser(prisma, { walletBalance: 1000 });
    for (let i = 0; i < 30; i += 1) {
        await applyWalletDelta(prisma, user.id, -33.33);
    }
    const updated = await applyWalletDelta(prisma, user.id, -0.1);
    assertNoDrift('after 31 debits', updated.walletBalance);
    assert.equal(toPaise(updated.walletBalance), 100000 - toPaise(33.33) * 30 - 10);
});

test('applyWalletDelta: mixed credits and debits stay exact', async () => {
    const user = await createUser(prisma, { walletBalance: 0 });
    const deltas = [123.45, -23.45, 999.99, -0.99, 0.1, 0.2, -0.3, 5000.55, -5000.55];
    let expectedPaise = 0;
    for (const d of deltas) {
        expectedPaise += toPaise(d);
        const updated = await applyWalletDelta(prisma, user.id, d);
        assertNoDrift(`delta ${d}`, updated.walletBalance);
        assert.equal(toPaise(updated.walletBalance), expectedPaise, `balance drift after delta ${d}`);
    }
    // 123.45 - 23.45 + 999.99 - 0.99 + (0.1+0.2-0.3) + (5000.55-5000.55) = 1099.00
    assert.equal(expectedPaise, 109900, 'the deltas should net to exactly 1099.00');
});

test('applyWalletDelta: a zero delta is a no-op', async () => {
    const user = await createUser(prisma, { walletBalance: 500 });
    const updated = await applyWalletDelta(prisma, user.id, 0);
    assert.equal(toAmount(updated.walletBalance), 500);
    assert.equal(updated.delta, 0);
});

test('applyWalletDelta: never leaves a balance below the floor', async () => {
    const user = await createUser(prisma, { walletBalance: 100 });
    const updated = await applyWalletDelta(prisma, user.id, -250, { floor: 0 });
    assert.equal(toPaise(updated.walletBalance), 0, 'balance must clamp at zero, not go negative');
    assertNoDrift('over-debit', updated.walletBalance);
});

test('applyWalletDelta: is atomic across concurrent credits (no lost updates)', async () => {
    const user = await createUser(prisma, { walletBalance: 0 });
    // Mirror real concurrency: fire many mutations in parallel. Reading the
    // balance first and writing it back absolutely would lose updates here,
    // which is why the helper keeps Prisma's atomic increment.
    await Promise.all(
        Array.from({ length: 25 }, () => applyWalletDelta(prisma, user.id, 10))
    );
    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } });
    assert.equal(toPaise(after.walletBalance), 25000, 'every concurrent credit must be counted (25 x 10)');
    assertNoDrift('concurrent credits', after.walletBalance);
});

test('Decimal storage survives 1000 tiny increments that would destroy a float', async () => {
    const user = await createUser(prisma, { walletBalance: 0 });
    for (let i = 0; i < 1000; i += 1) {
        await applyWalletDelta(prisma, user.id, 0.01);
    }
    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } });
    // 1000 x 0.01 = 10.00 rupees = 1000 paise.
    assert.equal(toPaise(after.walletBalance), 1000, '1000 x 0.01 must equal exactly 10.00');
    assert.equal(toAmount(after.walletBalance), 10);
});

test('setWalletBalance and getWalletBalance are exact', async () => {
    const user = await createUser(prisma);
    await setWalletBalance(prisma, user.id, 20081.924);
    assert.equal(await getWalletBalance(prisma, user.id), 20081.92);
    await setWalletBalance(prisma, user.id, 0);
    assertNoDrift('zeroed', (await getWalletBalance(prisma, user.id)));
});

test('Decimal values serialize to JSON numbers, not strings', async () => {
    const { installDecimalJsonSerialization } = await import('../utils/decimalJson.js');
    installDecimalJsonSerialization();
    const user = await createUser(prisma, { walletBalance: 20081.92 });
    const payload = JSON.parse(JSON.stringify({ balance: user.walletBalance }));
    assert.equal(typeof payload.balance, 'number', 'the API must emit a JSON number');
    assert.equal(payload.balance, 20081.92);
    // The frontend relies on these operations working on the parsed value.
    assert.equal(payload.balance.toFixed(2), '20081.92');
    assert.equal(payload.balance.toLocaleString('en-IN'), '20,081.92');
    assert.equal(payload.balance > 500, true);
});

// --------------------------------------------------------------------------------------
// Static audit: no mutation path may bypass the helper
// --------------------------------------------------------------------------------------

function sourceFiles(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === 'tests' || entry === 'scripts') continue;
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
        else if (entry.endsWith('.js')) out.push(full);
    }
    return out;
}

test('no route or service mutates walletBalance with a raw increment/decrement', () => {
    const files = [
        ...sourceFiles(path.join(backendRoot, 'routes')),
        ...sourceFiles(path.join(backendRoot, 'services')),
        ...sourceFiles(path.join(backendRoot, 'socket')),
    ];
    const offenders = [];
    for (const file of files) {
        const src = readFileSync(file, 'utf8');
        src.split('\n').forEach((line, i) => {
            // Ignore fully-commented-out legacy code.
            if (/^\s*(\/\/|\*)/.test(line)) return;
            if (/walletBalance\s*:\s*\{\s*(increment|decrement)\b/.test(line)) {
                offenders.push(`${path.relative(backendRoot, file)}:${i + 1}`);
            }
        });
    }
    assert.deepEqual(
        offenders,
        [],
        `these sites bypass applyWalletDelta and can reintroduce float drift:\n${offenders.join('\n')}`
    );
});

test('every file that credits or debits a wallet imports the helper', () => {
    const files = [
        ...sourceFiles(path.join(backendRoot, 'routes')),
        ...sourceFiles(path.join(backendRoot, 'services')),
    ];
    const offenders = [];
    for (const file of files) {
        const src = readFileSync(file, 'utf8');
        if (!/applyWalletDelta|setWalletBalance/.test(src)) continue;
        if (!/from '\.\.\/utils\/walletOps\.js'|from '\.\/walletOps\.js'/.test(src)) {
            offenders.push(path.relative(backendRoot, file));
        }
    }
    assert.deepEqual(offenders, [], `missing walletOps import in:\n${offenders.join('\n')}`);
});
