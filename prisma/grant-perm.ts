import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const slug = process.argv[2] ?? 'notifications.send';
  const roles = ['SUPER_ADMIN', 'PROVINCE_ADMIN', 'DISTRICT_ADMIN', 'SECTOR_ADMIN', 'CELL_ADMIN', 'VILLAGE_ADMIN'];
  const perm = await prisma.permission.findUnique({ where: { slug } });
  if (!perm) {
    console.error('permission does not exist:', slug);
    await prisma.permission.create({ data: { slug, name: slug } });
    console.log('created permission', slug);
  }
  for (const roleSlug of roles) {
    const role = await prisma.role.findUnique({ where: { slug: roleSlug }, include: { permissions: true } });
    if (!role) { console.error('missing role', roleSlug); continue; }
    const p = await prisma.permission.findUnique({ where: { slug } });
    if (!p) continue;
    if (!role.permissions.some((x) => x.slug === slug)) {
      await prisma.role.update({ where: { id: role.id }, data: { permissions: { connect: { id: p.id } } } });
    }
    console.log(roleSlug, slug, 'granted');
  }
}
main().finally(() => prisma.$disconnect());