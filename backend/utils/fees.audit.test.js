/**
 * Static regression guard for platform-fee call sites.
 *
 * The fee math itself is covered by fees.test.js. These tests lock down the
 * *call sites* so a future edit cannot quietly re-introduce the bugs that were
 * found here, each of which either lost money or crashed a money path:
 *
 *   1. cronService wrote `releasedAmount` on EscrowDeal — that column does not
 *      exist in the Prisma schema, so every 3-day auto-release threw.
 *   2. sellerStats read the same non-existent column, so it always fell back to
 *      `totalAmount * (1 - fee)` and reported a partially-released deal as
 *      fully paid out.
 *   3. Fee amounts were recomputed from the live `platform_fee_percent`
 *      setting at release/refund time, so an admin rate change retroactively
 *      altered deals that had already been paid.
 *   4. Unrounded float math (gross * 0.1) leaked paise across releases.
 *
 * These read source text rather than hitting a database, so they run in CI with
 * no database. Behaviour is still verified by fees.test.js.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');

const read = (rel) => readFileSync(path.join(backendRoot, rel), 'utf8');

const FEE_SITES = [
    'routes/escrow.js',
    'routes/payments.js',
    'routes/sellerStats.js',
    'services/cronService.js',
];

const schema = read('prisma/schema.prisma');

test('EscrowDeal has no `releasedAmount` column (the cron was writing a phantom field)', () => {
    const model = schema.slice(schema.indexOf('model EscrowDeal {'), schema.indexOf('model EscrowTransaction {'));
    assert.ok(model.length > 0, 'EscrowDeal model not found');
    assert.ok(
        !/^\s*releasedAmount\s+Float/m.test(model),
        'EscrowDeal.releasedAmount now exists — if it was added, update cronService/sellerStats to persist it'
    );
});

test('no route reads or writes a releasedAmount field on a deal', () => {
    for (const site of FEE_SITES) {
        const src = read(site);
        assert.ok(
            !/releasedAmount\s*:/.test(src),
            `${site} writes releasedAmount, which is not a column on EscrowDeal`
        );
        assert.ok(
            !/deal\.releasedAmount\b/.test(src),
            `${site} reads deal.releasedAmount, which is not a column on EscrowDeal`
        );
    }
});

test('no fee call site recomputes the percentage inline with a hardcoded 0.10 default', () => {
    for (const site of FEE_SITES) {
        const src = read(site);
        assert.ok(
            !/platformFeePercent\s*=\s*0\.10/.test(src),
            `${site} still defaults platformFeePercent inline — use getPlatformFeePercent(prisma)`
        );
        assert.ok(
            !/systemSetting\.findUnique\(\{\s*where:\s*\{\s*key:\s*'platform_fee_percent'/.test(src),
            `${site} still reads platform_fee_percent directly — use getPlatformFeePercent(prisma)`
        );
    }
});

test('no fee call site multiplies gross by a raw percentage without rounding', () => {
    for (const site of FEE_SITES) {
        const src = read(site);
        assert.ok(
            !/\*\s*(1\s*-\s*platformFeePercent|platformFeePercent)\s*\)/.test(src),
            `${site} computes a net amount with unrounded float math — use computeFeeSplit/computePartialRelease`
        );
    }
});

test('every fee call site imports the tested fee utils', () => {
    for (const site of FEE_SITES) {
        const src = read(site);
        assert.ok(
            /from '\.\.\/utils\/fees\.js'/.test(src),
            `${site} does not import utils/fees.js`
        );
    }
});

test('sellerStats reports the recorded fee, not the live configured rate', () => {
    const src = read('routes/sellerStats.js');
    assert.ok(
        !/platformFee:\s*deal\.totalAmount\s*\*/.test(src),
        'sellerStats still derives platformFee from the live rate — use computeSellerFeeLine'
    );
    assert.ok(
        !/releasedEarningsBalance\s*\+=\s*deal\.totalAmount/.test(src),
        'sellerStats still credits gross instead of the seller net'
    );
    assert.ok(src.includes('releasedPercent: deal.releasedPercent'), 'sellerStats ignores releasedPercent');
});

test('the RMA refund path settles on the recorded fee, not today’s rate', () => {
    const src = read('routes/escrow.js');
    const rmaIndex = src.lastIndexOf('paymentRefund.update');
    assert.ok(rmaIndex > 0, 'refund endpoint not found');
    const rmaSection = src.slice(Math.max(0, rmaIndex - 3000), rmaIndex);
    assert.ok(
        rmaSection.includes('computeReturnRefund'),
        'refund endpoint does not use computeReturnRefund'
    );
    assert.ok(
        !/deal\.paidAmount\s*-\s*\(deal\.totalAmount\s*\*/.test(src),
        'refund still re-derives the fee from the live rate'
    );
});

test('the split-deal payout splits the post-fee net, not the gross', () => {
    const src = read('routes/escrow.js');
    assert.ok(src.includes('computeSplitPayouts(vendorNet'), 'split release must split vendorNet');
    assert.ok(
        !/splitAmount\s*=\s*vendorNet\s*\*\s*\(/.test(src),
        'split payout still recomputes amounts inline'
    );
});

test('REGRESSION GUARD: the ACTIVE cancel route is fee- and release-aware', () => {
    // An earlier version of this audit only checked that computeCancelRefund
    // appeared *somewhere* in escrow.js. It did - inside the PUT /:id handler -
    // while the route that actually serves POST /:id/cancel still refunded the
    // full paidAmount, ignoring both the platform fee and releasedPercent.
    // That let the platform pay out of pocket. Scope the check to the handler.
    const src = read('routes/escrow.js');
    const start = src.indexOf("router.post('/:id/cancel'");
    assert.ok(start > 0, 'POST /:id/cancel route not found');
    // Bound the handler by the next top-level route registration.
    const nextRoute = src.indexOf('\nrouter.', start + 1);
    const handler = src.slice(start, nextRoute > 0 ? nextRoute : src.length);

    assert.ok(
        handler.includes('computeCancelRefund'),
        'POST /:id/cancel must compute a fee-aware refund, not refund the full paidAmount'
    );
    assert.ok(
        !/applyWalletDelta\(\s*tx\s*,\s*deal\.clientId\s*,\s*deal\.paidAmount\s*\)/.test(handler),
        'POST /:id/cancel still refunds the full paidAmount, which ignores the fee and released funds'
    );
    assert.ok(
        /releasedPercent/.test(handler),
        'POST /:id/cancel must account for funds already released to the vendor'
    );
});

test('the release handler rejects non-numeric percentages before doing work', () => {
    const src = read('routes/escrow.js');
    const start = src.indexOf("router.post('/:id/release'");
    assert.ok(start > 0, 'POST /:id/release route not found');
    const nextRoute = src.indexOf('\nrouter.', start + 1);
    const handler = src.slice(start, nextRoute > 0 ? nextRoute : src.length);

    assert.ok(
        handler.includes('Number.isFinite(releasePercent)'),
        'the release handler must reject non-numeric percentages with a 400 instead of crashing with a 500'
    );
});
