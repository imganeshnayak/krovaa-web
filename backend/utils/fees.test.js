import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_PLATFORM_FEE_PERCENT,
    DEFAULT_RETURN_SHIPPING_FEE,
    roundMoney,
    resolvePlatformFeePercent,
    computeFeeSplit,
    sumRecordedPlatformFee,
    sumReleasedToVendor,
    resolveDealPlatformFee,
    computeVendorNet,
    computePartialRelease,
    computeCancelRefund,
    computeReturnRefund,
    computeSellerPayout,
    computeSellerFeeLine,
    computeSplitPayouts,
} from './fees.js';

const RATE = 0.10;
const paid = { paymentStatus: 'paid' };

// --------------------------------------------------------------------------------------
// 1. Fee percentage resolution
// --------------------------------------------------------------------------------------

test('resolvePlatformFeePercent: parses stored fraction and clamps out-of-range values', () => {
    assert.equal(resolvePlatformFeePercent('0.10'), 0.10);
    assert.equal(resolvePlatformFeePercent('0.075'), 0.075);
    assert.equal(resolvePlatformFeePercent(0.25), 0.25);
    // Admin-friendly: a whole number is read as a percentage, not a fraction.
    assert.equal(resolvePlatformFeePercent(15), 0.15);
    assert.equal(resolvePlatformFeePercent('15'), 0.15);
    assert.equal(resolvePlatformFeePercent('-5'), 0);
    assert.equal(resolvePlatformFeePercent('5'), 0.05, '5 must be read as 5%, not clamped to 100%');
    assert.equal(resolvePlatformFeePercent('garbage'), DEFAULT_PLATFORM_FEE_PERCENT);
    assert.equal(resolvePlatformFeePercent(null), DEFAULT_PLATFORM_FEE_PERCENT);
    assert.equal(resolvePlatformFeePercent(undefined), DEFAULT_PLATFORM_FEE_PERCENT);
    assert.equal(resolvePlatformFeePercent(''), DEFAULT_PLATFORM_FEE_PERCENT);
    // Guards against an admin setting 300 and silently eating the whole deal.
    assert.equal(resolvePlatformFeePercent(300), 1);
    assert.equal(resolvePlatformFeePercent(NaN), DEFAULT_PLATFORM_FEE_PERCENT);
});

test('resolvePlatformFeePercent: fallback is overridable per call', () => {
    assert.equal(resolvePlatformFeePercent(null, 0.2), 0.2);
    assert.equal(resolvePlatformFeePercent('', 0.05), 0.05);
});

test('roundMoney: removes float drift and rejects non-numbers', () => {
    assert.equal(roundMoney(1000 * 0.1), 100);
    assert.equal(roundMoney(0.1 + 0.2), 0.3);
    assert.equal(roundMoney(19.999), 20);
    assert.equal(roundMoney(19.994), 19.99);
    assert.equal(roundMoney(NaN), 0);
    assert.equal(roundMoney(undefined), 0);
    assert.equal(roundMoney(Infinity), 0);
    assert.equal(roundMoney(-5.005), -5.01, 'rounds half away from zero, symmetrically');
});

// --------------------------------------------------------------------------------------
// 2. The core split: gross -> fee + net
// --------------------------------------------------------------------------------------

test('computeFeeSplit: 10% of 1000 is exactly 100 fee / 900 net', () => {
    const r = computeFeeSplit(1000, RATE);
    assert.equal(r.gross, 1000);
    assert.equal(r.fee, 100);
    assert.equal(r.net, 900);
    assert.equal(r.fee + r.net, r.gross, 'fee + net must reconstruct gross exactly');
});

