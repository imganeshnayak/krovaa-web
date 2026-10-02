/**
 * Exact-money JSON serialization.
 *
 * Money columns are Postgres Decimal(18,2) so balances are stored and summed
 * exactly, with no float drift. Prisma returns those as Prisma.Decimal objects,
 * whose default `toJSON` emits a STRING ("20081.92") rather than a number.
 *
 * That would silently break the frontend: `"20081.92".toFixed(2)` throws, and
 * every comparison in the wallet UI would operate on a string.
 *
 * This module makes Decimal serialize as a JSON number, so the HTTP contract is
 * unchanged from the old Float behaviour while the storage becomes exact.
 *
 * It must be imported once, before any request is handled. server.js does that.
 */

import { Prisma } from '@prisma/client';

let installed = false;

/**
 * Convert a Prisma Decimal (or anything numeric) to a plain JS number.
 * Use this at any site that formats money, since Decimal's own toFixed()
 * returns a string.
 */
export function toAmount(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }
    // Prisma.Decimal and other numeric wrapper objects.
    if (typeof value.toNumber === 'function') {
        const n = value.toNumber();
        return Number.isFinite(n) ? n : 0;
    }
    if (typeof value.valueOf === 'function') {
        const n = Number(value.valueOf());
        return Number.isFinite(n) ? n : 0;
    }
    return 0;
}

/**
 * Recursively replace every Decimal in a payload with a plain number.
 * Use for responses built by hand where a global override is not wanted.
 */
export function withPlainNumbers(payload) {
    if (payload === null || payload === undefined) return payload;
    if (Prisma.Decimal.isDecimal(payload)) return toAmount(payload);
    if (Array.isArray(payload)) return payload.map(withPlainNumbers);
    if (payload instanceof Date) return payload;
    if (typeof payload === 'object') {
        const out = {};
        for (const [key, value] of Object.entries(payload)) {
            out[key] = withPlainNumbers(value);
        }
        return out;
    }
    return payload;
}

/**
 * Install the Decimal -> number JSON behaviour process-wide.
 *
 * Overriding toJSON on the prototype guarantees no response site is missed,
 * which matters because a single overlooked Decimal would ship a string to the
 * client and break the wallet UI at runtime.
 */
export function installDecimalJsonSerialization() {
    if (installed) return false;
    Prisma.Decimal.prototype.toJSON = function toJSON() {
        return this.toNumber();
    };
    installed = true;
    return true;
}

export { Prisma };
