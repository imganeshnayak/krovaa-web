/**
 * Wallet balance mutations.
 *
 * Every balance change in the system goes through `applyWalletDelta` so that
 * sub-paise float residue can never accumulate on a user's wallet.
 *
 * Why this exists: `walletBalance` is a Postgres Float. Prisma's `increment` is
 * atomic but does float addition, so repeated credits and debits leave values
 * like 20081.924 instead of 20081.92. That residue is invisible in the UI but
 * makes the balance impossible to withdraw exactly.
 *
 * Why it is still atomic: we keep Prisma's atomic `increment` and only issue a
 * second UPDATE when the result has drifted. Reading the balance first and
 * writing an absolute value would reintroduce a lost-update race under
 * concurrent transfers.
 */

import { roundMoney, toPaise } from './money.js';
import { toAmount } from './decimalJson.js';

/** True when the stored value is not exactly on a paise boundary. */
export function hasDrift(value) {
    const n = toAmount(value);
    if (!Number.isFinite(n)) return false;
    // Exact comparison, not a tolerance: 4.599999999999997 must be caught.
    return roundMoney(n) !== n;
}

/**
 * Apply a signed delta to a user's wallet balance, guaranteeing the stored
 * value lands exactly on a paise boundary and never falls below the floor.
 *
 * @param client  Prisma client or transaction client.
 * @param userId  User whose wallet is being changed.
 * @param delta   Positive to credit, negative to debit.
 * @param opts.floor  Lowest permitted balance (default 0).
 * @returns the updated user row, plus `delta` and `clamped` metadata.
 */
export async function applyWalletDelta(client, userId, delta, { floor = 0 } = {}) {
    const deltaPaise = toPaise(delta);
    if (deltaPaise === 0) {
        const unchanged = await client.user.findUnique({ where: { id: userId } });
        if (!unchanged) throw new Error(`User ${userId} not found`);
        return { ...unchanged, delta: 0, clamped: false };
    }

    // Atomic in the database, so concurrent mutations cannot lose an update.
    let updated = await client.user.update({
        where: { id: userId },
        data: { walletBalance: { increment: delta } },
    });

    // Always normalise: rounding and clamping are not conditional on drift
    // detection, because a clean-looking value can still violate the floor.
    const floorPaise = toPaise(floor);
    const currentPaise = toPaise(updated.walletBalance);
    const clamped = currentPaise < floorPaise;
    const targetPaise = clamped ? floorPaise : currentPaise;
    const target = targetPaise / 100;

    // Compare numerically: the column is Decimal, so a `target !== balance`
    // identity check would always differ and double the write load.
    if (toAmount(updated.walletBalance) !== target) {
        updated = await client.user.update({
            where: { id: userId },
            data: { walletBalance: target },
        });
    }

    return { ...updated, delta: deltaPaise / 100, clamped };
}

/**
 * Set a wallet balance to an exact amount, rounded to paise.
 * Used when the caller already knows the intended absolute balance.
 */
export async function setWalletBalance(client, userId, amount) {
    return client.user.update({
        where: { id: userId },
        data: { walletBalance: roundMoney(amount) },
    });
}

/** Read a user's current balance, rounded to paise, as a plain number. */
export async function getWalletBalance(client, userId) {
    const user = await client.user.findUnique({
        where: { id: userId },
        select: { walletBalance: true },
    });
    if (!user) throw new Error(`User ${userId} not found`);
    return toAmount(user.walletBalance);
}