test('computeFeeSplit: invariant fee + net === gross holds across many amounts and rates', () => {
    const amounts = [0, 1, 7.5, 99.99, 100, 333, 1000, 4999.99, 123456.78, 1e7];
    const rates = [0, 0.01, 0.075, 0.1, 0.15, 0.185, 0.25, 0.5, 1];
    for (const gross of amounts) {
        for (const rate of rates) {
            const { fee, net } = computeFeeSplit(gross, rate);
            assert.equal(
                roundMoney(fee + net),
                roundMoney(gross),
                `fee+net mismatch for gross=${gross} rate=${rate}`
            );
            assert.ok(fee >= 0, `negative fee for gross=${gross} rate=${rate}`);
            assert.ok(net >= 0, `negative net for gross=${gross} rate=${rate}`);
            assert.ok(fee <= roundMoney(gross), `fee exceeds gross for gross=${gross} rate=${rate}`);
        }
    }
});

test('computeFeeSplit: 0% and 100% rates are handled', () => {
    assert.deepEqual(pick(computeFeeSplit(500, 0)), { gross: 500, fee: 0, net: 500 });
    assert.deepEqual(pick(computeFeeSplit(500, 1)), { gross: 500, fee: 500, net: 0 });
});

test('computeFeeSplit: zero and negative gross produce zero, never a credit', () => {
    for (const gross of [0, -100, -0.01]) {
        const r = computeFeeSplit(gross, RATE);
        assert.equal(r.gross, 0);
        assert.equal(r.fee, 0);
        assert.equal(r.net, 0);
    }
});

test('computeFeeSplit: no rounding drift on the classic 0.1 case', () => {
    assert.equal(computeFeeSplit(1000, 0.1).fee, 100, 'must be 100, not 100.00000000000001');
    assert.equal(computeFeeSplit(70, 0.1).fee, 7);
    assert.equal(computeFeeSplit(3 * 999, 0.1).net, 2697.3);
});

// --------------------------------------------------------------------------------------
// 3. Recorded fee vs. live setting
// --------------------------------------------------------------------------------------

test('sumRecordedPlatformFee: only sums platform_fee rows', () => {
    assert.equal(sumRecordedPlatformFee([
        { note: 'platform_fee', amount: 100 },
        { note: 'Payment released (50%)', amount: 450 },
        { note: 'platform_fee', amount: 25 },
        { note: null, amount: 999 },
    ]), 125);
    assert.equal(sumRecordedPlatformFee([]), 0);
    assert.equal(sumRecordedPlatformFee(null), 0);
    assert.equal(sumRecordedPlatformFee(undefined), 0);
    assert.equal(sumRecordedPlatformFee([{ note: 'platform_fee', amount: null }]), 0);
});

test('sumReleasedToVendor: excludes the platform fee row from seller earnings', () => {
    assert.equal(sumReleasedToVendor([
        { note: 'platform_fee', amount: 100 },
        { note: 'Payment released (50%)', amount: 450 },
        { note: 'Final release upon buyer confirmation', amount: 450 },
    ]), 900);
    assert.equal(sumReleasedToVendor([]), 0);
});

test('resolveDealPlatformFee: recorded fee always beats the live setting', () => {
    // The whole point: admin raises the fee from 10% to 25% after the deal was paid.
    assert.equal(
        resolveDealPlatformFee({ grossAmount: 1000, recordedFee: 100, platformFeePercent: 0.25, paymentStatus: 'paid' }),
        100,
        'a settled deal must keep the fee it was charged'
    );
});

test('resolveDealPlatformFee: legacy paid deals fall back to the live setting', () => {
    assert.equal(
        resolveDealPlatformFee({ grossAmount: 1000, recordedFee: 0, platformFeePercent: 0.25, paymentStatus: 'paid' }),
        250
    );
    assert.equal(
        resolveDealPlatformFee({ grossAmount: 1000, recordedFee: null, platformFeePercent: 0.25, paymentStatus: 'paid' }),
        250
    );
});

test('resolveDealPlatformFee: unpaid deals are never charged a fee', () => {
    for (const status of ['pending', 'failed', 'cancelled', undefined, '']) {
        assert.equal(
            resolveDealPlatformFee({ grossAmount: 1000, recordedFee: 0, platformFeePercent: 0.25, paymentStatus: status }),
            0,
            `unpaid deal (${status}) must not accrue a fee`
        );
    }
});

