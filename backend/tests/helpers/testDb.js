/**
 * Test harness for escrow money-path integration tests.
 *
 * SAFETY: this module refuses to run unless DATABASE_URL points at a database
 * whose name ends in `_test`. That guard exists because these tests create,
 * mutate and (in the rollback case) discard wallet balances and deals. If the
 * guard ever trips, the tests abort before touching anything.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeFeeSplit } from '../../utils/fees.js';
import { toAmount } from '../../utils/decimalJson.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..', '..');

/** Point process.env at the throwaway test database, or bail out loudly. */
export function useTestDatabase() {
    const envFile = path.join(backendRoot, '.env.test');
    if (!fs.existsSync(envFile)) {
        throw new Error(
            `Missing ${envFile}. Create it from .env with the database name changed to krovaa_test, ` +
            'then run: set -a && . ./.env.test && npx prisma db push'
        );
    }

    const line = fs.readFileSync(envFile, 'utf8').match(/^DATABASE_URL=(.*)$/m);
    if (!line) throw new Error('DATABASE_URL missing from .env.test');

    const url = new URL(line[1].trim());
    if (!url.pathname.slice(1).endsWith('_test')) {
        throw new Error(
            `REFUSING TO RUN: .env.test points at "${url.pathname.slice(1)}", which does not end in _test. ` +
            'These tests mutate financial rows.'
        );
    }
    process.env.DATABASE_URL = url.href;
    return url.pathname.slice(1);
}

/** Truncate every table so each test file starts from a known-empty state. */
export async function resetDatabase(prisma) {
    const tables = await prisma.$queryRawUnsafe(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
    );
    if (tables.length === 0) return;
    const list = tables.map((t) => `"${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

let userCounter = 0;

export async function createUser(prisma, overrides = {}) {
    userCounter += 1;
    const id = `${process.pid}_${userCounter}`;
    const { walletBalance = 0, ...rest } = overrides;
    return prisma.user.create({
        data: {
            username: `test_${id}`,
            // User.email and User.password are required by the schema.
            email: `test_${id}@example.test`,
            password: 'not-a-real-hash',
            displayName: `Test User ${userCounter}`,
            // walletBalance is Decimal(18,2); pass a string to stay exact.
            walletBalance: String(toAmount(walletBalance)),
            ...rest,
        },
    });
}

export async function setPlatformFeePercent(prisma, percent) {
    await prisma.systemSetting.upsert({
        where: { key: 'platform_fee_percent' },
        update: { value: String(percent) },
        create: { key: 'platform_fee_percent', value: String(percent) },
    });
}

/**
 * Create a paid escrow deal the same way the create endpoint does:
 * client wallet debited by the gross, a platform_fee transaction recorded, and
 * a release transaction whenever `releasedPercent` is supplied.
 */
export async function createPaidDeal(prisma, { client, vendor, gross, feePercent, releasedPercent = 0, isSplitDeal = false, splitConfig = null }) {
    const { fee, net } = computeFeeSplit(gross, feePercent);

    // Mirror the real endpoint: the client is charged the full gross up front.
    await prisma.user.update({
        where: { id: client.id },
        data: { walletBalance: { decrement: gross } },
    });

    const deal = await prisma.escrowDeal.create({
        data: {
            chatId: `test_chat_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
            clientId: client.id,
            vendorId: vendor.id,
            title: `Test Deal ${gross}`,
            totalAmount: gross,
            status: 'active',
            paymentStatus: 'paid',
            paidAmount: gross,
            isSplitDeal,
            splitConfig,
        },
    });

    if (fee > 0) {
        await prisma.escrowTransaction.create({
            data: { dealId: deal.id, percent: 0, amount: fee, note: 'platform_fee' },
        });
    }

    if (releasedPercent > 0) {
        const amount = Math.round(((net * releasedPercent) / 100) * 100) / 100;
        // Credit the vendor too, so the wallet and the ledger stay consistent
        // for tests that assert on money conservation.
        await prisma.user.update({
            where: { id: vendor.id },
            data: { walletBalance: { increment: amount } },
        });
        await prisma.escrowTransaction.create({
            data: { dealId: deal.id, percent: releasedPercent, amount, note: 'seeded release' },
        });
        await prisma.escrowDeal.update({
            where: { id: deal.id },
            data: { releasedPercent },
        });
    }

    return deal;
}

/** Read a deal back with its transactions. */
export async function reloadDeal(prisma, dealId) {
    return prisma.escrowDeal.findUnique({
        where: { id: dealId },
        include: { transactions: true },
    });
}

/** A user's wallet balance as a plain number (the column is Decimal). */
export async function balance(prisma, userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
    return { walletBalance: toAmount(user.walletBalance) };
}
