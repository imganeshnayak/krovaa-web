/**
 * Detect and repair sub-paise float residue in wallet balances.
 *
 * Wallet balances are stored as Postgres Float, so repeated increment/decrement
 * operations leave values like 20081.924 instead of 20081.92. That residue is
 * unwithdrawable: the UI renders the 2dp value, so the difference is invisible
 * to the user but real in the database.
 *
 * The code no longer *creates* residue (see utils/money.js), but existing rows
 * keep it until cleaned up.
 *
 * Dry run is the default:
 *   node scripts/fixWalletDrift.js
 *   node scripts/fixWalletDrift.js --write
 *   node scripts/fixWalletDrift.js --write --confirm
 *
 * Options:
 *   --threshold <n>  Ignore differences at or below this many paise (default 0).
 *   --confirm        Skip the interactive prompt (still requires --write).
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { roundMoney } from '../utils/money.js';

const prisma = new PrismaClient();

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
};

const WRITE = has('--write');
const SKIP_CONFIRM = has('--confirm');
const THRESHOLD = Number(valueOf('--threshold') ?? 0);

if (!Number.isFinite(THRESHOLD) || THRESHOLD < 0) {
    console.error('Invalid --threshold. Use a non-negative number of paise.');
    process.exit(1);
}

async function main() {
    console.log(`\nWallet drift check ${WRITE ? '(WRITE MODE)' : '(DRY RUN — no changes will be made)'}`);
    console.log(`Threshold: ${THRESHOLD} paise\n`);

    const users = await prisma.user.findMany({
        select: { id: true, username: true, displayName: true, walletBalance: true },
        orderBy: { id: 'asc' },
    });

    const drifted = users
        .map((u) => ({ ...u, corrected: roundMoney(u.walletBalance) }))
        .filter((u) => Math.abs(u.walletBalance - u.corrected) * 100 > THRESHOLD);

    console.log(`Users checked: ${users.length}`);
    console.log(`Balances with sub-paise residue: ${drifted.length}`);

    if (drifted.length === 0) {
        console.log('\nNothing to repair.\n');
        return;
    }

    let netDelta = 0;
    console.log(`\n${'-'.repeat(72)}`);
    console.log('  ID   STORED              CORRECTED          DELTA  USER');
    console.log(`${'-'.repeat(72)}`);
    for (const u of drifted) {
        const delta = u.corrected - u.walletBalance;
        netDelta += delta;
        console.log(
            `  ${String(u.id).padEnd(4)} ${u.walletBalance.toFixed(4).padStart(18)} ` +
            `${u.corrected.toFixed(2).padStart(17)} ${delta.toFixed(4).padStart(9)}  ` +
            `${(u.displayName || u.username || '').slice(0, 20)}`
        );
    }
    console.log(`${'-'.repeat(72)}`);
    console.log(`  Net adjustment across all users: ₹${netDelta.toFixed(4)}\n`);

    if (!WRITE) {
        console.log('This was a DRY RUN. Re-run with --write to apply.');
        return;
    }

    if (!SKIP_CONFIRM) {
        const readline = await import('node:readline/promises');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await rl.question(`Type the number of users (${drifted.length}) to confirm, or anything else to abort: `);
        rl.close();
        if (answer.trim() !== String(drifted.length)) {
            console.log('Aborted. No changes made.');
            return;
        }
    }

    let fixed = 0;
    for (const u of drifted) {
        await prisma.user.update({ where: { id: u.id }, data: { walletBalance: u.corrected } });
        fixed += 1;
    }

    console.log(`\nCorrected ${fixed} wallet balance(s).`);
    console.log('Note: this adjusts stored balances to the nearest paise. It does not');
    console.log('create or destroy wallet transactions, so ledger totals are unchanged.\n');
}

main()
    .catch((err) => {
        console.error('Drift repair failed:', err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