test('resolveDealPlatformFee: a legitimately zero fee setting is respected', () => {
    assert.equal(
        resolveDealPlatformFee({ grossAmount: 1000, recordedFee: 0, platformFeePercent: 0, paymentStatus: 'paid' }),
        0
    );
});

// --------------------------------------------------------------------------------------
// 4. Vendor net / release math
// --------------------------------------------------------------------------------------

test('computeVendorNet: vendor can never receive more than gross minus fee', () => {
    assert.equal(computeVendorNet({ grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, ...paid }), 900);
    assert.equal(computeVendorNet({ grossAmount: 1000, recordedFee: 0, platformFeePercent: 0.15, ...paid }), 850);
    assert.equal(computeVendorNet({ grossAmount: 1000, recordedFee: 100, platformFeePercent: 1, ...paid }), 900);
});

test('computePartialRelease: partial releases sum to exactly the net', () => {
    const deal = { grossAmount: 10000, recordedFee: 1000, platformFeePercent: RATE, ...paid };
    const steps = [25, 25, 50];
    let released = 0;
    for (const percent of steps) {
        const amount = computePartialRelease({ ...deal, percent });
        released = roundMoney(released + amount);
    }
    assert.equal(released, 9000, 'total released must equal gross - fee');
    assert.equal(computePartialRelease({ ...deal, percent: 100 }), 9000);
});

test('computePartialRelease: awkward percents do not leak money', () => {
    const deal = { grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, ...paid };
    // 33% + 33% + 34% of 900 = 270 + 270 + 306 = 846... remainder is retained by platform.
    const a = computePartialRelease({ ...deal, percent: 33 });
    const b = computePartialRelease({ ...deal, percent: 33 });
    const c = computePartialRelease({ ...deal, percent: 34 });
    assert.equal(a, 297);
    assert.equal(b, 297);
    assert.equal(c, 306);
    assert.equal(roundMoney(a + b + c), 900);
    for (const part of [a, b, c]) {
        assert.ok(part <= 900, 'a single release must never exceed the net');
    }
});

test('computePartialRelease: non-positive and garbage percents release nothing', () => {
    const deal = { grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, ...paid };
    for (const percent of [0, -10, NaN, undefined, null, 'abc']) {
        assert.equal(computePartialRelease({ ...deal, percent }), 0);
    }
});

test('computePartialRelease: 100% release equals the full net even with a huge percent', () => {
    const deal = { grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, ...paid };
    assert.equal(computePartialRelease({ ...deal, percent: 100 }), 900);
    assert.equal(computePartialRelease({ ...deal, percent: 150 }), 900, 'clamped to the net');
});

test('computePartialRelease: fee is deducted once, not per release', () => {
    // Regression: naive per-release math would compute (1000*0.25)*0.25 and drift.
    const deal = { grossAmount: 1000, recordedFee: 0, platformFeePercent: 0.25, ...paid };
    const half = computePartialRelease({ ...deal, percent: 50 });
    assert.equal(half, 375, '50% of 750 net = 375, not 500*0.9');
    const rest = computePartialRelease({ ...deal, percent: 50 });
    assert.equal(roundMoney(half + rest), 750);
});

// --------------------------------------------------------------------------------------
// 5. Refunds
// --------------------------------------------------------------------------------------

test('computeCancelRefund: full cancel keeps only the platform fee', () => {
    assert.equal(
        computeCancelRefund({ grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, ...paid, releasedPercent: 0 }),
        900
    );
});

test('computeCancelRefund: partial release refunds only the unreleased net', () => {
    // 1000 gross, 100 fee, 900 net. 60% released => vendor has 540, client gets 360.
    const r = computeCancelRefund({ grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, ...paid, releasedPercent: 60 });
    assert.equal(r, 360);
});

