/**
 * Mutation check: does the regression guard actually catch the cancel bug?
 *
 * A guard that passes against buggy code is worthless. This reintroduces the
 * original defect - POST /:id/cancel refunding the full paidAmount, ignoring the
 * platform fee and releasedPercent - so the guard can be shown to fail.
 *
 *   node tests/helpers/mutateCancel.js apply     # reintroduce the bug
 *   node tests/helpers/mutateCancel.js restore   # put the fix back
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, '..', '..', 'routes', 'escrow.js');
const backup = path.join(here, 'escrow.fixed.bak');

const mode = process.argv[2];

function handlerBounds(src) {
    const start = src.indexOf("router.post('/:id/cancel'");
    if (start < 0) throw new Error('cancel route not found');
    const next = src.indexOf('\nrouter.', start + 1);
    return { start, end: next > 0 ? next : src.length };
}

if (mode === 'restore') {
    if (!fs.existsSync(backup)) {
        console.error('No backup found - nothing to restore.');
        process.exit(1);
    }
    fs.copyFileSync(backup, target);
    console.log('Restored the fixed escrow.js');
    process.exit(0);
}

if (mode !== 'apply') {
    console.error('Usage: node tests/helpers/mutateCancel.js apply|restore');
    process.exit(1);
}

const src = fs.readFileSync(target, 'utf8');
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);

const { start, end } = handlerBounds(src);
let handler = src.slice(start, end);

const before = handler;
handler = handler.replace(
    /const refundAmount = isPaid\s*\?\s*computeCancelRefund\(\{[\s\S]*?\}\)\s*\:\s*0;/,
    'const refundAmount = deal.paidAmount;'
);
handler = handler.replace(
    'if (isPaid && refundAmount > 0) {\n                const user = await applyWalletDelta(tx, deal.clientId, refundAmount);',
    'if (isPaid) {\n                const user = await applyWalletDelta(tx, deal.clientId, deal.paidAmount);'
);
handler = handler.replace(/amount: refundAmount,/g, 'amount: deal.paidAmount,');

if (handler === before) {
    console.error('Mutation did not apply - the expected code was not found.');
    console.error('The guard cannot be validated this way; inspect routes/escrow.js manually.');
    process.exit(1);
}

fs.writeFileSync(target, src.slice(0, start) + handler + src.slice(end));
console.log('Bug reintroduced: POST /:id/cancel now refunds the full paidAmount.');
console.log('Run the guard now - it MUST fail. Then run: node tests/helpers/mutateCancel.js restore');
