import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function migrateShareIds() {
  const users = await prisma.user.findMany({
    where: { shareId: null },
    select: { id: true },
  });

  console.log(`Found ${users.length} users without shareId.`);

  for (const user of users) {
    const shareId = crypto.randomBytes(8).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: { shareId },
    });
  }

  console.log(`Updated ${users.length} users with shareId.`);
  await prisma.$disconnect();
}

migrateShareIds().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
