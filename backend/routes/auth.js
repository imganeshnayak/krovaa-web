import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { generateOtp, sendRegistrationOtp, sendPasswordResetOtp } from '../services/emailService.js';
import { validatePassword } from '../utils/passwordValidator.js';

const prisma = new PrismaClient();
const router = express.Router();

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// ─────────────────────────────────────────────────────────────────
// STEP 1: Send OTP to email before registration
// POST /api/auth/send-otp
// ─────────────────────────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
    try {
        let { email, username } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required.' });
        email = email.trim().toLowerCase();

        // Check if email already registered
        const existingEmail = await prisma.user.findUnique({ where: { email } });
        if (existingEmail) return res.status(400).json({ error: 'Email already registered. Try logging in.' });

        // If username provided, check if it's taken
        if (username) {
            const existingUser = await prisma.user.findUnique({ where: { username: username.trim() } });
            if (existingUser) return res.status(400).json({ error: 'Username is already taken.' });
        }

        // Invalidate any previous OTPs for this email
        await prisma.otpCode.updateMany({
            where: { email, type: 'registration', used: false },
            data: { used: true }
        });

        // Generate and save OTP (expires in 10 minutes)
        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Security: Hash OTP before storing
        const hashedOtp = await bcrypt.hash(otp, 10);

        await prisma.otpCode.create({
            data: { email, code: hashedOtp, type: 'registration', expiresAt }
        });

        // Send email
        await sendRegistrationOtp(email, otp);

        // Security: Removed detailed email/OTP logging
        res.json({ success: true, message: 'OTP sent to your email.' });
    } catch (err) {
        console.error('Send OTP error:', err);
        res.status(500).json({ error: 'Failed to send OTP. Please check your email address.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// STEP 2: Register with OTP verification
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        let { username, email, password, display_name, otp, profession } = req.body;
        username = username?.trim();
        email = email?.trim().toLowerCase();

        // Security: OTP is now mandatory for registration
        if (!otp) {
            return res.status(400).json({ error: 'OTP is required for registration.' });
        }

        const otpRecord = await prisma.otpCode.findFirst({
            where: {
                email,
                type: 'registration',
                used: false,
                expiresAt: { gt: new Date() }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!otpRecord || !(await bcrypt.compare(otp, otpRecord.code))) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Potential race condition: OTP marked used atomically
        const updatedOtp = await prisma.otpCode.updateMany({
            where: { id: otpRecord.id, used: false },
            data: { used: true }
        });

        if (updatedOtp.count === 0) {
            return res.status(400).json({ error: 'OTP already used or expired.' });
        }

        // Check existing user - Specific check for email vs username
        const existingEmail = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } }
        });
        if (existingEmail) {
            console.log('Registration failed: Email already exists', { email });
            return res.status(400).json({ error: 'This email is already registered. Try logging in instead.' });
        }

        const existingUsername = await prisma.user.findFirst({
            where: { username: { equals: username, mode: 'insensitive' } }
        });
        if (existingUsername) {
            console.log('Registration failed: Username taken', { username });
            return res.status(400).json({ error: 'This username is already taken. Please choose another one.' });
        }

        // Validate password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            console.log('Registration failed: Weak password', { error: passwordValidation.message });
            return res.status(400).json({ error: passwordValidation.message });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { username, email, password: hashedPassword, displayName: display_name || username, profession },
            select: { id: true, username: true, email: true, displayName: true, role: true, profession: true },
        });

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        await prisma.activityLog.create({ data: { userId: user.id, action: 'Registered' } });

        // Create a default support message so the 'Krovaa' chat appears immediately
        try {
            const admin = await prisma.user.findFirst({ where: { role: 'admin', status: 'active' }, select: { id: true, displayName: true, username: true } });
            if (admin) {
                const supportChatId = `support_${user.id}`;
                const welcomeContent = `🔔 Welcome to Krovaa!\n\nThis is the official Krovaa channel for updates and support. You can message here for help or receive important notifications.`;

                const created = await prisma.message.create({
                    data: {
                        chatId: supportChatId,
                        senderId: admin.id,
                        receiverId: user.id,
                        content: welcomeContent,
                        messageType: 'notification'
                    }
                });

                // Emit to user's socket room so their chat list updates in real-time (if socket exists)
                const io = req.app && req.app.get ? req.app.get('io') : null;
                if (io) {
                    io.to(`user_${user.id}`).emit('newMessage', {
                        ...created,
                        sender_name: 'Krovaa',
                        sender_avatar: null
                    });
                    // Also notify admins (they may want to see it in admin dashboard)
                    io.to('admin_broadcast').emit('newMessage', created);
                }
            }
        } catch (e) {
            console.error('Failed to create welcome support message:', e);
        }

        res.cookie('token', token, cookieOptions);
        res.status(201).json({ user, token });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        let { email, password } = req.body;
        email = email?.trim().toLowerCase();

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ error: `Account ${user.status}.`, status: user.status });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error('Login error: JWT_SECRET is not defined');
            return res.status(500).json({ error: 'Server configuration error.' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            jwtSecret,
            { expiresIn: '7d' }
        );

        await prisma.activityLog.create({ data: { userId: user.id, action: 'Logged in' } });

        const { password: _, ...userWithoutPassword } = user;
        res.cookie('token', token, cookieOptions);
        res.json({ user: userWithoutPassword, token });
    } catch (err) {
        console.error('Login error:', err.message, err.stack);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { 
                id: true, username: true, email: true, displayName: true, 
                avatarUrl: true, role: true, status: true, city: true, 
                pincode: true, profession: true, bio: true, phoneNumber: true,
                gender: true, age: true, userGoal: true, skills: true,
                createdAt: true 
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json(user);
    } catch (err) {
        console.error('Get me error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// FORGOT PASSWORD — Step 1: Send reset OTP
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
    try {
        let { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required.' });
        email = email.trim().toLowerCase();

        const user = await prisma.user.findUnique({ where: { email } });
        // Return 401 if user not found to help user identify wrong email
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Invalidate previous reset OTPs
        await prisma.otpCode.updateMany({
            where: { email, type: 'password_reset', used: false },
            data: { used: true }
        });

        // Generate and save OTP
        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Security: Hash OTP before storing
        const hashedOtp = await bcrypt.hash(otp, 10);

        await prisma.otpCode.create({
            data: { email, code: hashedOtp, type: 'password_reset', expiresAt }
        });

        await sendPasswordResetOtp(email, otp);

        res.json({ success: true, message: 'A reset code has been sent to your email.' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Failed to send reset email.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// FORGOT PASSWORD — Step 2: Verify OTP
// POST /api/auth/verify-reset-otp
// ─────────────────────────────────────────────────────────────────
router.post('/verify-reset-otp', async (req, res) => {
    try {
        let { email, otp } = req.body;
        email = email?.trim()?.toLowerCase();

        const otpRecord = await prisma.otpCode.findFirst({
            where: {
                email,
                type: 'password_reset',
                used: false,
                expiresAt: { gt: new Date() }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!otpRecord || !(await bcrypt.compare(otp, otpRecord.code))) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Potential race condition: Mark OTP as used immediately after verification
        const updatedOtp = await prisma.otpCode.updateMany({
            where: { id: otpRecord.id, used: false },
            data: { used: true }
        });

        if (updatedOtp.count === 0) {
            return res.status(400).json({ error: 'OTP already used.' });
        }

        // Return a short-lived reset token
        const resetToken = jwt.sign(
            { email, purpose: 'password_reset' },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({ success: true, resetToken });
    } catch (err) {
        console.error('Verify reset OTP error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// FORGOT PASSWORD — Step 3: Set new password
// POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;

        if (!resetToken || !newPassword) {
            return res.status(400).json({ error: 'Reset token and new password are required.' });
        }

        // Validate password strength
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        // Verify reset token
        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
        } catch {
            return res.status(400).json({ error: 'Invalid or expired reset token.' });
        }

        if (decoded.purpose !== 'password_reset') {
            return res.status(400).json({ error: 'Invalid token.' });
        }

        // Update password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { email: decoded.email },
            data: { password: hashedPassword }
        });

        res.json({ success: true, message: 'Password reset successfully. Please login.' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// Telegram Login
// POST /api/auth/telegram
// ─────────────────────────────────────────────────────────────────
router.post('/telegram', async (req, res) => {
    try {
        const { auth_data } = req.body;
        const bot_token = process.env.TELEGRAM_BOT_TOKEN;

        if (!bot_token) {
            console.error('TELEGRAM_BOT_TOKEN is missing in environment variables');
            return res.status(500).json({ error: 'Telegram Bot Token not configured.' });
        }

        const payload = auth_data || req.body;

        if (!payload || !payload.hash) {
            console.error('Missing telegram auth data or hash', { body: req.body });
            return res.status(400).json({ error: 'Invalid Telegram authentication data.' });
        }

        const { hash, ...data } = payload;
        const dataCheckString = Object.keys(data)
            .sort()
            .map(key => `${key}=${data[key]}`)
            .join('\n');

        const secretKey = crypto.createHash('sha256').update(bot_token).digest();
        const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

        if (hmac !== hash) {
            return res.status(401).json({ error: 'Data integrity check failed.' });
        }

        if (Date.now() / 1000 - data.auth_date > 86400) {
            return res.status(401).json({ error: 'Authentication data expired.' });
        }

        let user = await prisma.user.findFirst({
            where: { telegramId: data.id.toString() }
        });

        if (!user) {
                user = await prisma.user.upsert({
                where: { username: data.username || `tg_${data.id}` },
                update: { telegramId: data.id.toString() },
                create: {
                    username: data.username || `tg_${data.id}`,
                    email: `${data.id}@telegram.user`,
                    password: crypto.randomBytes(16).toString('hex'),
                    displayName: `${data.first_name} ${data.last_name || ''}`.trim(),
                    avatarUrl: data.photo_url,
                    telegramId: data.id.toString(),
                    role: 'client'
                }
            });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ error: `Account ${user.status}.`, status: user.status });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        await prisma.activityLog.create({ data: { userId: user.id, action: 'Logged in via Telegram' } });

        res.cookie('token', token, cookieOptions);
        res.json({ user, token });

    } catch (err) {
        console.error('Telegram Auth Error:', err);
        res.status(500).json({ error: 'Telegram authentication failed.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
    res.json({ success: true, message: 'Logged out successfully.' });
});

export default router;
