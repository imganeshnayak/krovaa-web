import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

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
    
    console.log('Fetching /api/admin/chats');
    const res1 = await fetch('http://127.0.0.1:5000/api/admin/chats', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const text1 = await res1.text();
    console.log('CHATS STATUS:', res1.status);
    console.log('CHATS RESPONSE START:', text1.substring(0, 100));

    console.log('\nFetching /api/admin/group-chats');
    const res2 = await fetch('http://127.0.0.1:5000/api/admin/group-chats', {
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
