/**
 * Single source of truth for platform fee / commission math.
 *
 * Money model used across the platform:
 *   gross  = what the client is charged (EscrowDeal.totalAmount / paidAmount)
 *   fee    = platform commission, recorded once at payment time as an
 *            EscrowTransaction with note === 'platform_fee'
 *   net    = gross - fee, i.e. the only amount that can ever reach the vendor
 *
 * The recorded fee is always authoritative. The live platform_fee_percent
 * setting is only a fallback for legacy deals that predate fee recording,
 * so changing the setting must never retroactively alter a settled deal.
 */

import { roundMoney } from './money.js';

export const DEFAULT_PLATFORM_FEE_PERCENT = 0.10;
export const PLATFORM_FEE_NOTE = 'platform_fee';
export const DEFAULT_RETURN_SHIPPING_FEE = 150;

// Single rounding rule for the whole money layer, so fee math and wallet math
// can never disagree about what a rupee is worth.
export { roundMoney } from './money.js';

/**
 * Parse a platform fee percentage safely.
 * Accepts "0.1", "0.10", 0.1, 10 (interpreted as 10% -> 0.1) and clamps to [0, 1].
 */
export function resolvePlatformFeePercent(value, fallback = DEFAULT_PLATFORM_FEE_PERCENT) {
    if (value === null || value === undefined || value === '') return fallback;
    let pct = typeof value === 'number' ? value : parseFloat(String(value).trim());
    if (!Number.isFinite(pct)) return fallback;
    // Admins store the setting as a fraction ("0.10"), but a value like 10 or 15
    // clearly means 10% / 15%. Anything > 1 is treated as a whole percentage.
    if (pct > 1) pct = pct / 100;
    if (pct < 0) pct = 0;
    if (pct > 1) pct = 1;
    return pct;
}

/** Read the live platform fee percent from SystemSetting. */
export async function getPlatformFeePercent(prisma) {
    try {
        const setting = await prisma.systemSetting.findUnique({ where: { key: 'platform_fee_percent' } });
        if (!setting) return DEFAULT_PLATFORM_FEE_PERCENT;
        return resolvePlatformFeePercent(setting.value);
    } catch {
        return DEFAULT_PLATFORM_FEE_PERCENT;
    }
}

/** Read the live return shipping fee from SystemSetting. */
export async function getReturnShippingFee(prisma) {
    try {
        const setting = await prisma.systemSetting.findUnique({ where: { key: 'return_shipping_fee' } });
        if (!setting) return DEFAULT_RETURN_SHIPPING_FEE;
        const fee = parseFloat(String(setting.value).trim());
        return Number.isFinite(fee) && fee >= 0 ? fee : DEFAULT_RETURN_SHIPPING_FEE;
    } catch {
        return DEFAULT_RETURN_SHIPPING_FEE;
    }
}

/**
 * Split a gross amount into platform fee + vendor net.
 * fee and net are rounded independently so that `fee + net === gross` exactly.
 *
 * Pass `shippingFee` to exclude the courier's charge from the commission base.
 * The vendor still receives gross minus the fee, because the seller pays the
 * courier separately; only the *platform's* cut is reduced.
 */
export function computeFeeSplit(grossAmount, platformFeePercent, { shippingFee = 0 } = {}) {
    const gross = roundMoney(grossAmount);
    const pct = resolvePlatformFeePercent(platformFeePercent);
    if (gross <= 0) return { gross: 0, fee: 0, net: 0, feePercent: pct, shippingFee: 0, commissionable: 0 };
    const base = computeCommissionableBase({ grossAmount: gross, shippingFee });
    const fee = roundMoney(base * pct);
    const net = roundMoney(gross - fee);
    return { gross, fee, net, feePercent: pct, shippingFee: roundMoney(shippingFee), commissionable: base };
}

/** Sum of the platform fee transactions recorded against a deal. */
export function sumRecordedPlatformFee(transactions) {
    if (!Array.isArray(transactions)) return 0;
    return roundMoney(
        transactions
            .filter((tx) => tx && tx.note === PLATFORM_FEE_NOTE)
            .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
    );
}

/**
 * Commissionable base for a deal.
 *
 * The platform must not earn commission on the courier's shipping charge: that
 * cost is billed to the seller by ShipRocket, so taking a cut of it means
 * paying the courier more than the seller collected. Returns gross minus the
 * shipping component, never below zero.
 */
export function computeCommissionableBase({ grossAmount, shippingFee = 0 }) {
    const gross = roundMoney(grossAmount);
    const shipping = roundMoney(shippingFee);
    return roundMoney(Math.max(0, gross - Math.max(0, shipping)));
}

/** Sum of the actual release (payout) transactions recorded against a deal. */
export function sumReleasedToVendor(transactions) {
    if (!Array.isArray(transactions)) return 0;
    return roundMoney(
        transactions
            .filter((tx) => tx && tx.note !== PLATFORM_FEE_NOTE)
            .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
    );
}

