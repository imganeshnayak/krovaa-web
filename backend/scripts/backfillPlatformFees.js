/**
 * Backfill platform_fee transactions for legacy deals.
 *
 * Deals created before fee recording existed (or created via a path that forgot
 * to record one) have no `platform_fee` escrow transaction. The release and
 * refund paths fall back to computing the fee from the *current* configured
 * rate, which means those deals are not settled on the rate that was actually
 * in force when the client paid.
 *
 * This script records the missing fee so every paid deal has an authoritative,
 * immutable record of what the platform charged.
 *
 * IMPORTANT: dry-run is the default. Nothing is written unless you pass
 * --write, and --write additionally requires --confirm to type the deal count.
 *
 *   node scripts/backfillPlatformFees.js                 # dry run, prints a report
 *   node scripts/backfillPlatformFees.js --write         # writes (asks to confirm)
 *   node scripts/backfillPlatformFees.js --write --confirm  # skip the prompt
 *
 * Options:
 *   --rate <n>   Override the platform fee percent (default: the current
 *                platform_fee_percent setting).
 *   --include-settled
 *                Also backfill deals that are already completed/cancelled.
 *                Off by default, because rewriting history on settled deals is
 *                a judgement call and this script will not make it for you.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
    getPlatformFeePercent,
    computeFeeSplit,
    sumRecordedPlatformFee,
    PLATFORM_FEE_NOTE,
} from '../utils/fees.js';

const prisma = new PrismaClient();

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
};

const WRITE = has('--write');
const SKIP_CONFIRM = has('--confirm');
const INCLUDE_SETTLED = has('--include-settled');
const RATE_OVERRIDE = valueOf('--rate');

const SETTLED_STATUSES = ['completed', 'cancelled', 'refunded'];

async function main() {
    const liveRate = RATE_OVERRIDE !== undefined
        ? Number(RATE_OVERRIDE)
        : await getPlatformFeePercent(prisma);

    if (!Number.isFinite(liveRate) || liveRate < 0 || liveRate > 1) {
        console.error(`Invalid fee rate: ${RATE_OVERRIDE}. Use a fraction like 0.10, or omit --rate.`);
        process.exit(1);
    }

    console.log(`\nPlatform fee backfill ${WRITE ? '(WRITE MODE)' : '(DRY RUN — no changes will be made)'}`);
    console.log(`Fee rate: ${(liveRate * 100).toFixed(2)}%${RATE_OVERRIDE !== undefined ? ' (overridden via --rate)' : ' (from system settings)'}`);
    if (!INCLUDE_SETTLED) console.log(`Settled deals (${SETTLED_STATUSES.join(', ')}) will be SKIPPED — pass --include-settled to include them.`);

    const candidates = await prisma.escrowDeal.findMany({
        where: INCLUDE_SETTLED
            ? { paymentStatus: 'paid' }
            : { paymentStatus: 'paid', status: { notIn: SETTLED_STATUSES } },
        include: { transactions: true },
        orderBy: { id: 'asc' },
    });

    const missing = candidates.filter((deal) => sumRecordedPlatformFee(deal.transactions) <= 0);

    // Also flag deals that DO have a fee but where it disagrees with the current
    // rate. Those are not rewritten — the recorded fee is authoritative — but the
    // platform should know they exist.
    const drifted = candidates.filter((deal) => {
        const recorded = sumRecordedPlatformFee(deal.transactions);
        if (recorded <= 0) return false;
        const expected = computeFeeSplit(deal.totalAmount, liveRate).fee;
        return Math.abs(expected - recorded) > 0.01;
    });

    console.log(`\nPaid deals examined:        ${candidates.length}`);
    console.log(`Missing a platform fee:     ${missing.length}`);
    console.log(`Fee differs from live rate: ${drifted.length}  (informational only, not modified)`);

    if (missing.length === 0) {
        console.log('\nNothing to backfill.\n');
        return;
    }

    const rows = missing.map((deal) => {
        const { fee } = computeFeeSplit(deal.totalAmount, liveRate);
        return {
            id: deal.id,
            title: deal.title,
            status: deal.status,
            gross: deal.totalAmount,
            fee,
            paidAt: deal.paidAmount,
        };
    });

    const totalFee = rows.reduce((s, r) => s + r.fee, 0);
    const totalGross = rows.reduce((s, r) => s + r.gross, 0);

    console.log(`\n${'-'.repeat(78)}`);
    console.log('  ID   STATUS        GROSS        FEE  TITLE');
    console.log(`${'-'.repeat(78)}`);
    for (const r of rows) {
        console.log(
            `  ${String(r.id).padEnd(4)} ${String(r.status).padEnd(13)} ` +
            `${r.gross.toFixed(2).padStart(10)} ${r.fee.toFixed(2).padStart(10)}  ${r.title.slice(0, 28)}`
        );
    }
    console.log(`${'-'.repeat(78)}`);
    console.log(`  ${rows.length} deal(s), gross ₹${totalGross.toFixed(2)}, fees to record ₹${totalFee.toFixed(2)}\n`);

    if (!WRITE) {
        console.log('This was a DRY RUN. Re-run with --write to apply.');
        return;
    }

    if (!SKIP_CONFIRM) {
        const readline = await import('node:readline/promises');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await rl.question(`Type the number of deals (${rows.length}) to confirm, or anything else to abort: `);
        rl.close();
        if (answer.trim() !== String(rows.length)) {
            console.log('Aborted. No changes made.');
            return;
        }
    }

    let written = 0;
    for (const row of rows) {
        const { fee } = computeFeeSplit(row.gross, liveRate);
        if (fee <= 0) continue;
        // Idempotent: skip if a fee row appeared in the meantime.
        const existing = await prisma.escrowTransaction.aggregate({
            where: { dealId: row.id, note: PLATFORM_FEE_NOTE },
            _sum: { amount: true },
        });
        if (existing._sum.amount > 0) continue;

        await prisma.escrowTransaction.create({
            data: { dealId: row.id, percent: 0, amount: fee, note: PLATFORM_FEE_NOTE },
        });
        written += 1;
    }

    console.log(`\nWrote ${written} platform_fee transaction(s).`);
    console.log('Note: the recorded fee is now authoritative for these deals, so a later');
    console.log('change to platform_fee_percent will no longer alter how they settle.\n');
}

main()
    .catch((err) => {
        console.error('Backfill failed:', err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
