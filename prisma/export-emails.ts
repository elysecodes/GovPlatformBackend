import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

/**
 * Exports all government administrative emails (province/district/sector/cell
 * admins) to data/government-emails.json. Village admins have no office email
 * and are excluded. Idempotent; regenerates the file from the current DB.
 */

const prisma = new PrismaClient();

interface EmailEntry {
  email: string;
  username: string;
  role: string;
  unit: string;
}

async function main() {
  const users = await prisma.user.findMany({
    where: { role: { slug: { in: ['PROVINCE_ADMIN', 'DISTRICT_ADMIN', 'SECTOR_ADMIN', 'CELL_ADMIN'] } }, email: { not: null } },
    include: {
      role: true,
      province: { include: { districts: true } },
      district: true,
      sector: true,
      cell: true,
    },
    orderBy: [{ provinceId: 'asc' }, { districtId: 'asc' }, { sectorId: 'asc' }, { cellId: 'asc' }, { username: 'asc' }],
  });

  function unitLabel(u: (typeof users)[number]): string {
    switch (u.role.slug) {
      case 'PROVINCE_ADMIN':
        return u.province?.name ?? '(unbound)';
      case 'DISTRICT_ADMIN':
        return [u.district?.name, u.province?.name].filter(Boolean).join(' - ');
      case 'SECTOR_ADMIN':
        return [u.sector?.name, u.district?.name, u.province?.name].filter(Boolean).join(' / ');
      case 'CELL_ADMIN':
        return [u.cell?.name, u.sector?.name, u.district?.name].filter(Boolean).join(' / ');
      default:
        return '(unknown)';
    }
  }

  const rows: EmailEntry[] = users.map((u) => ({
    email: u.email!,
    username: u.username,
    role: u.role.slug,
    unit: unitLabel(u),
  }));

  const payload = {
    title: 'Rwanda Digital Governance Platform - Government Administrative Emails',
    convention:
      'governor@<province>.gov.rw (mayor@kigali.gov.rw for Kigali City) | mayor@<district>.gov.rw | execsec@<sector>.gov.rw | cell@<cell>.gov.rw',
    note: 'Village admins have no government office email and are not listed.',
    generatedAt: new Date().toISOString(),
    count: rows.length,
    emails: rows,
  };

  const outDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'government-emails.json');
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');

  console.log(`Exported ${rows.length} emails -> ${outPath}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });