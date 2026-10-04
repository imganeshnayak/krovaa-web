/**
 * One-off codemod: wrap money formatting in toAmount().
 *
 * Prisma.Decimal's toLocaleString('en-IN') renders "20081.92" instead of
 * "20,081.92", silently losing the thousands separator in every notification,
 * system message and error string. Wrapping the value in toAmount() restores
 * number formatting while staying a no-op for values that are already numbers.
 *
 *   node scripts/wrapMoneyFormatting.js [--dry]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');
const DRY = process.argv.includes('--dry');

/** Identifiers known to hold rupee amounts. */
const MONEY = [
    'payout.amount', 'amountToDeduct', 'user.walletBalance', 'grossAmount',
    'netAmount', 'deal.totalAmount', 'result.amount', 'releaseAmount',
    'refundAmount', 'refundableAmount', 'vendorNet', 'current.walletBalance',
    'deal.paidAmount', 'paidAmount', 'amount', 'balance', 'totalAmount',
    'walletBalance', 'newBalance', 'feeAmount', 'earned',
];

const files = [];
for (const dir of ['routes', 'services', 'socket']) {
    const full = path.join(backendRoot, dir);
    if (!fs.existsSync(full)) continue;
    for (const entry of fs.readdirSync(full)) {
        if (entry.endsWith('.js')) files.push(path.join(full, entry));
    }
}

let totalChanges = 0;
const touched = [];

for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const lines = src.split('\n');
    let changed = 0;

    const out = lines.map((line) => {
        if (/^\s*(\/\/|\*)/.test(line)) return line;
        if (!line.includes(".toLocaleString(")) return line;
        let next = line;
        for (const ident of MONEY) {
            // Only wrap when not already wrapped.
            const bare = new RegExp(`(?<!toAmount\\()\\b${ident.replace(/\./g, '\\.')}\\.toLocaleString\\(`, 'g');
            if (bare.test(next)) {
                next = next.replace(bare, `toAmount(${ident}).toLocaleString(`);
                changed += 1;
            }
        }
        return next;
    });

    if (changed > 0) {
        totalChanges += changed;
        touched.push(`${path.relative(backendRoot, file)} (${changed})`);
        if (!DRY) fs.writeFileSync(file, out.join('\n'));
    }
}

console.log(DRY ? '[DRY RUN] ' : '');
console.log(`Wrapped ${totalChanges} money formatting call(s) in ${touched.length} file(s):`);
touched.forEach((t) => console.log(`  ${t}`));
