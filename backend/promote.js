import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (one level up from backend/)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function promoteToAdmin() {
    // Join all arguments starting from index 2 to handle emails with unintentional spaces
    const email = process.argv.slice(2).join('');

    if (!email) {
        console.error('Please provide an email address. Example: node promote.js user@example.com');
        process.exit(1);
    }

    try {
        const user = await prisma.user.update({
            where: { email },
            data: { role: 'admin' },
        });
        console.log(`Successfully promoted ${user.displayName} (@${user.username}) to ADMIN.`);
    } catch (error) {
        console.error('Error promoting user:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

promoteToAdmin();
