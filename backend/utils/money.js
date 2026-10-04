/**
 * Money helpers for wallet operations.
 *
 * Wallet balances are stored as Postgres `Float` (double precision), so
 * repeated increment/decrement operations leave sub-paise residue. A balance
 * that should be exactly 20081.92 can be stored as 20081.924.
 *
 * The consequence is that a naive `balance < amount` check makes it impossible
 * to withdraw a user's *entire* balance: the UI renders 20081.92, the user
 * types 20081.92, and `20081.924 < 20081.92` evaluates true, so the request is
 * rejected as "Insufficient wallet balance" even though the user has enough.
 *
 * Everything here works in paise (integer cents) to make comparisons exact.
 */

/** Largest sub-paise slack we tolerate before treating amounts as different. */
const PAISE_EPSILON = 0.005;

/** Round to 2 decimal places, symmetric for negatives. */
export function roundMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const sign = n < 0 ? -1 : 1;
    return (sign * Math.round(Math.abs(n) * 100)) / 100;
}

/** Convert to integer paise, for exact comparison. */
export function toPaise(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const sign = n < 0 ? -1 : 1;
    return sign * Math.round(Math.abs(n) * 100);
}

/** Format a number as a clean 2dp money value. */
export function toMoney(value) {
    return roundMoney(value);
}

/**
 * True when `balance` covers `amount`, tolerating sub-paise float residue.
 * This is the check that makes "withdraw everything" always work.
 */
export function hasSufficientBalance(balance, amount) {
    return toPaise(balance) >= toPaise(amount);
}

/** True when the two amounts are equal once paise residue is discarded. */
export function isSameAmount(a, b) {
    return Math.abs(toPaise(a) - toPaise(b)) <= 0;
}

/**
 * Clamp an amount to the available balance, so "withdraw max" can never exceed
 * what the user actually holds. Returns 0 when the balance is negative.
 */
export function clampToBalance(amount, balance) {
    const available = toPaise(balance);
    if (available <= 0) return 0;
    return roundMoney(Math.min(toPaise(amount), available) / 100);
}

/** Remaining balance after a debit, floored at zero. */
export function balanceAfterDebit(balance, amount) {
    const remainingPaise = toPaise(balance) - toPaise(amount);
    if (remainingPaise <= 0) return 0;
    return remainingPaise / 100;
}

/**
 * Validate a user-supplied money amount.
 * Returns { ok: true, amount } or { ok: false, error }.
 */
export function parseMoneyInput(raw, { min = 0, max = null } = {}) {
    if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') {
        return { ok: false, error: 'Please enter a valid amount' };
    }
    // Plain objects and arrays are not amounts, but numeric wrappers such as
    // Prisma.Decimal are: money columns return Decimal, not number.
    if (typeof raw === 'object' && typeof raw.toNumber !== 'function' && typeof raw.valueOf !== 'function') {
        return { ok: false, error: 'Please enter a valid amount' };
    }
    const n = typeof raw === 'string' ? Number(raw.trim()) : Number(raw);
    if (!Number.isFinite(n)) {
        return { ok: false, error: 'Please enter a valid amount' };
    }
    if (n <= 0) {
        return { ok: false, error: 'Amount must be greater than zero' };
    }
    const amount = roundMoney(n);
    if (toPaise(amount) < toPaise(min)) {
        return { ok: false, error: `Minimum payout amount is ₹${roundMoney(min).toLocaleString('en-IN')}` };
    }
    if (max !== null && !hasSufficientBalance(max, amount)) {
        return { ok: false, error: 'Insufficient wallet balance' };
    }
    return { ok: true, amount };
}

export { PAISE_EPSILON };