test('computeCancelRefund: never refunds more than the net', () => {
    for (const releasedPercent of [0, 33.3, 50, 99.99, 100, 150, -5, NaN]) {
        const r = computeCancelRefund({ grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, ...paid, releasedPercent });
        assert.ok(r >= 0, `negative refund at releasedPercent=${releasedPercent}`);
        assert.ok(r <= 900, `refund exceeds net at releasedPercent=${releasedPercent}`);
    }
    assert.equal(computeCancelRefund({ grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, ...paid, releasedPercent: 100 }), 0);
});

test('computeCancelRefund: vendor payout + client refund + fee === gross', () => {
    const gross = 4999.99, fee = 499.999;
    const recordedFee = roundMoney(fee);
    for (const releasedPercent of [0, 10, 45, 75, 100]) {
        const refund = computeCancelRefund({ grossAmount: gross, recordedFee, platformFeePercent: RATE, ...paid, releasedPercent });
        const vendorGot = computePartialRelease({ grossAmount: gross, recordedFee, platformFeePercent: RATE, ...paid, percent: releasedPercent });
        const platformKept = roundMoney(gross - refund - vendorGot);
        assert.equal(roundMoney(refund + vendorGot + platformKept), roundMoney(gross));
        assert.ok(platformKept >= 0, 'platform can never pay out from a cancel');
        assert.ok(platformKept <= recordedFee + 0.01, 'platform keeps at most its fee');
    }
});

test('computeReturnRefund: keeps the fee and charges return shipping to the client', () => {
    assert.equal(
        computeReturnRefund({ paidAmount: 1000, grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, returnShippingFee: 150 }),
        750,
        '1000 - 100 fee - 150 return shipping'
    );
});

test('computeReturnRefund: falls back to the live fee when none was recorded', () => {
    assert.equal(
        computeReturnRefund({ paidAmount: 1000, grossAmount: 1000, recordedFee: 0, platformFeePercent: 0.2, returnShippingFee: 0 }),
        800
    );
});

test('computeReturnRefund: never goes negative when shipping exceeds the deal value', () => {
    assert.equal(
        computeReturnRefund({ paidAmount: 100, grossAmount: 100, recordedFee: 10, platformFeePercent: RATE, returnShippingFee: 150 }),
        0
    );
    assert.equal(
        computeReturnRefund({ paidAmount: 0, grossAmount: 0, recordedFee: 0, platformFeePercent: RATE, returnShippingFee: DEFAULT_RETURN_SHIPPING_FEE }),
        0
    );
});

test('computeReturnRefund: uses paidAmount, not totalAmount', () => {
    // A discounted/partial payment must refund what was actually charged.
    assert.equal(
        computeReturnRefund({ paidAmount: 800, grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, returnShippingFee: 0 }),
        700
    );
});

test('computeReturnRefund: the platform never refunds more than it collected', () => {
    const r = computeReturnRefund({ paidAmount: 1000, grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, returnShippingFee: 0 });
    assert.ok(r <= 1000);
    assert.ok(r >= 0);
});

// --------------------------------------------------------------------------------------
// 6. Seller dashboard figures
// --------------------------------------------------------------------------------------

test('computeSellerPayout: uses recorded release transactions when present', () => {
    assert.equal(
        computeSellerPayout({
            grossAmount: 1000, recordedFee: 100, platformFeePercent: 0.25, ...paid, releasedPercent: 100,
            transactions: [{ note: 'platform_fee', amount: 100 }, { note: 'Payment released (100%)', amount: 900 }],
        }),
        900
    );
});

test('computeSellerPayout: a 40%-released deal is not reported as fully paid out', () => {
    // Regression: the old formula ignored releasedPercent entirely and reported
    // the full net for every completed deal.
    assert.equal(
        computeSellerPayout({ grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, ...paid, releasedPercent: 40 }),
        360
    );
    assert.equal(
        computeSellerPayout({ grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, ...paid, releasedPercent: 0 }),
        0
    );
});

