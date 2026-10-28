import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

/**
 * Non-destructive import of additional provinces, mirroring the hierarchy
 * loader inside prisma/seed.ts but WITHOUT the full database reset.
 *
 * Every province with a JSON file in this directory (`<province>-data.json`)
 * is ensured to exist: provinces and districts are upserted, and any missing
 * sectors/cells/villages are inserted by their code. Afterwards, any province
 * that has no PROVINCE_ADMIN yet receives a demo administrator so the
 * province-scoped dashboards can be signed into.
 *
 * Idempotent - running it again adds nothing.
 */

const prisma = new PrismaClient();

interface VillageRef { name: string; code: string }
interface CellRef { name: string; code: string; villages: VillageRef[] }
interface SectorRef { name: string; code: string; cells: CellRef[] }
interface DistrictRef { name: string; code: string; sectors: SectorRef[] }
interface ProvinceRef { name: string; code: string; districts: DistrictRef[] }

const provinceFiles = fs
  .readdirSync(__dirname)
  .filter((f) => f.endsWith('-data.json'))
  .sort((a, b) => (a.startsWith('northern') ? -1 : b.startsWith('northern') ? 1 : a.localeCompare(b)));

const provinceData = provinceFiles.map(
  (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf-8')) as ProvinceRef,
);

const PROVINCE_ADMIN_USERNAME: Record<string, string> = {
  NORTH: 'province',
  EAST: 'eastern',
  SOU: 'southern',
  WES: 'western',
  KIG: 'kigali',
};

async function main() {
  const existingSectorCodes = new Set((await prisma.sector.findMany({ select: { code: true } })).map((r) => r.code));
  const existingCellCodes = new Set((await prisma.cell.findMany({ select: { code: true } })).map((r) => r.code));
  const existingVillageCodes = new Set((await prisma.village.findMany({ select: { code: true } })).map((r) => r.code));

  for (const data of provinceData) {
    const province = await prisma.province.upsert({
      where: { code: data.code },
      update: { name: data.name },
      create: { name: data.name, code: data.code },
    });
    console.log(`Ensuring ${data.name} (${data.code})...`);

    for (const dd of data.districts) {
      const district = await prisma.district.upsert({
        where: { code: dd.code },
        update: { name: dd.name },
        create: { name: dd.name, code: dd.code, provinceId: province.id },
      });

      const missingSectors = dd.sectors.filter((s) => !existingSectorCodes.has(s.code));
      if (missingSectors.length) {
        await prisma.sector.createMany({
          data: missingSectors.map((s) => ({ name: s.name, code: s.code, districtId: district.id })),
        });
      }

      const sectorRows = await prisma.sector.findMany({ where: { districtId: district.id }, select: { id: true, name: true, code: true } });
      const sectorIdByCode: Record<string, number> = {};
      for (const s of sectorRows) sectorIdByCode[s.code] = s.id;

      const missingCells = dd.sectors.flatMap((s) =>
        s.cells.filter((c) => !existingCellCodes.has(c.code)).map((c) => ({ name: c.name, code: c.code, sectorId: sectorIdByCode[s.code] })),
      );
      if (missingCells.length) {
        await prisma.cell.createMany({ data: missingCells });
      }

      const cellRows = await prisma.cell.findMany({ where: { sectorId: { in: sectorRows.map((s) => s.id) } }, select: { id: true, name: true, code: true } });
      const cellIdByCode: Record<string, number> = {};
      for (const c of cellRows) cellIdByCode[c.code] = c.id;

      const missingVillages = dd.sectors.flatMap((s) =>
        s.cells.flatMap((c) =>
          c.villages.filter((v) => !existingVillageCodes.has(v.code)).map((v) => ({ name: v.name, code: v.code, cellId: cellIdByCode[c.code] })),
        ),
      );
      if (missingVillages.length) {
        await prisma.village.createMany({ data: missingVillages });
      }
    }
  }

  // -------------------------------------------------------- province admins
  const adminRole = await prisma.role.findUnique({ where: { slug: 'PROVINCE_ADMIN' } });
  if (!adminRole) throw new Error('PROVINCE_ADMIN role not seeded');

  const admins = await prisma.user.findMany({
    where: { role: { slug: 'PROVINCE_ADMIN' }, provinceId: { not: null } },
    select: { provinceId: true },
  });
  const provincesWithAdmin = new Set(admins.map((a) => a.provinceId));

  const provinces = await prisma.province.findMany({ orderBy: { code: 'asc' } });
  const passwordHash = await bcrypt.hash('Admin@123', 10);
  let adminsCreated = 0;

  for (const p of provinces) {
    if (provincesWithAdmin.has(p.id)) continue;
    const username = PROVINCE_ADMIN_USERNAME[p.code] ?? `${p.code.toLowerCase()}admin`;
    const domain = p.name
      .trim()
      .toLowerCase()
      .replace(/\s+(province|city)\s*$/, '')
      .replace(/[^a-z0-9]/g, '');
    const head = p.code === 'KIG' ? 'mayor' : 'governor';
    await prisma.user.create({
      data: {
        fullName: `${p.name} Administrator`,
        username,
        email: `${head}@${domain}.gov.rw`,
        phone: `07${String(87000000 + p.id * 100).slice(0, 8)}`,
        passwordHash,
        roleId: adminRole.id,
        provinceId: p.id,
        status: 'ACTIVE',
      },
    });
    console.log(`  created province admin: ${username} / Admin@123  (${p.name})`);
    adminsCreated++;
  }

  const [provincesCount, districts, sectors, cells, villages] = await Promise.all([
    prisma.province.count(),
    prisma.district.count(),
    prisma.sector.count(),
    prisma.cell.count(),
    prisma.village.count(),
  ]);
  console.log(`Done. provinces=${provincesCount} districts=${districts} sectors=${sectors} cells=${cells} villages=${villages}. Province admins created: ${adminsCreated}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });