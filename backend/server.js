import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';

// Resolve __dirname for ESM and load .env from the project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (one level up from backend/)
// PM2 runs from backend/ directory, so we need to go up one level
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import messageRoutes from './routes/messages.js';
import adminRoutes from './routes/admin.js';
import escrowRoutes from './routes/escrow.js';
import moderationRoutes from './routes/moderation.js';
import verificationRoutes from './routes/verification.js';
import paymentRoutes from './routes/payments.js';
import walletRoutes from './routes/wallet.js';
import webhookRoutes from './routes/webhooks.js';
import notificationRoutes from './routes/notifications.js';
import adsRoutes from './routes/ads.js';
import jobsRoutes from './routes/jobs.js';
import postsRoutes from './routes/posts.js';
import imageGeneratorRoutes from './routes/imageGenerator.js';
import subscriptionRoutes from './routes/subscriptions.js';
import teamsRoutes from './routes/teams.js';
import groupsRoutes from './routes/groups.js';
import communitiesRoutes from './routes/communities.js';
import setupSocket from './socket/chat.js';

const app = express();
const server = createServer(app);

const envAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

// Global Logger (Move to top)
app.use((req, res, next) => {
    if (req.url !== '/api/health') { // Skip health checks to reduce noise
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
});

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8081',
    'http://172.29.224.1:8081',
    'http://192.168.56.1:8080',
    'https://krovaa.com',
    'https://www.krovaa.com',
    'http://krovaa.com',
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL?.toLowerCase(),
    ...envAllowedOrigins
].filter(Boolean);

// Middleware
app.use(compression());
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps/curl)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error(`🚫 CORS blocked for origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
}));

// Security headers (Helmet)
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://api.razorpay.com", "wss:", "ws:"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "https:"],
            frameSrc: ["'self'", "https://checkout.razorpay.com"],
        },
    },
}));

// Body size limits — prevent DoS via oversized payloads
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Webhooks (no auth needed)
app.use('/webhooks', webhookRoutes);

// Socket.IO setup with shared server
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    },
});

// API Routes
app.use(express.static(path.join(__dirname, '../frontend/dist'), {
    maxAge: '1y',
    immutable: true
}));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/image-generator', imageGeneratorRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/communities', communitiesRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
});

// Health check (with DB connectivity test)
app.get('/api/health', async (req, res) => {
    try {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        await prisma.$queryRaw`SELECT 1`;
        await prisma.$disconnect();
        res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('Health check DB error:', err.message);
        res.status(500).json({ status: 'ok', db: 'error', dbError: err.message, timestamp: new Date().toISOString() });
    }
});

// Socket.IO
setupSocket(io);
app.set('io', io);

// Start server
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '::';
server.listen(PORT, HOST, () => {
    console.log(`
  ╔══════════════════════════════════════╗
  ║   🚀 Krovaa API Server Running      ║
  ║   Port: ${PORT}                      ║
  ║   Host: ${HOST}                    ║
  ╚══════════════════════════════════════╝
  `);
});
