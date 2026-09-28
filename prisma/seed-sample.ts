import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Idempotent sample-data expansion for the demo environment. Adds a spread of
 * complaints, service requests, projects, events, households, citizens and
 * satisfaction feedback across all five districts of Northern Province so the
 * province-level dashboard renders meaningful charts.
 *
 * Guard: only runs when the database is "thin" (fewer than 10 complaints) so a
 * re-run never duplicates data.
 */

const prisma = new PrismaClient();

interface ChainVillage {
  id: number;
  name: string;
  cellId: number;
  cell: { name: string; sector: { id: number; name: string; district: { id: number; name: string; provinceId: number } } };
}

const dayMs = 86400000;
const daysAgo = (days: number, hourOffset = 0) =>
  new Date(Date.now() - days * dayMs - Math.floor(Math.random() * 6) * 3600000 + hourOffset * 3600000);

const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const COMPLAINT_TITLES = [
  'Pothole on the main road',
  'Broken street light',
  'Dirty water supply',
  'Uncollected household waste',
  'Overcrowded classroom',
  'Missing road drainage',
  'Damaged bridge plank',
  'Noisy bar disturbing residents',
  'Stray animals on the road',
  'Illegal sand digging',
  'Community road blocked by landslide',
  'Lack of clean drinking water in the village',
  'Health centre stock out',
  'Land boundary dispute',
  'Flooded footpath',
  'Market garbage accumulation',
  'School fence vandalised',
  'Borehole pump not working',
  'Unsafe mud-brick classroom',
  'Street vendors blocking the road',
];

const REQUEST_TITLES = [
  'Request for family document',
  'Request for land title certificate',
  'Request for school transfer letter',
  'Request for community meeting',
  'Request for waste collection service',
  'Request for market stall allocation',
  'Request for birth certificate copy',
  'Request for road maintenance crew',
  'Application for cooperative membership',
  'Request for water connection',
  'Request for agricultural inputs',
  'Request for vocational training enrolment',
];

const PROJECT_TITLES = [
  'Village water access point',
  'Road rehabilitation bulk work',
  'Primary school classroom block',
  'Health post renovation',
  'Market shed construction',
  'Street lighting installation',
  'Wetland protection fencing',
  'Community resource centre',
  'Solar powered borehole',
  'Feeder road gravel upgrade',
  'Health centre maternity wing',
  'Playground and sports field',
];

const EVENT_TITLES = [
  'Umuganda community cleanup',
  'District farmer field day',
  'Village savings group meeting',
  'Open-air health screening',
  'Annual harvest festival',
  'Cooperatives trade expo',
];

const NEW_FULL_NAMES = ['Aloys Niyonzima', 'Chantal Uwase', 'Eric Nsengimana', 'Fatima Mukamana', 'Gad Mulisa', 'Helena Ingabire', 'Ivan Habimana', 'Jeanette Uwera', 'Kizito Bayisenge', 'Liliane Mukeshimana', 'Moses Nshuti', 'Nadine Umutoni', 'Olivier Rukundo', 'Patricie Kazigwemo', 'Quella Mutesi'];



