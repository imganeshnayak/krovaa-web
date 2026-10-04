/**
 * Mutation check: does the webhook guard actually catch a forgeable endpoint?
 *
 * A guard that passes against the vulnerable code is worthless. This restores
 * the original "if (webhookSecret && signature)" shape - which skipped
 * verification entirely when the signature was absent - so the security tests
 * can be shown to fail against it.
 *
 *   node tests/helpers/mutateWebhook.js apply
 *   node tests/helpers/mutateWebhook.js restore
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, '..', '..', 'routes', 'webhooks.js');
const backup = path.join(here, 'webhooks.fixed.bak');
const mode = process.argv[2];

if (mode === 'restore') {
    if (!fs.existsSync(backup)) { console.error('No backup found.'); process.exit(1); }
    fs.copyFileSync(backup, target);
    console.log('Restored the fixed webhooks.js');
    process.exit(0);
}
if (mode !== 'apply') {
    console.error('Usage: node tests/helpers/mutateWebhook.js apply|restore');
    process.exit(1);
}

const src = fs.readFileSync(target, 'utf8');
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);

const start = src.indexOf('router.post(\'/delivery-updates\'');
if (start < 0) { console.error('delivery-updates route not found'); process.exit(1); }
const next = src.indexOf('\nrouter.', start + 1);
let handler = src.slice(start, next > 0 ? next : src.length);

const VULNERABLE = `router.post('/delivery-updates', async (req, res) => {
    try {
        // VULNERABLE (mutation): verification skipped when no signature arrives.
        if (false) { /* original: if (webhookSecret && signature) */ }
`;

const marker = handler.indexOf('router.post(\'/delivery-updates\'');
const afterTry = handler.indexOf('try {', marker);
const insertAt = afterTry + 'try {'.length;

const patched = handler.slice(0, insertAt)
    + "\n        if (!req.get('x-shiprocket-signature')) { /* no verification - vulnerable */ }"
    + handler.slice(insertAt);

// Neutralise the real check by making verification always succeed.
const neutralised = patched.replace(
    /if \(!verification\.ok\) \{[\s\S]*?\n        \}/,
    'if (false) { return res.status(401).json({ error: verification.reason }); }'
);

if (neutralised === handler) {
    console.error('Mutation did not apply - expected code not found.');
    process.exit(1);
}

fs.writeFileSync(target, src.slice(0, start) + neutralised + src.slice(next > 0 ? next : src.length));
console.log('Vulnerability reintroduced: delivery webhook accepts unsigned/forged payloads.');
console.log('Run the security tests now - they MUST fail. Then: node tests/helpers/mutateWebhook.js restore');
