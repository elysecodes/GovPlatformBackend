import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Non-destructive provisioning of the Eastern Province demo accounts.
 * Adds one district administrator per Eastern district, the sector/cell/village
 * chain under Nyagatare, and one citizen — mirroring the Northern demo set.
 * Does NOT delete any data; accounts whose username already exists are skipped.
 *
 * Passwords: Admin@123 for admins, Citizen@123 for the citizen.
 */

const prisma = new PrismaClient();

const pw = (s: string) => bcrypt.hash(s, 10);

async function createAdmin(params: {
  fullName: string; username: string; email: string; phone: string;
  role: string; provinceId: number; districtId: number; sectorId: number; cellId: number; villageId: number;
}) {
  const role = await prisma.role.findFirst({ where: { slug: params.role as any } });
  if (!role) throw new Error(`Role ${params.role} not found`);

  const exists = await prisma.user.findFirst({ where: { username: params.username } });
  if (exists) {
    console.log(`  user ${params.username} already exists, skipping`);
    return exists;
  }

  return prisma.user.create({
    data: {
      fullName: params.fullName,
      username: params.username,
      email: params.email,
      phone: params.phone,
      passwordHash: await pw('Admin@123'),
      roleId: role.id,
      provinceId: params.provinceId || null,
      districtId: params.districtId || null,
      sectorId: params.sectorId || null,
      cellId: params.cellId || null,
      villageId: params.villageId || null,
      status: 'ACTIVE',
    },
  });
}

async function main() {
  const eastern = await prisma.province.findFirst({ where: { code: 'EAST' } });
  if (!eastern) throw new Error('Eastern Province not found. Run `npm run db:seed` first.');

  console.log('Provisioning Eastern Province demo accounts...');

  await createAdmin({
    fullName: 'Eastern Province Administrator', username: 'eastern', email: 'eastern@eastern.gov.rw',
    phone: '0788000007', role: 'PROVINCE_ADMIN',
    provinceId: eastern.id, districtId: 0, sectorId: 0, cellId: 0, villageId: 0,
  });

  const eastDistricts = await prisma.district.findMany({ where: { provinceId: eastern.id }, orderBy: { id: 'asc' } });
  let eastPhone = 9;
  for (const d of eastDistricts) {
    const slug = d.name.toLowerCase().replace(/[^a-z]/g, '');
    await createAdmin({
      fullName: `${d.name} District Administrator`,
      username: slug,
      email: `district@${slug}.gov.rw`,
      phone: `07880000${String(eastPhone).padStart(2, '0')}`,
      role: 'DISTRICT_ADMIN',
      provinceId: eastern.id, districtId: d.id, sectorId: 0, cellId: 0, villageId: 0,
    });
    eastPhone++;
  }

  const nyagatareDistrict = await prisma.district.findFirst({ where: { code: 'EAST-NYA' } });
  const nyagatareSector = await prisma.sector.findFirst({ where: { code: 'EAST-NYA-S1' } });
  const nyagatareCell = await prisma.cell.findFirst({ where: { code: 'EAST-NYA-S1C1' } });
  const nyagatareVillage = await prisma.village.findFirst({ where: { code: 'EAST-NYA-S1C1V1' } });
  if (!nyagatareDistrict || !nyagatareSector || !nyagatareCell || !nyagatareVillage) {
    throw new Error('Nyagatare unit chain (EAST-NYA-S1C1V1) not found in the database');
  }

  await createAdmin({
    fullName: `${nyagatareSector.name} Sector Administrator`, username: 'east_sector', email: 'sector@east.gov.rw',
    phone: '0788000016', role: 'SECTOR_ADMIN',
    provinceId: eastern.id, districtId: nyagatareDistrict.id, sectorId: nyagatareSector.id, cellId: 0, villageId: 0,
  });

  await createAdmin({
    fullName: `${nyagatareCell.name} Cell Administrator`, username: 'east_cell', email: 'cell@east.gov.rw',
    phone: '0788000017', role: 'CELL_ADMIN',
    provinceId: eastern.id, districtId: nyagatareDistrict.id, sectorId: nyagatareSector.id, cellId: nyagatareCell.id, villageId: 0,
  });

  await createAdmin({
    fullName: `${nyagatareVillage.name} Village Administrator`, username: 'east_village', email: 'village@east.gov.rw',
    phone: '0788000018', role: 'VILLAGE_ADMIN',
    provinceId: eastern.id, districtId: nyagatareDistrict.id, sectorId: nyagatareSector.id, cellId: nyagatareCell.id, villageId: nyagatareVillage.id,
  });

  const citizenRole = await prisma.role.findFirst({ where: { slug: 'CITIZEN' } });
  const existingCitizen = await prisma.user.findFirst({ where: { username: 'east_citizen' } });
  if (citizenRole && !existingCitizen) {
    const u = await prisma.user.create({
      data: {
        fullName: 'Aline Uwase', username: 'east_citizen', email: 'citizen@east.gov.rw',
        phone: '0788000019', passwordHash: await pw('Citizen@123'),
        roleId: citizenRole.id,
        provinceId: eastern.id, districtId: nyagatareDistrict.id, sectorId: nyagatareSector.id,
        cellId: nyagatareCell.id, villageId: nyagatareVillage.id,
        status: 'ACTIVE',
      },
    });
    const profile = await prisma.citizen.findFirst({ where: { userId: u.id } });
    if (!profile) {
      await prisma.citizen.create({
        data: { userId: u.id, villageId: nyagatareVillage.id, nationalId: '1198765432109999', gender: 'Female' },
      });
    }
  } else if (existingCitizen) {
    console.log('  user east_citizen already exists, skipping');
  }

  console.log('Done. Eastern demo accounts ready (Admin@123 for admins, Citizen@123 for citizen).');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });