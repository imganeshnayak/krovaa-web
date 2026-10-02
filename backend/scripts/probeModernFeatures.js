/**
 * Live check for the new marketplace features: wishlist, public tracking,
 * sort, and the hardened delivery webhook.
 *
 *   PORT=5000 node scripts/probeModernFeatures.js [userId]
 */

import 'dotenv/config';
import http from 'node:http';

const PORT = process.env.PORT || 5000;
const userId = Number(process.argv[2]) || 13;

const secret = process.env.JWT_SECRET;
if (!secret) { console.error('JWT_SECRET not set.'); process.exit(1); }
const { default: jwt } = await import('jsonwebtoken');
const { computeSignatures, isNdrStatus } = await import('../utils/webhookSecurity.js');

const token = jwt.sign(
    { id: userId, userId, role: 'client', status: 'active', permissions: [] },
    secret,
    { expiresIn: '20m' }
);

function call(method, path, { auth = true, body, headers = {} } = {}) {
    return new Promise((resolve) => {
        const payload = body === undefined ? null : JSON.stringify(body);
        const req = http.request(
            {
                host: 'localhost', port: PORT, path, method,
                headers: {
                    ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
                    ...(auth ? { Authorization: `Bearer ${token}` } : {}),
                    ...headers,
                },
            },
            (res) => {
                let out = '';
                res.on('data', (d) => { out += d; });
                res.on('end', () => {
                    let json = null;
                    try { json = out ? JSON.parse(out) : null; } catch { /* raw */ }
                    resolve({ status: res.statusCode, body: json, text: out });
                });
            }
        );
        req.on('error', (e) => resolve({ status: 0, text: e.message }));
        req.end(payload ?? undefined);
    });
}

let failures = 0;
const check = (label, cond, detail = '') => {
    if (!cond) failures += 1;
    console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
};

console.log(`\nModern-feature probe on port ${PORT}\n`);

const pub = await call('GET', '/api/deals/public?sort=price_asc&limit=5', { auth: false });
check('GET /api/deals/public with sort', pub.status === 200 && Array.isArray(pub.body?.deals),
    `http ${pub.status} sort=${pub.body?.sort}`);
const prices = (pub.body?.deals || []).map((d) => Number(d.price));
check('  prices are ascending', prices.every((p, i) => i === 0 || prices[i - 1] <= p));
check('  price is a number, not a string', pub.body?.deals?.[0] ? typeof pub.body.deals[0].price === 'number' : true);

const clamped = await call('GET', '/api/deals/public?limit=99999', { auth: false });
check('limit is clamped', clamped.status === 200 && clamped.body?.limit <= 60, `limit=${clamped.body?.limit}`);

const ids = await call('GET', '/api/wishlist/ids');
check('GET /api/wishlist/ids', ids.status === 200 && Array.isArray(ids.body?.listingIds), `http ${ids.status}`);

const badToggle = await call('POST', '/api/wishlist/toggle', { body: { listingId: 'not-a-number' } });
check('POST /api/wishlist/toggle rejects a bad id', badToggle.status === 400, `http ${badToggle.status}`);

const trackMiss = await call('GET', '/api/shipping/track/DOESNOTEXIST99', { auth: false });
check('GET /api/shipping/track 404s cleanly', trackMiss.status === 404, `http ${trackMiss.status}`);
const trackShort = await call('GET', '/api/shipping/track/ab', { auth: false });
check('  short id 400s', trackShort.status === 400, `http ${trackShort.status}`);

const forged = await call('POST', '/webhooks/delivery-updates', {
    auth: false,
    body: { awb: 'FAKE1', current_status: 'Delivered' },
});
check('UNSIGNED delivery webhook is rejected', forged.status === 401, `http ${forged.status}`);

const wrongSig = await call('POST', '/webhooks/delivery-updates', {
    auth: false,
    body: { awb: 'FAKE1', current_status: 'Delivered' },
    headers: { 'x-shiprocket-signature': 'f'.repeat(64) },
});
check('WRONGLY SIGNED webhook is rejected', wrongSig.status === 401, `http ${wrongSig.status}`);

if (process.env.SHIPROCKET_WEBHOOK_SECRET) {
    const payload = { awb: 'FAKE1', current_status: 'NDR' };
    const { hex } = computeSignatures(JSON.stringify(payload), process.env.SHIPROCKET_WEBHOOK_SECRET);
    const signed = await call('POST', '/webhooks/delivery-updates', {
        auth: false, body: payload, headers: { 'x-shiprocket-signature': hex },
    });
    // 200 = accepted (no matching AWB), 401 = signature rejected.
    check('SIGNED webhook is accepted', signed.status === 200, `http ${signed.status}`);
} else {
    console.log('  SKIP  signed-webhook check (SHIPROCKET_WEBHOOK_SECRET not set)');
}

check('NDR detection covers common couriers',
    isNdrStatus('Delivery Failed') && isNdrStatus('Customer Not Available') && isNdrStatus('RTO Initiated')
    && !isNdrStatus('Delivered') && !isNdrStatus('Out For Delivery'));

console.log(failures === 0 ? '\nAll modern-feature checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