test('computeSellerPayout: honours the legacy releasedAmount column', () => {
    assert.equal(
        computeSellerPayout({ grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, ...paid, releasedPercent: 100, releasedAmount: 900 }),
        900
    );
    // releasedAmount of 0 must not shadow the formula.
    assert.equal(
        computeSellerPayout({ grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, ...paid, releasedPercent: 100, releasedAmount: 0 }),
        900
    );
    assert.equal(
        computeSellerPayout({ grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, ...paid, releasedPercent: 0, releasedAmount: null }),
        0
    );
});

test('computeSellerPayout: an auto-released deal reports net, not gross', () => {
    assert.equal(
        computeSellerPayout({ grossAmount: 2500, recordedFee: 250, platformFeePercent: RATE, ...paid, releasedPercent: 100, releasedAmount: 2250 }),
        2250
    );
});

test('computeSellerFeeLine: reports the fee actually charged, not the current rate', () => {
    const line = computeSellerFeeLine({
        grossAmount: 1000, recordedFee: 100, platformFeePercent: 0.25, ...paid,
        transactions: [{ note: 'platform_fee', amount: 100 }],
    });
    assert.deepEqual(line, { gross: 1000, fee: 100, net: 900 });
    assert.equal(roundMoney(line.fee + line.net), line.gross);
});

test('computeSellerFeeLine: falls back to the live rate when no fee was recorded', () => {
    const line = computeSellerFeeLine({ grossAmount: 1000, recordedFee: 0, platformFeePercent: 0.2, ...paid, transactions: [] });
    assert.deepEqual(line, { gross: 1000, fee: 200, net: 800 });
});

// --------------------------------------------------------------------------------------
// 7. Split (team) deals
// --------------------------------------------------------------------------------------

test('computeSplitPayouts: splits sum to the released net with no lost paise', () => {
    const payouts = computeSplitPayouts(900, [
        { userId: 1, percent: 33.33 },
        { userId: 2, percent: 33.33 },
        { userId: 3, percent: 33.34 },
    ]);
    const total = roundMoney(payouts.reduce((s, p) => s + p.amount, 0));
    assert.equal(total, 900, 'split payouts must reconstruct the released net exactly');
    assert.equal(payouts.length, 3);
});

test('computeSplitPayouts: the last member absorbs rounding drift', () => {
    const payouts = computeSplitPayouts(100, [
        { userId: 1, percent: 50 },
        { userId: 2, percent: 50 },
    ]);
    assert.deepEqual(payouts.map((p) => p.amount), [50, 50]);

    const thirds = computeSplitPayouts(100, [
        { userId: 1, percent: 33.33 },
        { userId: 2, percent: 33.33 },
        { userId: 3, percent: 33.34 },
    ]);
    assert.equal(roundMoney(thirds.reduce((s, p) => s + p.amount, 0)), 100);
});

test('computeSplitPayouts: the platform fee is never redistributed to the team', () => {
    const net = computeVendorNet({ grossAmount: 1000, recordedFee: 100, platformFeePercent: RATE, ...paid });
    const payouts = computeSplitPayouts(net, [
        { userId: 1, percent: 50 },
        { userId: 2, percent: 50 },
    ]);
    const total = roundMoney(payouts.reduce((s, p) => s + p.amount, 0));
    assert.equal(total, 900);
    assert.ok(total < 1000, 'team combined earnings must stay below gross');
});

test('computeSplitPayouts: ignores zero/negative members and bad config', () => {
    assert.deepEqual(computeSplitPayouts(900, [{ userId: 1, percent: 0 }, { userId: 2, percent: -10 }]), []);
    assert.deepEqual(computeSplitPayouts(900, null), []);
    assert.deepEqual(computeSplitPayouts(900, []), []);
    const payouts = computeSplitPayouts(900, [{ userId: 1, percent: 100 }, { userId: 2, percent: 0 }]);
    assert.equal(roundMoney(payouts.reduce((s, p) => s + p.amount, 0)), 900);
});

