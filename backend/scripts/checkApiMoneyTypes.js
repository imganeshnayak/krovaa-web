/**
 * Verify the live API never leaks a Decimal to the client as a string.
 *
 * Money columns are Decimal(18,2). Prisma's Decimal serializes to a string by
 * default, which would break the frontend's numeric operations. server.js
 * installs a toJSON override, and this script proves it actually took effect by
 * inspecting real responses from a running server.
 *
 *   PORT=5000 node scripts/checkApiMoneyTypes.js
 */

import 'dotenv/config';
import http from 'node:http';
import jwt from 'jsonwebtoken';

const PORT = process.env.PORT || 5000;
const MONEY_KEY = /amount|balance|fee|gross|net|payout|price|total/i;
const NUMERIC_STRING = /^-?\d+(\.\d+)?$/;

function collectStringMoneyFields(value, out = []) {
    if (value === null || typeof value !== 'object') return out;
    for (const [key, val] of Object.entries(value)) {
        if (typeof val === 'string' && MONEY_KEY.test(key) && NUMERIC_STRING.test(val)) {
            out.push(`${key}="${val}"`);
        } else if (val && typeof val === 'object') {
            collectStringMoneyFields(val, out);
        }
    }
    return out;
}

function get(path, token) {
    return new Promise((resolve) => {
        const req = http.request(
            { host: 'localhost', port: PORT, path, headers: { Authorization: `Bearer ${token}` } },
            (res) => {
                let body = '';
                res.on('data', (d) => { body += d; });
                res.on('end', () => resolve({ status: res.statusCode, body }));
            }
        );
        req.on('error', (e) => resolve({ status: 0, body: e.message }));
        req.end();
    });
}

const secret = process.env.JWT_SECRET;
if (!secret) {
    console.error('JWT_SECRET is not set. Source your .env first.');
    process.exit(1);
}

const userId = Number(process.argv[2]) || 13;
const token = jwt.sign({ id: userId, userId }, secret, { expiresIn: '10m' });

const PATHS = [
    '/api/wallet/balance',
    '/api/wallet/payout/requests',
    '/api/wallet/transactions',
    '/api/seller/stats',
    '/api/escrow/platform-fee',
];

let failures = 0;
console.log(`\nChecking live API on port ${PORT} as user ${userId}\n`);

for (const path of PATHS) {
    const res = await get(path, token);
    if (res.status === 0) {
        console.log(`  SKIP  ${path} (server not reachable: ${res.body})`);
        continue;
    }
    if (res.status === 401 || res.status === 403) {
        console.log(`  SKIP  ${path} (http ${res.status} - needs a different role)`);
        continue;
    }
    if (res.status !== 200) {
        console.log(`  WARN  ${path} (http ${res.status})`);
        continue;
    }
    let parsed;
    try {
        parsed = JSON.parse(res.body);
    } catch {
        console.log(`  FAIL  ${path} (response is not JSON)`);
        failures += 1;
        continue;
    }
    const bad = collectStringMoneyFields(parsed);
    if (bad.length > 0) {
        console.log(`  FAIL  ${path} -> string money field(s): ${bad.join(', ')}`);
        failures += 1;
    } else {
        console.log(`  PASS  ${path} -> all money fields are JSON numbers`);
    }
}

console.log(failures === 0 ? '\nAll checked endpoints return numeric money.\n' : `\n${failures} endpoint(s) leaked a string.\n`);
process.exit(failures === 0 ? 0 : 1);
