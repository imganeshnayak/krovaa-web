/**
 * Back up the money tables to a restorable SQL file.
 *
 * pg_dump is not available in this environment, so this emits plain INSERT
 * statements using Prisma. Run it before any schema migration touching
 * walletBalance, EscrowDeal amounts or payout data.
 *
 *   node scripts/backupMoney.js [outputFile]
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TABLES = [
    { name: 'users', model: 'user' },
    { name: 'wallet_transactions', model: 'walletTransaction' },
    { name: 'escrow_deals', model: 'escrowDeal' },
    { name: 'escrow_transactions', model: 'escrowTransaction' },
    { name: 'payout_requests', model: 'payoutRequest' },
    { name: 'transactions', model: 'transaction' },
];

const outFile = process.argv[2]
    || path.resolve(process.cwd(), '..', 'backups', `money_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`);

function literal(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (value instanceof Date) return `'${value.toISOString()}'`;
    if (typeof value === 'object') return `'${String(value).replace(/'/g, "''")}'`;
    return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
    const counts = {};
    for (const t of TABLES) {
        try {
            counts[t.name] = await prisma[t.model].count();
        } catch {
            counts[t.name] = null; // table/model may not exist
        }
    }

    const lines = [
        '-- Money-table backup',
        `-- Generated: ${new Date().toISOString()}`,
        `-- Database: ${process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ':***@')}`,
        '',
    ];

    for (const t of TABLES) {
        if (counts[t.name] === null) {
            lines.push(`-- skipped ${t.name} (table not present)`);
            continue;
        }
        let rows = [];
        try {
            rows = await prisma[t.model].findMany();
        } catch (e) {
            lines.push(`-- skipped ${t.name}: ${e.message.split('\n')[0]}`);
            continue;
        }
        lines.push(`-- ${t.name}: ${rows.length} row(s)`);
        for (const row of rows) {
            const cols = Object.keys(row).filter((c) => c !== 'id');
            const vals = cols.map((c) => literal(row[c])).join(', ');
            lines.push(`INSERT INTO "${t.name}" (id, ${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${literal(row.id)}, ${vals});`);
        }
        lines.push('');
    }

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, lines.join('\n'));

    const bytes = fs.statSync(outFile).size;
    console.log(`Backed up ${Object.values(counts).filter((c) => c !== null).length} tables to:`);
    console.log(`  ${outFile} (${bytes} bytes)`);
    for (const [name, count] of Object.entries(counts)) {
        console.log(`  ${name}: ${count === null ? 'skipped' : `${count} rows`}`);
    }
    console.log('\nRestore with psql, e.g.:');
    console.log(`  psql "$DATABASE_URL" -f "${path.basename(outFile)}"`);
}

main()
    .catch((err) => {
        console.error('Backup failed:', err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
