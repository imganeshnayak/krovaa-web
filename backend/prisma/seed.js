import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const prisma = new PrismaClient();

async function seed() {
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Seed users
    const admin = await prisma.user.upsert({
        where: { email: 'admin@krovaa.com' },
        update: {},
        create: { username: 'krovaa', email: 'admin@krovaa.com', password: hashedPassword, displayName: 'Krovaa', role: 'admin' },
    });
    const alice = await prisma.user.upsert({
        where: { email: 'alice@example.com' },
        update: {},
        create: { username: 'alice', email: 'alice@example.com', password: hashedPassword, displayName: 'Alice Murray', role: 'client' },
    });
    const mark = await prisma.user.upsert({
        where: { email: 'mark@example.com' },
        update: {},
        create: { username: 'mark', email: 'mark@example.com', password: hashedPassword, displayName: 'Mark Solomons', role: 'client' },
    });
    const sara = await prisma.user.upsert({
        where: { email: 'sara@example.com' },
        update: {},
        create: { username: 'sara', email: 'sara@example.com', password: hashedPassword, displayName: 'Sara Lee', role: 'client' },
    });
    const dev = await prisma.user.upsert({
        where: { email: 'dev@example.com' },
        update: {},
        create: { username: 'devteam', email: 'dev@example.com', password: hashedPassword, displayName: 'Dev Team', role: 'vendor' },
    });

    // Seed messages
    const msgCount = await prisma.message.count();
    if (msgCount === 0) {
        await prisma.message.createMany({
            data: [
                { senderId: alice.id, receiverId: admin.id, chatId: 'chat_alice', content: 'Hi there! 👋 I reviewed the proposal you sent yesterday. The design concepts look absolutely stunning.' },
                { senderId: admin.id, receiverId: alice.id, chatId: 'chat_alice', content: 'Glad you liked it! We focused heavily on the depth and lighting effects.' },
                { senderId: admin.id, receiverId: alice.id, chatId: 'chat_alice', content: 'Here is the updated moodboard.' },
                { senderId: alice.id, receiverId: admin.id, chatId: 'chat_alice', content: 'That sounds perfect! Send the invoice over when you have a moment.' },
                { senderId: mark.id, receiverId: admin.id, chatId: 'chat_mark', content: 'Can we reschedule the call?' },
                { senderId: sara.id, receiverId: admin.id, chatId: 'chat_sara', content: 'File attached: project_v2.pdf' },
                { senderId: dev.id, receiverId: admin.id, chatId: 'chat_dev', content: 'Deploying to production now.' },
            ],
        });
    }

    // Seed activity log
    const actCount = await prisma.activityLog.count();
    if (actCount === 0) {
        await prisma.activityLog.createMany({
            data: [
                { userId: alice.id, action: 'Logged in', status: 'active' },
                { userId: sara.id, action: 'Sent message', status: 'active' },
                { userId: mark.id, action: 'Flagged activity', status: 'flagged' },
                { userId: mark.id, action: 'File uploaded', status: 'active' },
                { userId: alice.id, action: 'Payment received', status: 'active' },
            ],
        });
    }

    console.log('✅ Database seeded with demo data');
}

// Optional: create a few sample posts for seeded users
async function seedPosts() {
    const users = await prisma.user.findMany({ where: { email: { in: ['alice@example.com','mark@example.com','sara@example.com'] } } });
    for (const u of users) {
        await prisma.post.create({ data: { userId: u.id, text: `Welcome post for ${u.displayName || u.username}`, media: [] } });
    }
}

seedPosts().catch(()=>{});

seed()
    .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