/**
 * The fee that should actually be deducted from a deal.
 * Prefers the fee recorded at payment time; falls back to the current setting
 * only for legacy deals that have no recorded fee and are already paid.
 */
export function resolveDealPlatformFee({ grossAmount, recordedFee, platformFeePercent, paymentStatus }) {
    const recorded = roundMoney(recordedFee);
    if (recorded > 0) return recorded;
    if (paymentStatus === 'paid') return computeFeeSplit(grossAmount, platformFeePercent).fee;
    return 0;
}

/** Total that may ever be released to the vendor for a deal. */
export function computeVendorNet({ grossAmount, recordedFee, platformFeePercent, paymentStatus }) {
    const gross = roundMoney(grossAmount);
    const fee = resolveDealPlatformFee({ grossAmount: gross, recordedFee, platformFeePercent, paymentStatus });
    return roundMoney(gross - fee);
}

/**
 * Vendor payout for a partial release.
 * The fee is deducted once, from the full gross, then the requested percent
 * of the net is released — so releasing 25% then 75% totals exactly the net.
 */
export function computePartialRelease({ grossAmount, recordedFee, platformFeePercent, paymentStatus, percent }) {
    const net = computeVendorNet({ grossAmount, recordedFee, platformFeePercent, paymentStatus });
    const p = Number(percent);
    if (!Number.isFinite(p) || p <= 0) return 0;
    if (p >= 100) return net;
    return roundMoney((net * p) / 100);
}

/**
 * Client refund when a deal is cancelled.
 * The platform keeps its fee on the *unreleased* portion only, so a deal that
 * was 50% released refunds half the net, not the whole gross minus the fee.
 */
export function computeCancelRefund({ grossAmount, recordedFee, platformFeePercent, paymentStatus, releasedPercent }) {
    const net = computeVendorNet({ grossAmount, recordedFee, platformFeePercent, paymentStatus });
    const released = Number(releasedPercent);
    const remaining = Math.max(0, Math.min(1, 1 - (Number.isFinite(released) ? released : 0) / 100));
    return roundMoney(net * remaining);
}

/**
 * Client refund after a return/RMA is approved.
 * The platform fee is retained, and the return shipping cost is borne by the client.
 */
export function computeReturnRefund({ paidAmount, grossAmount, recordedFee, platformFeePercent, returnShippingFee }) {
    const paid = roundMoney(Number.isFinite(Number(paidAmount)) ? Number(paidAmount) : 0);
    const gross = roundMoney(Number.isFinite(Number(grossAmount)) ? Number(grossAmount) : paid);
    const fee = resolveDealPlatformFee({ grossAmount: gross, recordedFee, platformFeePercent, paymentStatus: 'paid' });
    const shipping = Number.isFinite(Number(returnShippingFee)) ? Number(returnShippingFee) : 0;
    return roundMoney(Math.max(0, paid - fee - shipping));
}

/**
 * What the seller actually earned on a deal.
 * Recorded release transactions are the source of truth; the formula is only a
 * fallback for deals released before transactions were written.
 */
export function computeSellerPayout({ grossAmount, recordedFee, platformFeePercent, paymentStatus, releasedPercent, releasedAmount, transactions }) {
    const fromTx = sumReleasedToVendor(transactions);
    if (fromTx > 0) return fromTx;

    if (releasedAmount !== null && releasedAmount !== undefined) {
        const amt = roundMoney(releasedAmount);
        if (amt > 0) return amt;
    }

    const net = computeVendorNet({ grossAmount, recordedFee, platformFeePercent, paymentStatus });
    const released = Number(releasedPercent);
    if (!Number.isFinite(released) || released <= 0) return 0;
    if (released >= 100) return net;
    return roundMoney((net * released) / 100);
}

/** The platform fee line to show in a seller's sales history. */
export function computeSellerFeeLine({ grossAmount, recordedFee, platformFeePercent, paymentStatus, transactions }) {
    const gross = roundMoney(grossAmount);
    const recorded = sumRecordedPlatformFee(transactions);
    const fee = recorded > 0
        ? recorded
        : resolveDealPlatformFee({ grossAmount: gross, recordedFee, platformFeePercent, paymentStatus });
    return { gross, fee, net: roundMoney(gross - fee) };
}

/** Split a single release across the members of a split (team) deal. */
export function computeSplitPayouts(totalNet, splitConfig) {
    if (!Array.isArray(splitConfig) || splitConfig.length === 0) return [];
    let allocated = 0;
    const payouts = [];
    splitConfig.forEach((split, index) => {
        const pct = Number(split?.percent);
        if (!Number.isFinite(pct) || pct <= 0) return;
        // The last entry absorbs rounding drift so the splits always sum to totalNet.
        const isLast = index === splitConfig.length - 1;
        const amount = isLast ? roundMoney(totalNet - allocated) : roundMoney((totalNet * pct) / 100);
        allocated = roundMoney(allocated + amount);
        if (amount > 0) payouts.push({ userId: split.userId, percent: pct, amount });
    });
    return payouts;
}
