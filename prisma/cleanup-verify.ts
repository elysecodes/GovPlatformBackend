import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.notification.deleteMany({ where: { title: { startsWith: 'VERIFY broadcast' } } });
  console.log('deleted broadcast notifications:', r.count);
}
main().finally(() => prisma.$disconnect());