test('computeSplitPayouts: full payout to the final member when earlier members are skipped', () => {
    const payouts = computeSplitPayouts(900, [
        { userId: 1, percent: 0 },
        { userId: 2, percent: 100 },
    ]);
    assert.equal(roundMoney(payouts.reduce((s, p) => s + p.amount, 0)), 900);
});

// --------------------------------------------------------------------------------------
// 8. End-to-end money conservation across the full deal lifecycle
// --------------------------------------------------------------------------------------

test('lifecycle: create -> release 50% -> confirm -> seller receives exactly net', () => {
    const gross = 20000, recordedFee = 2000;
    const net = computeVendorNet({ grossAmount: gross, recordedFee, platformFeePercent: RATE, ...paid });
    assert.equal(net, 18000);

    const first = computePartialRelease({ grossAmount: gross, recordedFee, platformFeePercent: RATE, ...paid, percent: 50 });
    assert.equal(first, 9000);

    const rest = computePartialRelease({ grossAmount: gross, recordedFee, platformFeePercent: RATE, ...paid, percent: 50 });
    assert.equal(rest, 9000);

    assert.equal(roundMoney(first + rest), net, 'vendor total must equal net exactly');
    assert.equal(roundMoney(gross - (first + rest)), recordedFee, 'platform retains exactly its fee');
});

test('lifecycle: fee rate change mid-deal does not retroactively alter settlement', () => {
    const gross = 10000;
    const atCreation = computeFeeSplit(gross, 0.10);
    assert.equal(atCreation.fee, 1000);

    // Admin raises the rate to 20% after the client paid.
    const atRelease = computePartialRelease({ grossAmount: gross, recordedFee: atCreation.fee, platformFeePercent: 0.20, ...paid, percent: 100 });
    assert.equal(atRelease, 9000, 'must settle on the fee recorded at payment time');

    // A legacy deal with no recorded fee does follow the new rate.
    const legacy = computePartialRelease({ grossAmount: gross, recordedFee: 0, platformFeePercent: 0.20, ...paid, percent: 100 });
    assert.equal(legacy, 8000);
});

test('lifecycle: cancel after partial release leaves the platform with at most its fee', () => {
    const gross = 10000, recordedFee = 1000;
    const released = computePartialRelease({ grossAmount: gross, recordedFee, platformFeePercent: RATE, ...paid, percent: 60 });
    const refund = computeCancelRefund({ grossAmount: gross, recordedFee, platformFeePercent: RATE, ...paid, releasedPercent: 60 });
    assert.equal(released, 5400);
    assert.equal(refund, 3600);
    assert.equal(roundMoney(released + refund), 9000);
    assert.equal(roundMoney(gross - released - refund), recordedFee);
});

test('lifecycle: platform revenue equals the sum of fees across many deals', () => {
    const deals = [100, 250.5, 1000, 7777.77, 12345, 99999.99];
    let platformRevenue = 0;
    for (const gross of deals) {
        const { fee } = computeFeeSplit(gross, RATE);
        platformRevenue = roundMoney(platformRevenue + fee);
    }
    assert.equal(platformRevenue, roundMoney(deals.reduce((s, g) => s + computeFeeSplit(g, RATE).fee, 0)));
    assert.ok(platformRevenue > 0);
});

test('lifecycle: zero-fee promotion is honoured end to end', () => {
    const { fee, net } = computeFeeSplit(5000, 0);
    assert.equal(fee, 0);
    assert.equal(net, 5000);
    assert.equal(computePartialRelease({ grossAmount: 5000, recordedFee: 0, platformFeePercent: 0, ...paid, percent: 100 }), 5000);
    assert.equal(computeCancelRefund({ grossAmount: 5000, recordedFee: 0, platformFeePercent: 0, ...paid, releasedPercent: 0 }), 5000);
});

function pick({ gross, fee, net }) {
    return { gross, fee, net };
}
