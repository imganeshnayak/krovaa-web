/**
 * HTTP test harness: boots the REAL express routers and calls them over HTTP.
 *
 * Unlike the other integration tests, which replicate handler logic against the
 * database, this drives the actual route handlers in escrow.js, wallet.js,
 * payments.js and admin.js. That is the only way to catch a regression in the
 * handlers themselves.
 *
 * The app is assembled exactly as server.js does - same routers, same auth
 * middleware, same cookie parsing - but bound to an ephemeral port on the
 * throwaway krovaa_test database.
 *
 * A fake Socket.io instance is registered so `req.app.get('io')` resolves and
 * the notification/emission branches execute instead of being skipped.
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { useTestDatabase } from './testDb.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..', '..');

// Must happen before any router is imported, because each router constructs its
// own PrismaClient at module load and resolves DATABASE_URL at that moment.
useTestDatabase();

// The auth middleware signs with the app's real JWT secret, so the test tokens
// have to be signed with the same one.
const envText = fs.readFileSync(path.join(backendRoot, '.env'), 'utf8');
const jwtSecret = (envText.match(/^JWT_SECRET=(.*)$/m) || [])[1]?.trim();
if (!jwtSecret) {
    throw new Error('JWT_SECRET missing from backend/.env - cannot authenticate test requests');
}

/** A no-op Socket.io stand-in that records emissions. */
function createFakeIo() {
    const emitted = [];
    const makeRoom = () => ({
        to() { return this; },
        emit(event, payload) { emitted.push({ event, payload }); return true; },
    });
    return {
        emitted,
        to: makeRoom,
        in: makeRoom,
        emit(event, payload) { emitted.push({ event, payload }); return true; },
    };
}

/**
 * Build and start the test app. Returns helpers for making authenticated
 * requests, plus the fake io for assertions.
 */
export async function startTestApp() {
    const express = (await import('express')).default;
    const cookieParser = (await import('cookie-parser')).default;
    const { default: jwt } = await import('jsonwebtoken');

    // Real routers, exactly as the app wires them.
    const escrowRoutes = (await import('../../routes/escrow.js')).default;
    const walletRoutes = (await import('../../routes/wallet.js')).default;
    const paymentsRoutes = (await import('../../routes/payments.js')).default;
    const sellerStatsRoutes = (await import('../../routes/sellerStats.js')).default;
    const adminRoutes = (await import('../../routes/admin.js')).default;
    const dealsRoutes = (await import('../../routes/deals.js')).default;
    const shippingRoutes = (await import('../../routes/shipping.js')).default;
    const wishlistRoutes = (await import('../../routes/wishlist.js')).default;
    const webhookRoutes = (await import('../../routes/webhooks.js')).default;

    const app = express();
    const io = createFakeIo();
    app.set('io', io);
    app.use(express.json());
    app.use(cookieParser());

    app.use('/api/escrow', escrowRoutes);
    app.use('/api/wallet', walletRoutes);
    app.use('/api/payments', paymentsRoutes);
    app.use('/api/seller/stats', sellerStatsRoutes);
    app.use('/api/deals', dealsRoutes);
    app.use('/api/shipping', shippingRoutes);
    app.use('/api/wishlist', wishlistRoutes);
    app.use('/api/webhooks', webhookRoutes);
    app.use('/api/admin', adminRoutes);

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    /** Mint a token the auth middleware will accept (fast path: role + status). */
    function tokenFor(user, extra = {}) {
        return jwt.sign(
            {
                id: user.id,
                userId: user.id,
                username: user.username,
                role: user.role || 'client',
                status: user.status || 'active',
                permissions: user.role === 'admin' ? ['*'] : [],
                ...extra,
            },
            jwtSecret,
            { expiresIn: '30m' }
        );
    }

    /** Perform an HTTP request against the test app. */
    async function request(method, urlPath, { token, body, headers = {} } = {}) {
        const payload = body === undefined ? null : JSON.stringify(body);
        const res = await fetch(`http://127.0.0.1:${port}${urlPath}`, {
            method,
            headers: {
                ...(payload ? { 'Content-Type': 'application/json' } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...headers,
            },
            body: payload ?? undefined,
        });
        const text = await res.text();
        let json = null;
        try {
            json = text ? JSON.parse(text) : null;
        } catch {
            json = null;
        }
        return { status: res.status, body: json, text };
    }

    return {
        port,
        io,
        tokenFor,
        request,
        get: (p, opts) => request('GET', p, opts),
        post: (p, opts) => request('POST', p, opts),
        put: (p, opts) => request('PUT', p, opts),
        async close() {
            await new Promise((resolve) => server.close(resolve));
        },
    };
}
