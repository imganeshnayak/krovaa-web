/**
 * Webhook signature verification.
 *
 * A delivery webhook is a money trigger: it marks a deal delivered, which makes
 * the 3-day auto-release cron pay the vendor. Anyone able to post a forged
 * payload can therefore trigger a real payout, so verification must fail closed.
 *
 * Scheme: HMAC-SHA256 over the RAW request bytes, keyed with a shared secret,
 * compared against the signature header. Raw bytes matter - re-serialising
 * parsed JSON changes whitespace and key order, so the digest would never match.
 *
 * Two failure modes are handled explicitly:
 *   - No secret configured  -> refuse in production, warn loudly otherwise.
 *   - No signature supplied -> always refuse. A previously-guarded check let
 *     unsigned requests through in non-production, which is exactly the hole
 *     that made forged delivery updates possible.
 */

import crypto from 'crypto';

/**
 * Statuses that mean the parcel was attempted but not delivered.
 *
 * Couriers phrase this many different ways, and new ones appear over time, so
 * matching is done on normalised substrings rather than an exact set. A missing
 * alias would let a failed delivery fall through to the previous status and the
 * buyer would never learn their parcel bounced.
 */
const NDR_STATUSES = [
    'ndr', 'not_delivered', 'undelivered', 'delivery_failed',
    'failed_delivery_attempt', 'address_validation_failed', 'address_invalid',
    'address_incomplete', 'incorrect_address', 'incomplete_address',
    'customer_not_available', 'recipient_not_available', 'buyer_not_available',
    'unattempted', 'rto', 'return_initiated', 'returned',
];

/** True when a ShipRocket status represents a failed delivery attempt. */
export function isNdrStatus(status) {
    if (!status) return false;
    const normalised = String(status).toLowerCase().replace(/[\s/\\-]+/g, '_');
    return NDR_STATUSES.some((s) => normalised === s || normalised.includes(s));
}

/** Compute the expected digest for a raw body. Returns hex and base64 forms. */
export function computeSignatures(rawBody, secret) {
    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ''), 'utf8');
    return {
        hex: crypto.createHmac('sha256', secret).update(body).digest('hex'),
        base64: crypto.createHmac('sha256', secret).update(body).digest('base64'),
    };
}

/** Constant-time string comparison that tolerates differing lengths. */
function safeEqual(a, b) {
    const bufA = Buffer.from(String(a), 'utf8');
    const bufB = Buffer.from(String(b), 'utf8');
    if (bufA.length !== bufB.length) {
        // Still burn a comparison so the failure path is not obviously faster.
        crypto.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify a webhook request.
 *
 * @param {object} opts
 * @param {Buffer|string} opts.rawBody  Exact bytes received.
 * @param {string|undefined} opts.signature  Value of the signature header.
 * @param {string|undefined} opts.secret  Shared secret.
 * @param {string} opts.headerName  Header the signature was read from.
 * @param {boolean} opts.isProduction  Fail closed when unconfigured.
 * @returns {{ok: boolean, reason?: string, warning?: string}}
 */
export function verifyWebhookSignature({ rawBody, signature, secret, headerName = 'signature', isProduction = false }) {
    if (!secret) {
        const warning = `${headerName}: no shared secret configured - webhook cannot be authenticated`;
        if (isProduction) {
            return { ok: false, reason: 'Webhook secret is not configured on the server.' };
        }
        return { ok: true, warning, unverified: true };
    }

    if (!signature) {
        return { ok: false, reason: `Missing ${headerName} header.` };
    }

    const { hex, base64 } = computeSignatures(rawBody, secret);
    // Accept either encoding: providers differ, and rejecting a valid hex
    // signature because it arrived base64 would silently break tracking.
    if (safeEqual(signature, hex) || safeEqual(signature, base64)) {
        return { ok: true };
    }
    return { ok: false, reason: 'Invalid webhook signature.' };
}
