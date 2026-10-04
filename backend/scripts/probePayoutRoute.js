/**
 * Safe, non-destructive probe of the real payout route over HTTP.
 *
 * Every case below is rejected during validation, BEFORE any wallet is
 * debited, so no money moves and no payout row is created. This proves the
 * route actually executes and returns the intended errors, which the unit
 * tests alone cannot show.
 *
 *   PORT=5000 node scripts/probePayoutRoute.js <userId>
 */

import 'dotenv/config';
import http from 'node:http';

const PORT = process.env.PORT || 5000;
const userId = Number(process.argv[2]) || 13;

const secret = process.env.JWT_SECRET;
if (!secret) {
    console.error('JWT_SECRET is not set.');
    process.exit(1);
}
const { default: jwt } = await import('jsonwebtoken');
const token = jwt.sign({ id: userId, userId }, secret, { expiresIn: '10m' });

function post(path, payload) {
    return new Promise((resolve) => {
        const body = JSON.stringify(payload);
        const req = http.request(
            {
                host: 'localhost',
                port: PORT,
                path,
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            },
            (res) => {
                let out = '';
                res.on('data', (d) => { out += d; });
                res.on('end', () => resolve({ status: res.statusCode, body: out }));
            }
        );
        req.on('error', (e) => resolve({ status: 0, body: e.message }));
        req.end(body);
    });
}

// Validation-only cases: all are rejected before any wallet mutation.
const CASES = [
    {
        name: 'non-numeric amount ("abc")',
        expect: 400,
        contains: 'valid amount',
        payload: { amount: 'abc', accountName: 'Test', phoneNumber: '9999999999', bankAccount: '1234567890', ifscCode: 'TEST0000001' },
    },
    {
        name: 'zero amount',
        expect: 400,
        contains: 'greater than zero',
        payload: { amount: 0, accountName: 'Test', phoneNumber: '9999999999', bankAccount: '1234567890', ifscCode: 'TEST0000001' },
    },
    {
        name: 'negative amount',
        expect: 400,
        contains: 'greater than zero',
        payload: { amount: -500, accountName: 'Test', phoneNumber: '9999999999', bankAccount: '1234567890', ifscCode: 'TEST0000001' },
    },
    {
        name: 'below minimum, not the full balance',
        expect: 400,
        contains: 'Minimum payout',
        payload: { amount: 100, accountName: 'Test', phoneNumber: '9999999999', bankAccount: '1234567890', ifscCode: 'TEST0000001' },
    },
    {
        name: 'exceeds available balance',
        expect: 400,
        contains: 'Insufficient wallet balance',
        payload: { amount: 99999999, accountName: 'Test', phoneNumber: '9999999999', bankAccount: '1234567890', ifscCode: 'TEST0000001' },
    },
    {
        name: 'missing account holder name',
        expect: 400,
        contains: 'Account holder',
        payload: { amount: 5000, phoneNumber: '9999999999', bankAccount: '1234567890', ifscCode: 'TEST0000001' },
    },
    {
        name: 'bank method without IFSC',
        expect: 400,
        contains: 'IFSC',
        payload: { amount: 5000, accountName: 'Test', phoneNumber: '9999999999', bankAccount: '1234567890' },
    },
];

console.log(`\nProbing POST /api/wallet/payout/request on port ${PORT} as user ${userId}`);
console.log('(validation-only cases; no wallet is debited)\n');

let failures = 0;
for (const c of CASES) {
    const res = await post('/api/wallet/payout/request', c.payload);
    let detail = res.body;
    try {
        detail = JSON.parse(res.body).error || res.body;
    } catch { /* keep raw */ }
    const okStatus = res.status === c.expect;
    const okMessage = String(detail).toLowerCase().includes(c.contains.toLowerCase());
    const pass = okStatus && okMessage;
    if (!pass) failures += 1;
    console.log(
        `  ${pass ? 'PASS' : 'FAIL'}  ${c.name.padEnd(34)} http ${res.status}  "${String(detail).slice(0, 70)}"`
    );
}

console.log(
    failures === 0
        ? `\nAll ${CASES.length} validation cases behaved correctly. No money moved.\n`
        : `\n${failures} case(s) did not behave as expected.\n`
);
process.exit(failures === 0 ? 0 : 1);