async function main() {
  console.log('Checking sample data...');

  const complaintCount = await prisma.complaint.count();
  if (complaintCount >= 10) {
    console.log(`Database already has ${complaintCount} complaints. Sample expansion skipped (nothing to add).`);
    return;
  }

  console.log('Expanding sample data for the demo dashboard...');

  const province = await prisma.province.findFirst({ where: { code: 'NORTH' } });
  if (!province) throw new Error('Northern Province not found. Run `npm run db:seed` first.');

  const districts = await prisma.district.findMany({ where: { provinceId: province.id }, orderBy: { id: 'asc' } });
  const categories = await prisma.complaintCategory.findMany();
  const serviceTypes = await prisma.serviceType.findMany();
  const citizenRole = await prisma.role.findUnique({ where: { slug: 'CITIZEN' } });
  const provinceAdmin = await prisma.user.findUnique({ where: { username: 'province' } });
  if (!citizenRole || !provinceAdmin) throw new Error('Roles or province admin missing. Run `npm run db:seed` first.');

  const allVillages: ChainVillage[] = await prisma.village.findMany({
    include: { cell: { include: { sector: { include: { district: true } } } } },
  });

  const byDistrict = (dId: number) => allVillages.filter((v) => v.cell.sector.district.id === dId);

  // Deterministic sample: up to 6 villages spread across each district.
  const sampleVillages: ChainVillage[] = [];
  for (const d of districts) {
    const list = byDistrict(d.id);
    const step = Math.max(1, Math.floor(list.length / 6));
    sampleVillages.push(...list.filter((_, i) => i % step === 0).slice(0, 6));
  }

  if (sampleVillages.length < 5) throw new Error('Not enough villages to distribute sample data.');

  // ---------------------------------------------------------- sample citizens
  const citizenHash = await bcrypt.hash('Citizen@123', 10);
  const citizens: { id: number; village: ChainVillage; user: { id: number; fullName: string } }[] = [];
  let citizenIdx = 0;
  for (let vi = 0; vi < sampleVillages.length && citizenIdx < NEW_FULL_NAMES.length; vi += 1) {
    const village = sampleVillages[vi];
    const fullName = NEW_FULL_NAMES[citizenIdx];
    const username = `samplec${citizenIdx + 1}`;
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) continue;
    const user = await prisma.user.create({
      data: {
        fullName,
        username,
        email: `${username}@sample.gov.rw`,
        phone: `0788${String(900000 + citizenIdx * 7).padStart(6, '0')}`,
        passwordHash: citizenHash,
        roleId: citizenRole.id,
        provinceId: province.id,
        districtId: village.cell.sector.district.id,
        sectorId: village.cell.sector.id,
        cellId: village.cellId,
        villageId: village.id,
        status: 'ACTIVE',
      },
    });
    const profile = await prisma.citizen.create({
      data: {
        userId: user.id,
        villageId: village.id,
        nationalId: `120${String(900000000 + citizenIdx * 13).padStart(9, '0')}`,
        gender: citizenIdx % 2 === 0 ? 'Female' : 'Male',
      },
    });
    citizens.push({ id: profile.id, village, user });
    citizenIdx += 1;
  }

  if (citizens.length === 0) throw new Error('Could not create any sample citizens.');

  // ------------------------------------------------------------ households
  for (const c of citizens.slice(0, 10)) {
    const code = `SMP-${c.village.cell.sector.district.id}-${c.village.id}-H`;
    const existing = await prisma.household.findUnique({ where: { code } });
    if (!existing) {
      await prisma.household.create({
        data: { villageId: c.village.id, code, headName: c.user.fullName, members: rand(2, 8) },
      });
    }
  }

  const distIdOf = (v: ChainVillage) => v.cell.sector.district.id;
  const hierarchyOf = (v: ChainVillage) => ({
    provinceId: province.id,
    districtId: distIdOf(v),
    sectorId: v.cell.sector.id,
    cellId: v.cellId,
    villageId: v.id,
  });

  // ------------------------------------------------------------ complaints
  const STATUSES = ['SUBMITTED', 'RECEIVED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
  const PRIORITIES = ['LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'URGENT'] as const;
  const N_COMPLAINTS = 56;
  const complaints: { id: number; status: (typeof STATUSES)[number] }[] = [];

  for (let i = 0; i < N_COMPLAINTS; i++) {
    const village = pick(sampleVillages);
    const citizen = pick(citizens);
    const status = STATUSES[Math.floor((i * 7) % STATUSES.length)];
    const priority = PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)];
    const cat = pick(categories);
    const createdAt = daysAgo(rand(0, 29), rand(0, 20));

    const existing = await prisma.complaint.findUnique({ where: { complaintNo: `SMP-${NewCuid(i)}` } });
    if (existing) continue;
    const complaint = await prisma.complaint.create({
      data: {
        complaintNo: `SMP-${NewCuid(i)}`,
        citizenId: citizen.id,
        categoryId: cat.id,
        title: pick(COMPLAINT_TITLES),
        description: 'Sample complaint used to demonstrate the governance dashboard charts and monitoring views.',
        location: pick(['', 'Near the market', 'Main road', 'Around the school', 'Village centre', 'Near the borehole']),
        ...hierarchyOf(village),
        priority,
        status,
        assignedOfficerId: null,
        currentLevel: status === 'SUBMITTED' ? 5 : 1,
        resolution: ['RESOLVED', 'CLOSED'].includes(status) ? 'Issue resolved with the technical team and local leadership.' : null,
        resolutionDate: ['RESOLVED', 'CLOSED'].includes(status) ? daysAgo(rand(0, 3), rand(0, 12)) : null,
        createdAt,
        updatedAt: createdAt,
      },
    });
    complaints.push({ id: complaint.id, status });
  }

  // ------------------------------------------------------- satisfaction rating
  for (const c of complaints) {
    if (!['RESOLVED', 'CLOSED'].includes(c.status)) continue;
    const existing = await prisma.complaintFeedback.findUnique({ where: { complaintId: c.id } });
    if (!existing) {
      await prisma.complaintFeedback.create({
        data: { complaintId: c.id, citizenId: pick(citizens).id, rating: rand(3, 5), comment: pick(['Very satisfied', 'Mostly satisfied', 'Satisfied']) },
      });
    }
  }

  // ------------------------------------------------------- service requests
  const N_REQUESTS = 36;
  const R_STATUSES = ['SUBMITTED', 'IN_PROGRESS', 'RESOLVED'] as const;
  for (let i = 0; i < N_REQUESTS; i++) {
    const village = pick(sampleVillages);
    const citizen = pick(citizens);
    const status = R_STATUSES[i % R_STATUSES.length];
    const st = pick(serviceTypes);
    const createdAt = daysAgo(rand(0, 29), rand(0, 20));
    const existing = await prisma.serviceRequest.findUnique({ where: { requestNo: `SMPR-${NewCuid(i)}` } });
    if (existing) continue;
    await prisma.serviceRequest.create({
      data: {
        requestNo: `SMPR-${NewCuid(i)}`,
        citizenId: citizen.id,
        serviceTypeId: st.id,
        title: pick(REQUEST_TITLES),
        description: 'Sample service request used to demonstrate the service delivery monitoring dashboard.',
        ...hierarchyOf(village),
        status,
        currentLevel: status === 'SUBMITTED' ? 5 : 1,
        resolution: status === 'RESOLVED' ? 'Completed in line with the service charter.' : null,
        resolutionDate: status === 'RESOLVED' ? daysAgo(rand(0, 3), rand(0, 12)) : null,
        createdAt,
        updatedAt: createdAt,
      },
    });
  }

  // ---------------------------------------------------------------- projects
  const P_STATUSES = ['PLANNED', 'IN_PROGRESS', 'IN_PROGRESS', 'COMPLETED'] as const;
  for (let i = 0; i < PROJECT_TITLES.length; i++) {
    const village = pick(sampleVillages);
    const status = P_STATUSES[i % P_STATUSES.length];
    const progress = status === 'COMPLETED' ? 100 : status === 'PLANNED' ? 0 : rand(10, 85);
    const budget = rand(8, 120) * 1000000;
    const existing = await prisma.project.count({ where: { title: PROJECT_TITLES[i] } });
    if (existing > 0) continue;
    await prisma.project.create({
      data: {
        title: PROJECT_TITLES[i],
        description: 'Development project tracked on the governance platform.',
        location: pick(['', 'Sector office vicinity', 'Near village entrance', 'District service point']),
        ...hierarchyOf(village),
        level: status === 'COMPLETED' ? 1 : 5,
        startDate: daysAgo(rand(10, 90)),
        expectedEndDate: status === 'COMPLETED' ? daysAgo(rand(1, 8)) : new Date(Date.now() + rand(30, 240) * dayMs),
        budget,
        budgetSpent: Math.round(budget * (progress / 100)),
        fundingSource: pick(['District development fund', 'National budget', 'Development partner', 'Community contribution']),
        progress,
        status,
        beneficiaries: rand(60, 900),
        responsibleOfficerId: null,
        createdAt: daysAgo(rand(20, 100)),
        updatedAt: daysAgo(rand(0, 10)),
      },
    });
  }

  // ----------------------------------------------------------- events
  for (let i = 0; i < EVENT_TITLES.length; i++) {
    const village = pick(sampleVillages);
    const held = i % 2 === 0;
    const existing = await prisma.event.count({ where: { title: EVENT_TITLES[i] } });
    if (existing > 0) continue;
    await prisma.event.create({
      data: {
        title: EVENT_TITLES[i],
        description: 'Community gathering organised at sector level.',
        eventDate: held ? daysAgo(rand(1, 10)) : new Date(Date.now() + rand(5, 45) * dayMs),
        location: pick(['Sector office', 'Village square', 'District stadium']),
        organizer: pick(['Sector leadership', 'District office', 'Community cooperative']),
        provinceId: province.id,
        districtId: distIdOf(village),
        sectorId: village.cell.sector.id,
        cellId: village.cellId,
        villageId: village.id,
        status: held ? 'HELD' : 'PLANNED',
      },
    });
  }

  // ------------------------------------------------------------- reports
  for (let i = 0; i < 2; i++) {
    const village = pick(sampleVillages);
    const existing = await prisma.report.count({ where: { title: `Quarterly monitoring report ${i + 1}` } });
    if (existing > 0) continue;
    await prisma.report.create({
      data: {
        reportNo: `SMPREP${i}`,
        title: `Quarterly monitoring report ${i + 1}`,
        content: 'Consolidated performance narrative for the governance dashboard demo.',
        level: i === 0 ? 'PROVINCE' : 'DISTRICT',
        authorId: provinceAdmin.id,
        ...hierarchyOf(village),
        status: 'SUBMITTED',
        submittedAt: daysAgo(rand(1, 6)),
        createdAt: daysAgo(rand(2, 7)),
        updatedAt: daysAgo(rand(0, 3)),
      },
    });
  }

  const stats = await Promise.all([
    prisma.complaint.count(),
    prisma.serviceRequest.count(),
    prisma.project.count(),
    prisma.event.count(),
    prisma.citizen.count(),
    prisma.household.count(),
    prisma.complaintFeedback.count(),
    prisma.report.count(),
  ]);

  console.log('Sample data ready.');
  console.log(`  complaints: ${stats[0]}  requests: ${stats[1]}  projects: ${stats[2]}  events: ${stats[3]}`);
  console.log(`  citizens: ${stats[4]}  households: ${stats[5]}  feedback: ${stats[6]}  reports: ${stats[7]}`);
  console.log(`  sample villages used: ${sampleVillages.length}  sample citizens: ${citizens.length}`);
}

function NewCuid(i: number): string {
  // Deterministic, short unique token (13 chars) for sample complaint/request numbers.
  return `10${String(i).padStart(11, '0')}`;
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