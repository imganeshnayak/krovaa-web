import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const prisma = new PrismaClient();

const auth = async (req, res, next) => {
    const authHeader = req.header('Authorization');
    // Support both HttpOnly cookie and fallback to Authorization header
    const token = req.cookies?.token || authHeader?.replace('Bearer ', '');

    if (!token) {
        // Temporary Bypass for Development only if no token provided and explicitly enabled
        // if (process.env.ENABLE_DEV_BYPASS === 'true') {
        //     console.log('No token provided, using dev bypass (User ID: 1)');
        //     req.user = { id: 1, username: 'admin', role: 'admin' };
        //     return next();
        // }
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // CHECK USER STATUS AND PERMISSIONS IN DATABASE
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { status: true, role: true, permissions: true }
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found.' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({
                error: `Account ${user.status}.`,
                status: user.status
            });
        }

        // Attach DB info to req.user
        req.user = {
            ...decoded,
            role: user.role,
            permissions: user.permissions || []
        };
        next();
    } catch (err) {
        console.error('JWT Verification Error:', err.message);
        // Fallback for dev if token is invalid and explicitly enabled
        // if (process.env.ENABLE_DEV_BYPASS === 'true') {
        //     const devUser = await prisma.user.findFirst({
        //         where: { role: 'admin' }
        //     });
        //     console.log(`Invalid token, falling back to dev bypass (User ID: ${devUser?.id || 1})`);
        //     req.user = {
        //         id: devUser?.id || 1,
        //         username: devUser?.username || 'admin',
        //         role: 'admin',
        //         permissions: devUser?.permissions || []
        //     };
        //     return next();
        // }
        res.status(401).json({ error: 'Invalid token.' });
    }
};

// Admin-only middleware
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
        return res.status(403).json({ error: 'Admin or Staff access required.' });
    }
    next();
};

// Permission check middleware
const checkPermission = (permission) => {
    return (req, res, next) => {
        // Super admin has all permissions
        if (req.user.role === 'admin') {
            return next();
        }

        // Staff must have the specific permission in their list
        if (req.user.role === 'staff' && req.user.permissions.includes(permission)) {
            return next();
        }

        return res.status(403).json({ error: `Permission denied: ${permission} access required.` });
    };
};

export { auth, adminOnly, checkPermission };
