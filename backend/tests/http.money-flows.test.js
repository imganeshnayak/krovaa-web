/**
 * HTTP-level money-flow tests: the REAL route handlers, over a real socket.
 *
 * These call the actual endpoints in escrow.js, wallet.js and admin.js rather
 * than reimplementing their logic. That is deliberate: the earlier integration
 * tests proved the arithmetic and the database layer, but a refactor bug inside
 * a handler itself would have slipped past them.
 *
 * The invariant under test in every case:
 *   what left the client == what the vendor holds + the client refund + the fee
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { resetDatabase, createUser, createPaidDeal, reloadDeal, balance } from './helpers/testDb.js';
import { startTestApp } from './helpers/httpApp.js';
import { computeFeeSplit, sumRecordedPlatformFee, sumReleasedToVendor } from '../utils/fees.js';
import { toAmount } from '../utils/decimalJson.js';

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

let app;

test.before(async () => {
    await resetDatabase(prisma);
    app = await startTestApp();
});

test.after(async () => {
    await app?.close();
    await resetDatabase(prisma);
    await prisma.$disconnect();
});

const GROSS = 10000;
const FEE_PCT = 0.10;
const { fee: FEE, net: NET } = computeFeeSplit(GROSS, FEE_PCT); // 1000 / 9000

async function scenario({ role = 'client' } = {}) {
    const client = await createUser(prisma, { walletBalance: GROSS, role });
    const vendor = await createUser(prisma, { walletBalance: 0, role: 'vendor' });
    const deal = await createPaidDeal(prisma, { client, vendor, gross: GROSS, feePercent: FEE_PCT });
    return {
        client,
        vendor,
        deal,
        clientToken: app.tokenFor(client),
        vendorToken: app.tokenFor(vendor),
    };
}

// ======================================================================================
// Release
// ======================================================================================

test('POST /api/escrow/:id/release pays the vendor the post-fee net', async () => {
    const { client, vendor, deal, clientToken } = await scenario();

    const res = await app.post(`/api/escrow/${deal.id}/release`, {
        token: clientToken,
        body: { percent: 100 },
    });
    assert.equal(res.status, 200, `release failed: ${res.text}`);

    const vendorAfter = await balance(prisma, vendor.id);
    assert.equal(vendorAfter.walletBalance, NET, 'vendor must receive gross minus the platform fee');

    const stored = await reloadDeal(prisma, deal.id);
    assert.equal(stored.releasedPercent, 100);
    assert.equal(stored.status, 'completed');
    assert.equal(sumReleasedToVendor(stored.transactions), NET, 'ledger must match the wallet');
    assert.equal(sumRecordedPlatformFee(stored.transactions), FEE, 'the fee row must survive');
    assert.equal(
        (await balance(prisma, client.id)).walletBalance,
        0,
        'the client is already debited at creation and must not be debited again'
    );
});

test('POST /api/escrow/:id/release: two partial releases total exactly the net', async () => {
    const { vendor, deal, clientToken } = await scenario();

    const first = await app.post(`/api/escrow/${deal.id}/release`, { token: clientToken, body: { percent: 40 } });
    assert.equal(first.status, 200, `first release failed: ${first.text}`);
    const afterFirst = await balance(prisma, vendor.id);
    assert.equal(afterFirst.walletBalance, 3600, '40% of the 9000 net is 3600');

    const second = await app.post(`/api/escrow/${deal.id}/release`, { token: clientToken, body: { percent: 60 } });
    assert.equal(second.status, 200, `second release failed: ${second.text}`);
    const afterSecond = await balance(prisma, vendor.id);
    assert.equal(afterSecond.walletBalance, NET, '40% + 60% must equal exactly the net');

    const stored = await reloadDeal(prisma, deal.id);
    assert.equal(stored.releasedPercent, 100);
});

test('POST /api/escrow/:id/release: over-releasing is rejected and pays nothing extra', async () => {
    const { vendor, deal, clientToken } = await scenario();

    await app.post(`/api/escrow/${deal.id}/release`, { token: clientToken, body: { percent: 50 } });
    const midway = (await balance(prisma, vendor.id)).walletBalance;

    const over = await app.post(`/api/escrow/${deal.id}/release`, { token: clientToken, body: { percent: 80 } });
    assert.ok(over.status >= 400, `expected a rejection, got ${over.status}`);

    assert.equal(
        (await balance(prisma, vendor.id)).walletBalance,
        midway,
        'a rejected release must not move money'
    );
});

test('POST /api/escrow/:id/release: invalid percentages are rejected', async () => {
    const { vendor, deal, clientToken } = await scenario();
    for (const percent of [0, -10, 101, 'abc', null]) {
        const res = await app.post(`/api/escrow/${deal.id}/release`, { token: clientToken, body: { percent } });
        assert.equal(res.status, 400, `percent=${percent} should be rejected`);
    }
    assert.equal((await balance(prisma, vendor.id)).walletBalance, 0, 'no money may move');
});

test('POST /api/escrow/:id/release: only the client may release', async () => {
    const { vendor, deal, vendorToken } = await scenario();

    const res = await app.post(`/api/escrow/${deal.id}/release`, { token: vendorToken, body: { percent: 100 } });
    assert.equal(res.status, 403, 'the vendor must not be able to trigger their own payout');
    assert.equal((await balance(prisma, vendor.id)).walletBalance, 0);
});

test('POST /api/escrow/:id/release: requires authentication', async () => {
    const { deal } = await scenario();
    const res = await app.post(`/api/escrow/${deal.id}/release`, { body: { percent: 100 } });
    assert.equal(res.status, 401);
});

test('POST /api/escrow/:id/release: a 404 for an unknown deal', async () => {
    const { clientToken } = await scenario();
    const res = await app.post('/api/escrow/99999999/release', { token: clientToken, body: { percent: 100 } });
    assert.equal(res.status, 404);
});

test('POST /api/escrow/:id/confirm-release pays the remainder on buyer confirmation', async () => {
    const { vendor, deal, clientToken } = await scenario();

    await app.post(`/api/escrow/${deal.id}/release`, { token: clientToken, body: { percent: 30 } });
    assert.equal((await balance(prisma, vendor.id)).walletBalance, 2700);

    const confirm = await app.post(`/api/escrow/${deal.id}/confirm-release`, { token: clientToken });
    assert.equal(confirm.status, 200, `confirm failed: ${confirm.text}`);

    const final = await balance(prisma, vendor.id);
    assert.equal(final.walletBalance, NET, '30% then confirmation must total exactly the net');
    assert.equal((await reloadDeal(prisma, deal.id)).releasedPercent, 100);
});

// ======================================================================================
// Cancel
// ======================================================================================

test('POST /api/escrow/:id/cancel refunds the net and the platform keeps its fee', async () => {
    const { client, vendor, deal, clientToken } = await scenario();

    const res = await app.post(`/api/escrow/${deal.id}/cancel`, {
        token: clientToken,
        body: { reason: 'Changed my mind' },
    });
    assert.equal(res.status, 200, `cancel failed: ${res.text}`);

    const clientAfter = await balance(prisma, client.id);
    const vendorAfter = await balance(prisma, vendor.id);

    assert.equal(clientAfter.walletBalance, NET, 'client gets back everything except the fee');
    assert.equal(vendorAfter.walletBalance, 0, 'the vendor must receive nothing');

    // Conservation: the fee is the only thing the platform keeps.
    const retained = GROSS - clientAfter.walletBalance - vendorAfter.walletBalance;
    assert.equal(retained, FEE, 'platform must retain exactly the recorded fee');
    assert.equal((await reloadDeal(prisma, deal.id)).status, 'cancelled');
});

test('POST /api/escrow/:id/cancel after a partial release refunds only the remainder', async () => {
    const { client, vendor, deal, clientToken } = await scenario();

    await app.post(`/api/escrow/${deal.id}/release`, { token: clientToken, body: { percent: 60 } });
    const vendorHeld = (await balance(prisma, vendor.id)).walletBalance;
    assert.equal(vendorHeld, 5400);

    const res = await app.post(`/api/escrow/${deal.id}/cancel`, {
        token: clientToken,
        body: { reason: 'Partial refund' },
    });
    assert.equal(res.status, 200, `cancel failed: ${res.text}`);

    const clientAfter = await balance(prisma, client.id);
    assert.equal(clientAfter.walletBalance, 3600, 'client gets the unreleased 40% of the net');

    // Nothing is created or destroyed: vendor + refund + fee === gross.
    const conserved = vendorHeld + clientAfter.walletBalance + FEE;
    assert.equal(conserved, GROSS, 'funds must reconcile to the original gross');
});

test('POST /api/escrow/:id/cancel: an already-cancelled deal is rejected', async () => {
    const { client, deal, clientToken } = await scenario();
    await app.post(`/api/escrow/${deal.id}/cancel`, { token: clientToken, body: { reason: 'First' } });
    const afterFirst = (await balance(prisma, client.id)).walletBalance;

    const second = await app.post(`/api/escrow/${deal.id}/cancel`, { token: clientToken, body: { reason: 'Second' } });
    assert.ok(second.status >= 400, `expected a rejection, got ${second.status}`);
    assert.equal(
        (await balance(prisma, client.id)).walletBalance,
        afterFirst,
        'a rejected cancel must not refund twice'
    );
});

test('REGRESSION: cancel must never refund money the vendor already holds', async () => {
    // This is the bug the HTTP tests exist to catch. The cancel handler used to
    // refund deal.paidAmount in full, ignoring both the platform fee and
    // releasedPercent. On a 60%-released deal that meant the client got 100%
    // back while the vendor kept 60%, so the platform paid out of pocket.
    for (const released of [0, 25, 60, 99]) {
        const { client, vendor, deal, clientToken } = await scenario();
        if (released > 0) {
            const r = await app.post(`/api/escrow/${deal.id}/release`, {
                token: clientToken,
                body: { percent: released },
            });
            assert.equal(r.status, 200, `setup release failed: ${r.text}`);
        }

        const vendorHeld = (await balance(prisma, vendor.id)).walletBalance;
        const res = await app.post(`/api/escrow/${deal.id}/cancel`, {
            token: clientToken,
            body: { reason: `cancel after ${released}%` },
        });
        assert.equal(res.status, 200, `cancel failed at ${released}%: ${res.text}`);

        const clientAfter = (await balance(prisma, client.id)).walletBalance;

        // The hard invariant: the platform can never be out of pocket.
        const expectedUnreleasedNet = roundTo2(NET * (1 - released / 100));
        assert.equal(
            clientAfter,
            expectedUnreleasedNet,
            `client refund at ${released}% released must be the unreleased net`
        );
        assert.ok(
            vendorHeld + clientAfter <= GROSS,
            `platform would be out of pocket: vendor ${vendorHeld} + client ${clientAfter} > gross ${GROSS}`
        );
        assert.ok(
            vendorHeld + clientAfter + FEE <= GROSS,
            'the platform must retain at least its recorded fee'
        );
    }
});

test('REGRESSION: a fully-released deal cannot be cancelled at all', async () => {
    const { client, vendor, deal, clientToken } = await scenario();
    const r = await app.post(`/api/escrow/${deal.id}/release`, { token: clientToken, body: { percent: 100 } });
    assert.equal(r.status, 200);

    const vendorHeld = (await balance(prisma, vendor.id)).walletBalance;
    const cancel = await app.post(`/api/escrow/${deal.id}/cancel`, { token: clientToken, body: { reason: 'too late' } });
    assert.equal(cancel.status, 400, 'a completed deal must not be cancellable');
    assert.equal((await balance(prisma, vendor.id)).walletBalance, vendorHeld, 'no refund may be issued');
    assert.equal((await balance(prisma, client.id)).walletBalance, 0);
});

test('REGRESSION: a non-numeric release percent returns 400, not 500', async () => {
    const { deal, clientToken } = await scenario();
    for (const percent of ['abc', 'fifty', {}, [], true]) {
        const res = await app.post(`/api/escrow/${deal.id}/release`, {
            token: clientToken,
            body: { percent },
        });
        assert.equal(res.status, 400, `percent=${JSON.stringify(percent)} returned ${res.status}, expected 400`);
    }
});

test('NO ENDPOINT RETURNS 5xx: catches schema/code drift', async () => {
    // Regression guard. A Prisma select naming a field that does not exist in
    // the schema (e.g. `stock` on DealListing) throws "Unknown argument" and
    // surfaces as a 500 on that route only, while everything else looks fine.
    // That happened in production: the marketplace returned 500 because the
    // generated client finally reflected a schema missing `stock`.
    const client = await createUser(prisma, { walletBalance: 1000 });
    const token = app.tokenFor(client);
    const listing = await prisma.dealListing.create({
        data: {
            shareCode: `TEST${Date.now().toString().slice(-6)}`,
            sellerId: client.id,
            title: 'Smoke test listing',
            description: 'x',
            price: 500,
            stock: 3,
        },
    });

    const routes = [
        ['GET', '/api/deals'],
        ['GET', `/api/deals/${listing.id}`],
        ['GET', '/api/wallet/balance'],
        ['GET', '/api/wallet/transactions'],
        ['GET', '/api/wallet/payout/requests'],
        ['GET', '/api/seller/stats'],
        ['GET', '/api/escrow/platform-fee'],
    ];

    const failures = [];
    for (const [method, path] of routes) {
        const res = await app[method.toLowerCase()](path, { token });
        if (res.status >= 500) {
            const m = String(res.text).match(/Unknown argument `([^`]+)`/);
            failures.push(`${path} -> ${res.status}${m ? ` (unknown argument: ${m[1]})` : ''}`);
        }
    }
    assert.deepEqual(failures, [], `these routes returned 5xx:\n${failures.join('\n')}`);
});

test('the marketplace listing carries a usable stock value', async () => {
    const seller = await createUser(prisma, { walletBalance: 0 });
    const listing = await prisma.dealListing.create({
        data: {
            shareCode: `STK${Date.now().toString().slice(-6)}`,
            sellerId: seller.id,
            title: 'Stocked listing',
            description: 'x',
            price: 750,
            stock: 4,
        },
    });

    const res = await app.get('/api/deals', { token: app.tokenFor(seller) });
    assert.equal(res.status, 200, `marketplace failed: ${res.text}`);
    const found = res.body.find((d) => d.id === listing.id);
    assert.ok(found, 'the new listing must appear in the marketplace');
    assert.equal(typeof found.stock, 'number', 'stock must be a number');
    assert.equal(found.stock, 4);
    assert.equal(typeof found.price, 'number', 'price must be a JSON number, not a Decimal string');
});

function roundTo2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ======================================================================================
// Payout
// ======================================================================================

test('POST /api/wallet/payout/request debits the wallet and records the payout', async () => {
    const client = await createUser(prisma, { walletBalance: 5000 });
    const token = app.tokenFor(client);

    const res = await app.post('/api/wallet/payout/request', {
        token,
        body: {
            amount: 2000,
            accountName: 'Test Payer',
            phoneNumber: '9999999999',
            paymentMethod: 'bank',
            bankAccount: '1234567890',
            ifscCode: 'TEST0000001',
        },
    });
    assert.equal(res.status, 200, `payout request failed: ${res.text}`);
    assert.equal(toAmount(res.body.amount), 2000, 'the response amount must be a JSON number');

    const after = await balance(prisma, client.id);
    assert.equal(after.walletBalance, 3000, 'exactly the requested amount must be debited');

    const stored = await prisma.payoutRequest.findFirst({ where: { userId: client.id } });
    assert.equal(toAmount(stored.amount), 2000);
    assert.equal(stored.status, 'pending');
});

test('withdrawing the ENTIRE balance over HTTP lands exactly on zero', async () => {
    const client = await createUser(prisma, { walletBalance: 20081.92 });
    const token = app.tokenFor(client);

    const res = await app.post('/api/wallet/payout/request', {
        token,
        body: {
            amount: 20081.92,
            accountName: 'Full Withdrawal',
            phoneNumber: '9999999999',
            paymentMethod: 'bank',
            bankAccount: '1234567890',
            ifscCode: 'TEST0000001',
        },
    });
    assert.equal(res.status, 200, `full withdrawal failed: ${res.text}`);

    const after = await balance(prisma, client.id);
    assert.equal(after.walletBalance, 0, 'a full withdrawal must leave exactly zero, not dust');
});

test('a sub-₹500 balance can still be fully withdrawn over HTTP', async () => {
    const client = await createUser(prisma, { walletBalance: 300 });
    const token = app.tokenFor(client);

    const res = await app.post('/api/wallet/payout/request', {
        token,
        body: {
            amount: 300,
            accountName: 'Small Balance',
            phoneNumber: '9999999999',
            paymentMethod: 'bank',
            bankAccount: '1234567890',
            ifscCode: 'TEST0000001',
        },
    });
    assert.equal(res.status, 200, `a small full withdrawal must be allowed: ${res.text}`);
    assert.equal((await balance(prisma, client.id)).walletBalance, 0);
});

test('an over-balance payout is rejected and debits nothing', async () => {
    const client = await createUser(prisma, { walletBalance: 1000 });
    const token = app.tokenFor(client);

    const res = await app.post('/api/wallet/payout/request', {
        token,
        body: {
            amount: 5000,
            accountName: 'Too Much',
            phoneNumber: '9999999999',
            paymentMethod: 'bank',
            bankAccount: '1234567890',
            ifscCode: 'TEST0000001',
        },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Insufficient wallet balance/);
    assert.equal((await balance(prisma, client.id)).walletBalance, 1000, 'nothing may be debited');
    assert.equal(await prisma.payoutRequest.count({ where: { userId: client.id } }), 0);
});

test('PUT /api/admin/payouts/:id cancelling a payout refunds it exactly', async () => {
    const client = await createUser(prisma, { walletBalance: 5000 });
    const admin = await createUser(prisma, { role: 'admin' });

    const created = await app.post('/api/wallet/payout/request', {
        token: app.tokenFor(client),
        body: {
            amount: 2000,
            accountName: 'Refundable',
            phoneNumber: '9999999999',
            paymentMethod: 'bank',
            bankAccount: '1234567890',
            ifscCode: 'TEST0000001',
        },
    });
    assert.equal(created.status, 200);
    assert.equal((await balance(prisma, client.id)).walletBalance, 3000);

    const payoutId = created.body.id;
    const cancel = await app.put(`/api/admin/payouts/${payoutId}`, {
        token: app.tokenFor(admin),
        body: { status: 'cancelled', adminNote: 'Test cancellation' },
    });
    assert.equal(cancel.status, 200, `admin cancel failed: ${cancel.text}`);

    const after = await balance(prisma, client.id);
    assert.equal(after.walletBalance, 5000, 'a cancelled payout must restore the exact starting balance');
    assert.equal((await prisma.payoutRequest.findUnique({ where: { id: payoutId } })).status, 'cancelled');
});

test('GET /api/seller/stats reports the recorded fee, not the live rate', async () => {
    const client = await createUser(prisma, { walletBalance: GROSS });
    const vendor = await createUser(prisma, { walletBalance: 0, role: 'vendor' });
    const deal = await createPaidDeal(prisma, { client, vendor, gross: GROSS, feePercent: FEE_PCT });

    await app.post(`/api/escrow/${deal.id}/release`, { token: app.tokenFor(client), body: { percent: 100 } });

    const res = await app.get('/api/seller/stats', { token: app.tokenFor(vendor) });
    assert.equal(res.status, 200, `seller stats failed: ${res.text}`);

    const sale = res.body.salesHistory.find((s) => s.id === deal.id);
    assert.ok(sale, 'the deal must appear in the sales history');
    assert.equal(typeof sale.grossAmount, 'number', 'money must be a JSON number');
    assert.equal(sale.platformFee, FEE, 'must report the fee actually charged');
    assert.equal(sale.netPayout, NET, 'must report the real payout');
    assert.equal(res.body.releasedEarningsBalance, NET);
});
