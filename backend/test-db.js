import { PrismaClient } from '@prisma/client';
import fs from 'fs';

async function test() {
  const variations = [
    "postgresql://postgres:%21uLz6pgHhXVX4v@localhost:5433/krovaa_chat?schema=public",
    "postgresql://postgres:%21uLz6pgHhXVX4v:@localhost:5433/krovaa_chat?schema=public",
    "postgresql://postgres:%21uLz6pgHhXVX4v%3A@localhost:5433/krovaa_chat?schema=public",
    "postgresql://postgres:!uLz6pgHhXVX4v@localhost:5433/krovaa_chat?schema=public",
    "postgresql://postgres:postgres@localhost:5433/krovaa_chat?schema=public"
  ];

  if (fs.existsSync('results.txt')) fs.unlinkSync('results.txt');

  for (const url of variations) {
    console.log(`Testing URL: ${url}`);
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: url,
        },
      },
    });

    try {
      await prisma.$connect();
      console.log("✅ Success!");
      fs.appendFileSync('results.txt', `Success: ${url}\n`);
      await prisma.$disconnect();
    } catch (e) {
      console.log(`❌ Failed: ${e.message}`);
      fs.appendFileSync('results.txt', `Failed: ${url} - Error: ${e.message}\n`);
    }
  }
}

test();
