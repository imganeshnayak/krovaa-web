import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const adminPassword = 'adminpassword123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const admin = await prisma.user.upsert({
        where: { username: 'test_admin' },
        update: {
            password: hashedPassword,
            role: 'admin',
            status: 'active'
        },
        create: {
            username: 'test_admin',
            password: hashedPassword,
            email: 'test_admin@example.com',
            role: 'admin',
            status: 'active',
            displayName: 'Test Admin'
        }
    });

    console.log('Admin user created/updated successfully');
    console.log('Username: test_admin');
    console.log('Password: adminpassword123');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
