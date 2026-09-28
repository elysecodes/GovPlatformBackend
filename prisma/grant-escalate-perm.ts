import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  for (const roleSlug of ['CELL_ADMIN', 'VILLAGE_ADMIN']) {
    const role = await prisma.role.findUnique({ where: { slug: roleSlug }, include: { permissions: true } });
    if (!role) { console.error('missing role', roleSlug); continue; }
    const perc = await prisma.permission.findUnique({ where: { slug: 'complaints.escalate' } });
    if (!perc) { console.error('missing permission'); break; }
    const has = role.permissions.some((p) => p.slug === 'complaints.escalate');
    if (!has) await prisma.role.update({ where: { id: role.id }, data: { permissions: { connect: { id: perc.id } } } });
    console.log(roleSlug, 'complaints.escalate granted');
  }
}
main().finally(() => prisma.$disconnect());