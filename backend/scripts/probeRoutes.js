/**
 * Smoke-test the live API for 500s.
 *
 * A stale Prisma client or a schema/code mismatch surfaces as a 500 on a single
 * endpoint while everything else looks fine, which is easy to miss. This walks
 * the main read endpoints and reports any that fail.
 *
 *   PORT=5000 node scripts/probeRoutes.js [userId]
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
const token = jwt.sign(
    { id: userId, userId, role: 'client', status: 'active', permissions: [] },
    secret,
    { expiresIn: '30m' }
);

const ROUTES = [
    ['GET', '/api/deals'],
    ['GET', '/api/deals/marketplace'],
    ['GET', '/api/wallet/balance'],
    ['GET', '/api/wallet/transactions'],
    ['GET', '/api/wallet/payout/requests'],
    ['GET', '/api/seller/stats'],
    ['GET', '/api/escrow/platform-fee'],
    ['GET', '/api/communities'],
    ['GET', '/api/messages/conversations'],
    ['GET', '/api/notifications'],
    ['GET', '/api/users/me'],
];

function req(method, path, auth) {
    return new Promise((resolve) => {
        const r = http.request(
            {
                host: 'localhost',
                port: PORT,
                path,
                method,
                headers: auth ? { Authorization: `Bearer ${token}` } : {},
            },
            (res) => {
                let b = '';
                res.on('data', (d) => { b += d; });
                res.on('end', () => resolve({ status: res.statusCode, body: b }));
            }
        );
        r.on('error', (e) => resolve({ status: 0, body: e.message }));
        r.end();
    });
}

let serverErrors = 0;
let ok = 0;
console.log(`\nSmoke-testing live API on port ${PORT} as user ${userId}\n`);

for (const [method, path] of ROUTES) {
    const res = await req(method, path, path !== '/api/deals');
    let note = '';
    if (res.status >= 500) {
        serverErrors += 1;
        const m = res.body.match(/Unknown argument `([^`]+)`/);
        note = m ? ` <-- unknown argument: ${m[1]}` : ' <-- SERVER ERROR';
        console.log(`  ${String(res.status).padEnd(4)} ${path}${note}`);
        const prismaMsg = res.body.match(/"message"\s*:\s*"([^"]{0,140})"/);
        if (prismaMsg) console.log(`       ${prismaMsg[1]}`);
    } else if (res.status === 200 || res.status === 401 || res.status === 403) {
        ok += 1;
        console.log(`  ${String(res.status).padEnd(4)} ${path}`);
    } else {
        console.log(`  ${String(res.status).padEnd(4)} ${path}`);
    }
}

console.log(
    serverErrors === 0
        ? `\nNo server errors across ${ok} route(s).\n`
        : `\n${serverErrors} route(s) returned 5xx.\n`
);
process.exit(serverErrors === 0 ? 0 : 1);
