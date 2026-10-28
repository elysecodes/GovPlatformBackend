import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

/**
 * Bulk-provisions leader accounts for the whole administrative hierarchy:
 * one account per DISTRICT/SECTOR/CELL/VILLAGE, bound to its exact unit.
 *
 * Set PROVISION_PROVINCE to a province code (e.g. EAST) to limit the run to
 * one province; otherwise every province in the database is provisioned.
 *
 * Username convention: <unit-name-slug>.<level>  (e.g. musanze.admin, muhoza.sector)
 * Email convention (official Rwanda job emails): mayor@<district>.gov.rw,
 * execsec@<sector>.gov.rw, cell@<cell>.gov.rw. Village admins have no email.
 * Temp password for every account: Admin@123  (must be changed on first login)
 *
 * Idempotent: accounts whose username already exists are skipped.
 */

const prisma = new PrismaClient();

const TEMP_PASSWORD = process.env.PROVISION_PASSWORD || 'Admin@123';
const FILTER_PROVINCE = (process.env.PROVISION_PROVINCE || '').toUpperCase();

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.')
    .slice(0, 28);
}

function inScope(province: { code: string }): boolean {
  return !FILTER_PROVINCE || province.code === FILTER_PROVINCE;
}

async function main() {
  const label = FILTER_PROVINCE ? `province ${FILTER_PROVINCE}` : 'all provinces';
  console.log(`Provisioning leader accounts for the full hierarchy (${label})...`);

  const roles = await prisma.role.findMany({ where: { level: { gte: 2, lte: 5 } } });
  const roleByLevel: Record<number, { id: number }> = {};
  for (const r of roles) roleByLevel[r.level] = r;

  if (!roleByLevel[2] || !roleByLevel[3] || !roleByLevel[4] || !roleByLevel[5]) {
    throw new Error('Required roles (DISTRICT/SECTOR/CELL/VILLAGE_ADMIN) are not seeded');
  }

  // Same temp password for everyone -> hash once and reuse.
  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);

  // Existing accounts (role levels 2-5). A username that already belongs to the
  // SAME province is a genuine duplicate and is skipped. A username that is
  // taken by a DIFFERENT province (Rwanda reuses many unit names across
  // provinces, e.g. "gacaca" villages) must still get an account, so it falls
  // back to <name>.<province>.
  const existingFor = new Map<string, { provinceId: number | null }>(
    (await prisma.user.findMany({ where: { role: { level: { gte: 2, lte: 5 } } }, select: { username: true, provinceId: true } })).map((u) => [u.username, u]),
  );

  const taken = new Map(existingFor);
  const uniqueUser = (base: string, provinceCode: string): string => {
    const root = taken.has(base) ? `${base}.${provinceCode.toLowerCase()}` : base;
    let name = root;
    let i = 2;
    while (taken.has(name)) name = `${root}-${i++}`;
    taken.set(name, { provinceId: null });
    return name;
  };

  // Existing emails so that regenerated "job emails" stay globally unique.
  const takenEmails = new Set(
    (await prisma.user.findMany({ where: { email: { not: null } }, select: { email: true } })).map((u) => u.email!),
  );
  const uniqueEmail = (base: string | null): string | null => {
    if (!base) return null;
    let email = base;
    let i = 2;
    while (takenEmails.has(email)) {
      const [local, domain] = email.split('@');
      email = `${local}-${i++}@${domain}`;
    }
    takenEmails.add(email);
    return email;
  };

  const districts = (await prisma.district.findMany({ include: { province: true } })).filter((d) => inScope(d.province));
  const sectors = (await prisma.sector.findMany({ include: { district: { include: { province: true } } } })).filter((s) => inScope(s.district.province));
  const cells = (await prisma.cell.findMany({ include: { sector: { include: { district: { include: { province: true } } } } } })).filter((c) => inScope(c.sector.district.province));
  const villages = (await prisma.village.findMany({ include: { cell: { include: { sector: { include: { district: { include: { province: true } } } } } } } })).filter((v) => inScope(v.cell.sector.district.province));

  let created = 0;
  let skipped = 0;

  async function provision(
    level: number,
    baseUsername: string,
    fullName: string,
    province: { id: number; code: string; name: string },
    districtId: number | null,
    sectorId: number | null,
    cellId: number | null,
    villageId: number | null,
    unitLabel: string,
    jobEmail: string | null,
  ) {
    const sameProvince = existingFor.has(baseUsername) && existingFor.get(baseUsername)?.provinceId === province.id;
    if (sameProvince) {
      skipped++;
      return;
    }
    const username = uniqueUser(baseUsername, province.code);
    await prisma.user.create({
      data: {
        fullName,
        username,
        email: uniqueEmail(jobEmail),
        phone: `07${String(88000000 + ((created + existingFor.size) % 1000000)).slice(0, 8)}`,
        passwordHash,
        roleId: roleByLevel[level].id,
        provinceId: province.id,
        districtId,
        sectorId,
        cellId,
        villageId,
        createdById: null,
        status: 'ACTIVE',
        mustChangePassword: true,
      },
    });
    created++;
    return { username, fullName, role: roleByLevel[level], unitLabel };
  }

  const credentials: { username: string; password: string; role: string; level: number; unit: string }[] = [];

  const labelUnit = (p: string, parts: string[]) => `${p}: ${parts.join(' / ')}`;

  // DISTRICT_ADMIN (level 2)
  for (const d of districts) {
    const user = await provision(
      2,
      `${slugify(d.name)}.admin`,
      `${d.name} District Administrator`,
      d.province,
      d.id,
      null,
      null,
      null,
      labelUnit(d.province.code, [d.name]),
      `mayor@${slugify(d.name)}.gov.rw`,
    );
    if (user) credentials.push({ username: user.username, password: TEMP_PASSWORD, role: 'DISTRICT_ADMIN', level: 2, unit: user.unitLabel });
  }

  // SECTOR_ADMIN (level 3)
  for (const s of sectors) {
    const user = await provision(
      3,
      `${slugify(s.name)}.sector`,
      `${s.name} Sector Administrator`,
      s.district.province,
      s.districtId,
      s.id,
      null,
      null,
      labelUnit(s.district.province.code, [s.district.name, s.name]),
      `execsec@${slugify(s.name)}.gov.rw`,
    );
    if (user) credentials.push({ username: user.username, password: TEMP_PASSWORD, role: 'SECTOR_ADMIN', level: 3, unit: user.unitLabel });
  }

  // CELL_ADMIN (level 4)
  for (const c of cells) {
    const user = await provision(
      4,
      `${slugify(c.name)}.cell`,
      `${c.name} Cell Administrator`,
      c.sector.district.province,
      c.sector.districtId,
      c.sectorId,
      c.id,
      null,
      labelUnit(c.sector.district.province.code, [c.sector.district.name, c.sector.name, c.name]),
      `cell@${slugify(c.name)}.gov.rw`,
    );
    if (user) credentials.push({ username: user.username, password: TEMP_PASSWORD, role: 'CELL_ADMIN', level: 4, unit: user.unitLabel });
  }

  // VILLAGE_ADMIN (level 5) - no job email (villages are not government offices)
  for (const v of villages) {
    const user = await provision(
      5,
      `${slugify(v.name)}.village`,
      `${v.name} Village Administrator`,
      v.cell.sector.district.province,
      v.cell.sector.districtId,
      v.cell.sectorId,
      v.cellId,
      v.id,
      labelUnit(v.cell.sector.district.province.code, [v.cell.sector.district.name, v.cell.sector.name, v.cell.name, v.name]),
      null,
    );
    if (user) credentials.push({ username: user.username, password: TEMP_PASSWORD, role: 'VILLAGE_ADMIN', level: 5, unit: user.unitLabel });
  }

  const outPath = path.join(__dirname, 'leader-credentials.txt');
  const lines = [
    'Provincial Governance Platform - Leader Accounts',
    `Scope: ${label}`,
    `Temporary password for all accounts: ${TEMP_PASSWORD}`,
    'Each account must change its password on first login.',
    '',
    `DISTRICT_ADMIN: ${districts.length}  SECTOR_ADMIN: ${sectors.length}  CELL_ADMIN: ${cells.length}  VILLAGE_ADMIN: ${villages.length}`,
    `Created: ${created}   Skipped (already existed): ${skipped}`,
    '',
    ...credentials.map((c) => `[${c.role}] ${c.username} / ${TEMP_PASSWORD}  ->  ${c.unit}`),
  ];
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');

  console.log(`Done. Created ${created} accounts, skipped ${skipped} existing.`);
  console.log(`Credentials written to: ${outPath}`);
  console.log('Sample accounts:');
  for (const c of credentials.slice(0, 5)) console.log(`  ${c.username} / ${TEMP_PASSWORD}  (${c.unit})`);
  if (credentials.length > 5) console.log(`  ... and ${credentials.length - 5} more (see the file)`);
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