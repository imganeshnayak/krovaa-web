import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });
const prisma = new PrismaClient();

async function run() {
  try {
    const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (!admin) return;
    const token = jwt.sign({ id: admin.id, role: admin.role, status: admin.status }, process.env.JWT_SECRET);
    
    // Test Vite dev server
    console.log('Fetching /api/admin/chats? via Vite (8080)');
    const res1 = await fetch('http://localhost:8080/api/admin/chats?', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const text1 = await res1.text();
    console.log('CHATS STATUS:', res1.status);
    console.log('CHATS RESPONSE START:', text1.substring(0, 100));

    console.log('\nFetching /api/admin/group-chats? via Vite (8080)');
    const res2 = await fetch('http://localhost:8080/api/admin/group-chats?', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const text2 = await res2.text();
    console.log('GROUP CHATS STATUS:', res2.status);
    console.log('GROUP CHATS RESPONSE START:', text2.substring(0, 100));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
