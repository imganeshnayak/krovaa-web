import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.join(process.cwd(), '.env') });
const prisma = new PrismaClient();

async function run() {
  try {
    const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (!admin) {
      console.log('No admin found');
      return;
    }
    const token = jwt.sign({ id: admin.id, role: admin.role, status: admin.status }, process.env.JWT_SECRET);
    
    // Get first chat
    const chat = await prisma.message.findFirst({
      select: { chatId: true }
    });
    if (!chat) {
      console.log('No messages/chats found in DB');
      return;
    }
    
    const chatId = chat.chatId;
    console.log(`Using chatId: ${chatId}`);

    // Fetch messages via Vite (8080)
    console.log(`Fetching /api/admin/chats/${chatId}/messages via Vite (8080)`);
    const res1 = await fetch(`http://localhost:8080/api/admin/chats/${chatId}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const text1 = await res1.text();
    console.log('MESSAGES STATUS:', res1.status);
    console.log('MESSAGES RESPONSE START:', text1.substring(0, 200));

    // Fetch details via Vite (8080)
    console.log(`\nFetching /api/admin/chats/${chatId}/details via Vite (8080)`);
    const res2 = await fetch(`http://localhost:8080/api/admin/chats/${chatId}/details`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const text2 = await res2.text();
    console.log('DETAILS STATUS:', res2.status);
    console.log('DETAILS RESPONSE START:', text2.substring(0, 200));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
