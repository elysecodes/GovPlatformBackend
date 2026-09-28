import { PrismaClient } from '@prisma/client';

/**
 * Idempotent "filled system" sample data for the demo environment.
 * Fills the sections that seed-sample left empty or thin, so every page in the
 * frontend renders real-looking content:
 *
 *   tasks, meetings, announcements, cooperatives, households (with ubudehe),
 *   escalations, notifications, richer events + registrations, more reports,
 *   and assigned officers + comments on complaints/service requests.
 *
 * Guard: every insert keyed by a unique title/code/number that contains "DEMO",
 * so running this script more than once never duplicates rows.
 */

const prisma = new PrismaClient();

const dayMs = 86400000;
const daysAgo = (days: number) => new Date(Date.now() - days * dayMs);
const daysFromNow = (days: number) => new Date(Date.now() + days * dayMs);
const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const HEAD_NAMES = [
  'Alexis Mugabo', 'Beatrice Uwera', 'Celestin Niyibizi', 'Diane Mukamana', 'Emile Habimana',
  'Fidele Nkurunziza', 'Gorette Umuhoza', 'Hakim Nsengiyumva', 'Innocent Bizimana', 'Jeanne dArc Mukeshimana',
  'Karim Ndayisaba', 'Leticia Uwase', 'Marc Ngabo', 'Nelly Mbabazi', 'Oscar Rukundo',
  'Philomene Nyirahabimana', 'Quest Niyonkuru', 'Rose Mukarugwiza', 'Samuel Byiringiro', 'Tresor Nsabimana',
  'Uwimana Claire', 'Vincent Kayitare', 'Willy Mugisha', 'Yvette Uwimana', 'Zacharia Ndinzi',
  'Alphonse Sibomana', 'Blandine Mukeshimana', 'Claude Iradukunda', 'Delphine Uwamahoro', 'Erneste Nshimiyimana',
  'Florence Mukandayisenga', 'Gaspard Munyaneza', 'Honore Ntambara', 'Ildephonse Hakizimana', 'Josephine Uwimbabazi',
  'Kamanzi Eric', 'Laurent Murenzi', 'Marie Mukandoli', 'Narcisse Ndagijimana', 'Olive Uwacu',
  'Pacific Nsengimana', 'Rachel Umutoni', 'Silas Nkurikiyimana', 'Thierry Hategekimana', 'Venant Kanyabashi',
];

const TASKS: { title: string; status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED'; priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' }[] = [
  { title: 'DEMO Collect ubudehe registration forms', status: 'IN_PROGRESS', priority: 'HIGH' },
  { title: 'DEMO Organise community clean-up day', status: 'OPEN', priority: 'MEDIUM' },
  { title: 'DEMO Inspect borehole maintenance status', status: 'OPEN', priority: 'HIGH' },
  { title: 'DEMO Draft sector budget proposal', status: 'IN_PROGRESS', priority: 'URGENT' },
  { title: 'DEMO Verify vulnerable families list', status: 'COMPLETED', priority: 'HIGH' },
  { title: 'DEMO Coordinate farmers field day', status: 'OPEN', priority: 'LOW' },
  { title: 'DEMO Follow up road repair repair crew', status: 'IN_PROGRESS', priority: 'URGENT' },
  { title: 'DEMO Update village registry records', status: 'COMPLETED', priority: 'MEDIUM' },
  { title: 'DEMO Distribute school materials', status: 'COMPLETED', priority: 'MEDIUM' },
  { title: 'DEMO Audit cooperative savings records', status: 'OPEN', priority: 'HIGH' },
  { title: 'DEMO Prepare cell security meeting agenda', status: 'ARCHIVED', priority: 'MEDIUM' },
  { title: 'DEMO Map street lights outage list', status: 'ARCHIVED', priority: 'LOW' },
];

const MEETINGS: { title: string; status: 'PLANNED' | 'HELD' | 'CANCELLED'; daysOffset: number; depth: 'village' | 'cell' | 'sector' | 'district'; minutes?: string }[] = [
  { title: 'DEMO Monthly village development council', status: 'HELD', daysOffset: -6, depth: 'village', minutes: 'Resolved to fast-track the borehole repair and to organise the next umuganda on the third Saturday.' },
  { title: 'DEMO District planning coordination meeting', status: 'HELD', daysOffset: -12, depth: 'district', minutes: 'Sector presentations completed; budget ceilings agreed for the next fiscal year.' },
  { title: 'DEMO Cell leaders security briefing', status: 'HELD', daysOffset: -3, depth: 'cell', minutes: 'Community policing contacts updated; night patrol rota confirmed.' },
  { title: 'DEMO Village budget consultation', status: 'PLANNED', daysOffset: 5, depth: 'village' },
  { title: 'DEMO Sector agriculture campaign launch', status: 'PLANNED', daysOffset: 9, depth: 'sector' },
  { title: 'DEMO Cell youth employment workshop', status: 'PLANNED', daysOffset: 14, depth: 'cell' },
  { title: 'DEMO District infrastructure review', status: 'CANCELLED', daysOffset: -2, depth: 'district' },
  { title: 'DEMO Village savings group orientation', status: 'CANCELLED', daysOffset: 3, depth: 'village' },
];

const ANNOUNCEMENTS: { title: string; content: string; targetLevel: number; status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED'; pubOffsetDays: number; expOffsetDays: number | null }[] = [
  { title: 'DEMO Umuganda community clean-up this Saturday', content: 'All residents are invited to participate in the monthly community work from 8:00 AM. Tools are provided at the village square.', targetLevel: 6, status: 'PUBLISHED', pubOffsetDays: -1, expOffsetDays: 4 },
  { title: 'DEMO Farmers field day - register your produce', content: 'Cooperative members are invited to showcase produce at the district farmers field day. Registration closes Friday.', targetLevel: 5, status: 'PUBLISHED', pubOffsetDays: -2, expOffsetDays: 7 },
  { title: 'DEMO Villages to update household registries', content: 'Village administrators must submit their household ubudehe updates before the end of the month.', targetLevel: 5, status: 'PUBLISHED', pubOffsetDays: -5, expOffsetDays: 12 },
  { title: 'DEMO Health screening outreach at sector offices', content: 'Free blood-pressure and malaria screening is available at each sector office this week.', targetLevel: 6, status: 'PUBLISHED', pubOffsetDays: -3, expOffsetDays: 2 },
  { title: 'DEMO Water supply maintenance notice', content: 'Planned maintenance may interrupt borehole supply in several cells on Thursday morning.', targetLevel: 4, status: 'EXPIRED', pubOffsetDays: -12, expOffsetDays: -4 },
  { title: 'DEMO Previous harvest festival announcement', content: 'Archive copy: the harvest festival concluded successfully with 40 cooperative stalls.', targetLevel: 6, status: 'ARCHIVED', pubOffsetDays: -60, expOffsetDays: -45 },
  { title: 'DEMO Upcoming cooperatives trade expo', content: 'Traders and farmers are encouraged to reserve stalls for the upcoming trade expo.', targetLevel: 3, status: 'SCHEDULED', pubOffsetDays: 3, expOffsetDays: 25 },
  { title: 'DEMO Draft announcement - draft meeting minutes', content: 'Draft copy of minutes for internal review before publishing.', targetLevel: 5, status: 'DRAFT', pubOffsetDays: 0, expOffsetDays: null },
];

const COOPERATIVES: { name: string; activity: string; leaderName: string; members: number; status: 'ACTIVE' | 'CLOSED' }[] = [
  { name: 'DEMO Ubumwe Farmers Cooperative', activity: 'Crop farming and produce marketing', leaderName: 'Jean Bosco Namunsi', members: 42, status: 'ACTIVE' },
  { name: 'DEMO Isoko Savings Group', activity: 'Village savings and loans', leaderName: 'Aline Mukankusi', members: 28, status: 'ACTIVE' },
  { name: 'DEMO Gikoni Dairy Union', activity: 'Milk collection and dairy farming', leaderName: 'Faustin Niyonzima', members: 55, status: 'ACTIVE' },
  { name: 'DEMO Abahinzi Potato Group', activity: 'Potato cultivation and cold storage', leaderName: 'Emmanuel Nkurunziza', members: 61, status: 'ACTIVE' },
  { name: 'DEMO Ubushobozi Craft Collective', activity: 'Handicrafts and weaving', leaderName: 'Josepha Uwera', members: 19, status: 'ACTIVE' },
  { name: 'DEMO Icyerekezo Beekeepers', activity: 'Honey production', leaderName: 'Damascene Nsengiyumva', members: 24, status: 'CLOSED' },
  { name: 'DEMO Turere Fish Farming Coop', activity: 'Fish farming in wetlands', leaderName: 'Patrice Ndayambaje', members: 33, status: 'CLOSED' },
];

const EVENT_EXTRAS: { title: string; description: string; status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'; daysOffset: number; organizer: string }[] = [
  { title: 'DEMO Village savings group meeting', description: 'Bi-weekly savings and loans meeting for cooperative members.', status: 'ACTIVE', daysOffset: 0, organizer: 'Isoko Savings Group' },
  { title: 'DEMO Open-air health screening', description: 'Free screening for blood pressure, malaria and maternal health checks.', status: 'PLANNED', daysOffset: 6, organizer: 'District health office' },
  { title: 'DEMO Cooperatives trade expo', description: 'Showcase day for cooperatives with 40+ stalls and product tasting.', status: 'PLANNED', daysOffset: 18, organizer: 'Cooperatives division' },
  { title: 'DEMO School sports tournament qualifier', description: 'Inter-school volleyball qualifiers at the community pitch.', status: 'CANCELLED', daysOffset: -1, organizer: 'Sector education office' },
];

const REPORTS: { title: string; content: string; level: 'DISTRICT' | 'SECTOR' | 'CELL'; status: string; daysOffset: number; authorRole: 'DISTRICT_ADMIN' | 'SECTOR_ADMIN' | 'CELL_ADMIN'; reviewAction?: 'APPROVED' | 'REJECTED' | 'REVISION'; reviewComment?: string }[] = [
  { title: 'DEMO Quarterly district performance report', content: 'Consolidated district performance across complaints, service delivery and project implementation for the last quarter.', level: 'DISTRICT', status: 'UNDER_REVIEW', daysOffset: -3, authorRole: 'DISTRICT_ADMIN', reviewAction: undefined },
  { title: 'DEMO Sector health campaign report', content: 'Health outreach results across the sector including screening counts and referral outcomes.', level: 'SECTOR', status: 'APPROVED', daysOffset: -8, authorRole: 'SECTOR_ADMIN', reviewAction: 'APPROVED', reviewComment: 'Well structured, approve for finalization.' },
  { title: 'DEMO Cell infrastructure assessment', content: 'Field assessment of road, water and lighting assets in the cell with recommended maintenance needs.', level: 'CELL', status: 'FINALIZED', daysOffset: -20, authorRole: 'CELL_ADMIN', reviewAction: 'APPROVED', reviewComment: 'Approved and finalized.' },
];

async function main() {
  console.log('Running workshop sample-data filler...');

  const province = await prisma.province.findFirst({ where: { code: 'NORTH' } });
  if (!province) throw new Error('Northern Province not found. Run `npm run db:seed` first.');
  const districts = await prisma.district.findMany({ where: { provinceId: province.id }, orderBy: { id: 'asc' } });
  const provinceAdmin = await prisma.user.findUnique({ where: { username: 'province' } });
  if (!provinceAdmin) throw new Error('Province admin missing. Run `npm run db:seed` first.');

  const allVillages = await prisma.village.findMany({ include: { cell: { include: { sector: { include: { district: true } } } } } });
  const byDistrict = (dId: number) => allVillages.filter((v) => v.cell.sector.district.id === dId);
  const sampleVillages: typeof allVillages = [];
  for (const d of districts) {
    const list = byDistrict(d.id);
    if (!list.length) continue;
    const step = Math.max(1, Math.floor(list.length / 6));
    sampleVillages.push(...list.filter((_, i) => i % step === 0).slice(0, 6));
  }
  if (sampleVillages.length < 5) throw new Error('Not enough villages for sample data.');
  const sampleIds = sampleVillages.map((v) => v.id);

  // ---------------- officers ----------------
  const villageAdmins = await prisma.user.findMany({
    where: { role: { slug: 'VILLAGE_ADMIN' }, status: 'ACTIVE', villageId: { in: sampleIds } },
    select: { id: true, fullName: true, villageId: true },
  });
  const adminByVillage = new Map<number, { id: number; fullName: string; villageId: number | null }>();
  for (const a of villageAdmins) adminByVillage.set(a.villageId ?? -1, a);
  if (adminByVillage.size === 0) throw new Error('No village admins available in sample villages.');
  const officerPool = villageAdmins.map((v) => ({ id: v.id, fullName: v.fullName }));

  const cellAdmins = await prisma.user.findMany({
    where: { role: { slug: 'CELL_ADMIN' }, status: 'ACTIVE', cellId: { in: sampleVillages.map((v) => v.cellId) } },
    select: { id: true, fullName: true, cellId: true },
  });
  const cellAdminByCell = new Map<number, { id: number; fullName: string; cellId: number | null }>();
  for (const a of cellAdmins) cellAdminByCell.set(a.cellId ?? -1, a);
  const districtAdmins = await prisma.user.findMany({
    where: { role: { slug: 'DISTRICT_ADMIN' }, status: 'ACTIVE', districtId: { in: districts.map((d) => d.id) } },
    select: { id: true, fullName: true, districtId: true },
  });
  const sectorAdmins = await prisma.user.findMany({
    where: { role: { slug: 'SECTOR_ADMIN' }, status: 'ACTIVE', sectorId: { in: sampleVillages.map((v) => v.cell.sectorId) } },
    select: { id: true, fullName: true, sectorId: true },
  });
  const cellAdminAny = await prisma.user.findFirst({ where: { role: { slug: 'CELL_ADMIN' }, status: 'ACTIVE' }, select: { id: true } });

  const officer = (exclude: number | null = null) => {
    const pool = officerPool.filter((o) => o.id !== exclude);
    return pick(pool.length ? pool : officerPool);
  };

  // ---------------- tasks ----------------
  let tasksCreated = 0;
  for (let i = 0; i < TASKS.length; i++) {
    const t = TASKS[i];
    const existing = await prisma.task.findFirst({ where: { title: t.title } });
    if (existing) continue;
    const assignee = officer();
    const taskDone = t.status === 'COMPLETED' || t.status === 'ARCHIVED';
    const payload: any = {
      title: t.title,
      description: 'Sample task used to demonstrate the leader task tracker.',
      assigneeId: assignee.id,
      assignedById: provinceAdmin.id,
      priority: t.priority,
      dueDate: taskDone ? daysAgo(1) : daysFromNow(rand(2, 12)),
      status: t.status,
      completedAt: t.status === 'COMPLETED' ? daysAgo(rand(1, 5)) : null,
      createdAt: daysAgo(rand(3, 18)),
    };
    payload.updatedAt = daysAgo(rand(0, 2));
    await prisma.task.create({ data: payload });
    tasksCreated += 1;
  }

  // ---------------- meetings ----------------
  let meetingsCreated = 0;
  for (const m of MEETINGS) {
    const existing = await prisma.meeting.findFirst({ where: { title: m.title } });
    if (existing) continue;
    const village = pick(sampleVillages);
    const date = new Date(Date.now() + m.daysOffset * dayMs);
    const data: any = {
      title: m.title,
      description: 'Sample town-hall meeting used to demonstrate the meetings tracker.',
      meetingDate: date,
      location: m.depth === 'district' ? 'District office' : m.depth === 'sector' ? 'Sector office' : m.depth === 'cell' ? 'Cell centre' : 'Village square',
      agenda: '1. Progress review 2. Resident concerns 3. Next steps',
      organizer: m.depth === 'district' ? 'District office' : m.depth === 'sector' ? 'Sector leadership' : m.depth === 'cell' ? 'Cell leadership' : 'Village council',
      provinceId: province.id,
      status: m.status,
    };
    if (m.depth === 'district') data.districtId = village.cell.sector.districtId;
    else if (m.depth === 'sector') { data.districtId = village.cell.sector.districtId; data.sectorId = village.cell.sectorId; }
    else if (m.depth === 'cell') { data.districtId = village.cell.sector.districtId; data.sectorId = village.cell.sectorId; data.cellId = village.cellId; }
    else { data.districtId = village.cell.sector.districtId; data.sectorId = village.cell.sectorId; data.cellId = village.cellId; data.villageId = village.id; }
    if (m.status === 'HELD') { data.heldById = provinceAdmin.id; data.minutes = m.minutes ?? 'Minutes recorded during the meeting.'; }
    data.createdAt = daysAgo(rand(5, 20));
    await prisma.meeting.create({ data });
    meetingsCreated += 1;
  }

  // ---------------- announcements ----------------
  let announcementsCreated = 0;
  for (const a of ANNOUNCEMENTS) {
    const existing = await prisma.announcement.findFirst({ where: { title: a.title } });
    if (existing) continue;
    await prisma.announcement.create({
      data: {
        title: a.title,
        content: a.content,
        authorId: provinceAdmin.id,
        targetLevel: a.targetLevel,
        scopeAll: true,
        provinceId: province.id,
        status: a.status,
        publicationDate: new Date(Date.now() + a.pubOffsetDays * dayMs),
        expirationDate: a.expOffsetDays === null ? null : new Date(Date.now() + a.expOffsetDays * dayMs),
        createdAt: daysAgo(rand(2, 30)),
      },
    });
    announcementsCreated += 1;
  }

  // ---------------- cooperatives ----------------
  let cooperativesCreated = 0;
  for (const c of COOPERATIVES) {
    const existing = await prisma.cooperative.findFirst({ where: { name: c.name } });
    if (existing) continue;
    await prisma.cooperative.create({
      data: {
        name: c.name,
        description: 'Sample socio-economic group registered on the governance platform.',
        activity: c.activity,
        leaderName: c.leaderName,
        membersCount: c.members,
        villageId: pick(sampleVillages).id,
        status: c.status,
        createdAt: daysAgo(rand(30, 400)),
      },
    });
    cooperativesCreated += 1;
  }

  // ---------------- households + ubudehe ----------------
  let householdsCreated = 0;
  const existingHouseholds = await prisma.household.findMany();
  for (const h of existingHouseholds) {
    if (!h.ubudehe) {
      await prisma.household.update({ where: { id: h.id }, data: { ubudehe: String(rand(1, 4)) } });
    }
  }
  for (const village of sampleVillages) {
    const per = rand(3, 5);
    for (let j = 0; j < per; j++) {
      const code = `DEMO-${village.id}-H${j + 1}`;
      const existing = await prisma.household.findUnique({ where: { code } });
      if (existing) continue;
      await prisma.household.create({
        data: {
          villageId: village.id,
          code,
          headName: `${pick(HEAD_NAMES)} ${pick(HEAD_NAMES)}`,
          members: rand(2, 9),
          ubudehe: String(rand(1, 4)),
          createdById: provinceAdmin.id,
          createdAt: daysAgo(rand(10, 90)),
        },
      });
      householdsCreated += 1;
    }
  }

  // ---------------- normalize events: HELD -> COMPLETED + report + extra events + registrations ----------------
  const legacyEvents = await prisma.event.findMany({ where: { status: 'HELD' } });
  for (const ev of legacyEvents) {
    await prisma.event.update({ where: { id: ev.id }, data: { status: 'COMPLETED', report: 'The event was completed successfully with strong participation from the community.' } });
  }
  let eventsCreated = 0;
  for (const e of EVENT_EXTRAS) {
    const existing = await prisma.event.findFirst({ where: { title: e.title } });
    if (existing) continue;
    const village = pick(sampleVillages);
    await prisma.event.create({
      data: {
        title: e.title,
        description: e.description,
        eventDate: new Date(Date.now() + e.daysOffset * dayMs),
        location: pick(['Sector office', 'Village square', 'District stadium']),
        organizer: e.organizer,
        provinceId: province.id,
        districtId: village.cell.sector.districtId,
        sectorId: village.cell.sectorId,
        cellId: village.cellId,
        villageId: village.id,
        status: e.status,
        report: e.status === 'COMPLETED' ? 'Event completed with positive community feedback.' : null,
        createdAt: daysAgo(rand(3, 15)),
      },
    });
    eventsCreated += 1;
  }
  // A couple of upcoming events pinned to the villages where the first sample
  // citizens live, so the citizen agenda view renders content.
  for (let i = 0; i < Math.min(2, sampleVillages.length); i++) {
    const village = sampleVillages[i];
    const title = `DEMO ${village.name} cooperative showcase`;
    const existing = await prisma.event.findFirst({ where: { title } });
    if (existing) continue;
    await prisma.event.create({
      data: {
        title,
        description: 'Neighbourhood showcase of cooperative products open to all residents.',
        eventDate: daysFromNow(rand(4, 12)),
        location: 'Village square',
        organizer: 'Cooperatives division',
        provinceId: province.id,
        districtId: village.cell.sector.districtId,
        sectorId: village.cell.sectorId,
        cellId: village.cellId,
        villageId: village.id,
        status: 'PLANNED',
        createdAt: daysAgo(rand(1, 4)),
      },
    });
    eventsCreated += 1;
  }
  // Register sample citizens to upcoming events in their own village.
  const upcomingEvents = await prisma.event.findMany({
    where: { status: { in: ['PLANNED', 'ACTIVE'] }, villageId: { in: sampleIds } },
    orderBy: { eventDate: 'asc' },
    take: 4,
  });
  const sampleCitizens = await prisma.citizen.findMany({ where: { villageId: { in: sampleIds } }, take: 20 });
  for (const ev of upcomingEvents) {
    const citizensHere = sampleCitizens.filter((c) => c.villageId === ev.villageId);
    const person = citizensHere.length ? pick(citizensHere) : pick(sampleCitizens);
    const already = await prisma.eventParticipant.findFirst({ where: { eventId: ev.id, citizenId: person.id } });
    if (!already) await prisma.eventParticipant.create({ data: { eventId: ev.id, citizenId: person.id } });
  }

  // ---------------- escalations (on real complaints + requests) ----------------
  let escalationsCreated = 0;
  const escalatable = await prisma.complaint.findMany({
    where: { status: { in: ['SUBMITTED', 'RECEIVED', 'IN_PROGRESS', 'ASSIGNED'] }, villageId: { in: sampleIds } },
    take: 6,
    include: { village: { include: { cell: true } } },
  });
  for (let i = 0; i < Math.min(4, escalatable.length); i++) {
    const c = escalatable[i];
    const fromOfficer = adminByVillage.get(c.villageId) ?? pick(villageAdmins);
    const toOfficer = cellAdminByCell.get(c.village.cellId) ?? (cellAdminAny as { id: number } | null);
    if (!toOfficer) continue;
    const resolved = i % 2 === 0;
    const existing = await prisma.escalation.findFirst({ where: { entity: 'COMPLAINT', entityId: c.id } });
    if (existing) continue;
    await prisma.escalation.create({
      data: {
        entity: 'COMPLAINT',
        entityId: c.id,
        fromLevel: 5,
        toLevel: 4,
        fromUserId: fromOfficer.id,
        toUserId: toOfficer.id,
        reason: 'DEMO Sample escalation: the case requires cell-level coordination to resolve.',
        status: resolved ? 'RESOLVED' : 'PENDING',
        resolvedAt: resolved ? daysAgo(rand(1, 4)) : null,
        createdAt: daysAgo(rand(2, 8)),
      },
    });
    if (!resolved) {
      await prisma.complaint.update({ where: { id: c.id }, data: { status: 'ESCALATED', currentLevel: 4, assignedOfficerId: null } });
    }
    escalationsCreated += 1;
  }
  const escalatableReq = await prisma.serviceRequest.findMany({
    where: { status: { in: ['SUBMITTED', 'RECEIVED', 'IN_PROGRESS', 'ASSIGNED'] }, villageId: { in: sampleIds } },
    take: 2,
    include: { village: { include: { cell: true } } },
  });
  for (let i = 0; i < escalatableReq.length; i++) {
    const r = escalatableReq[i];
    const fromOfficer = adminByVillage.get(r.villageId) ?? pick(villageAdmins);
    const toOfficer = cellAdminByCell.get(r.village.cellId) ?? (cellAdminAny as { id: number } | null);
    if (!toOfficer) continue;
    const existing = await prisma.escalation.findFirst({ where: { entity: 'SERVICE_REQUEST', entityId: r.id } });
    if (existing) continue;
    await prisma.escalation.create({
      data: {
        entity: 'SERVICE_REQUEST',
        entityId: r.id,
        fromLevel: 5,
        toLevel: 4,
        fromUserId: fromOfficer.id,
        toUserId: toOfficer.id,
        reason: 'DEMO Sample escalation: service request needs a higher-level response.',
        status: 'PENDING',
        createdAt: daysAgo(rand(1, 5)),
      },
    });
    await prisma.serviceRequest.update({ where: { id: r.id }, data: { status: 'ESCALATED', currentLevel: 4, assignedOfficerId: null } });
    escalationsCreated += 1;
  }

  // ---------------- assign officers to complaints + requests, add a few comments ----------------
  const toAssign = await prisma.complaint.findMany({
    where: { status: { in: ['RECEIVED', 'IN_PROGRESS', 'ASSIGNED'] }, assignedOfficerId: null, villageId: { in: sampleIds } },
    take: 8,
  });
  for (const c of toAssign) {
    const target = adminByVillage.get(c.villageId) ?? officer();
    await prisma.complaint.update({ where: { id: c.id }, data: { assignedOfficerId: target.id, currentLevel: 5, status: c.status === 'RECEIVED' ? 'ASSIGNED' : c.status } });
  }
  const assignComments = await prisma.complaint.findMany({
    where: { comments: { none: {} }, villageId: { in: sampleIds } },
    take: 4,
  });
  for (const c of assignComments) {
    const admin = adminByVillage.get(c.villageId) ?? provinceAdmin;
    const comment = pick(['The case has been reviewed and the technical team has been notified.', 'We inspected the site today and started the repair works.', 'Awaiting materials from the district store, expected this week.']);
    if (await prisma.complaintComment.findFirst({ where: { complaintId: c.id, comment } })) continue;
    await prisma.complaintComment.create({ data: { complaintId: c.id, userId: admin.id, comment, createdAt: daysAgo(rand(1, 6)) } });
  }
  const reqToAssign = await prisma.serviceRequest.findMany({
    where: { status: { in: ['RECEIVED', 'IN_PROGRESS', 'ASSIGNED'] }, assignedOfficerId: null, villageId: { in: sampleIds } },
    take: 4,
  });
  for (const r of reqToAssign) {
    const target = adminByVillage.get(r.villageId) ?? officer();
    await prisma.serviceRequest.update({ where: { id: r.id }, data: { assignedOfficerId: target.id, currentLevel: 5, status: r.status === 'RECEIVED' ? 'ASSIGNED' : r.status } });
  }

  // ---------------- reports ----------------
  let reportsCreated = 0;
  for (const rep of REPORTS) {
    const existing = await prisma.report.findFirst({ where: { title: rep.title } });
    if (existing) continue;
    const village = pick(sampleVillages);
    let authorId = provinceAdmin.id;
    if (rep.authorRole === 'DISTRICT_ADMIN') {
      const da = districtAdmins.find((d) => d.districtId === village.cell.sector.districtId) ?? districtAdmins[0];
      authorId = da?.id ?? provinceAdmin.id;
    } else if (rep.authorRole === 'SECTOR_ADMIN') {
      const sa = sectorAdmins.find((s) => s.sectorId === village.cell.sectorId) ?? sectorAdmins[0];
      authorId = sa?.id ?? provinceAdmin.id;
    } else {
      const ca = cellAdmins.find((x) => x.cellId === village.cellId);
      authorId = ca?.id ?? cellAdminAny?.id ?? provinceAdmin.id;
    }
    const created = await prisma.report.create({
      data: {
        reportNo: `DEMOREP${reportsCreated}`,
        title: rep.title,
        content: rep.content,
        level: rep.level,
        authorId,
        provinceId: province.id,
        districtId: village.cell.sector.districtId,
        sectorId: village.cell.sectorId,
        cellId: village.cellId,
        villageId: village.id,
        status: rep.status,
        submittedAt: daysAgo(rep.daysOffset + 2),
        ...(rep.reviewAction
          ? { reviewedById: provinceAdmin.id, reviewedAt: daysAgo(rep.daysOffset), reviewComment: rep.reviewComment ?? null }
          : {}),
        createdAt: daysAgo(rep.daysOffset + 3),
      },
    });
    if (rep.reviewAction) {
      await prisma.reportReview.create({
        data: { reportId: created.id, reviewerId: provinceAdmin.id, action: rep.reviewAction, comment: rep.reviewComment ?? null, createdAt: daysAgo(rep.daysOffset) },
      });
    }
    reportsCreated += 1;
  }

  // ---------------- notifications (province admin + officers) ----------------
  let notificationsCreated = 0;
  const notifTargets = [provinceAdmin.id, ...officerPool.slice(0, 3).map((o) => o.id)];
  const sampleNotifs: { title: string; content: string; type: string; link: string }[] = [
    { title: 'New complaint submitted', content: '#DEMO-01 - Pothole on the main road was escalated to your office.', type: 'COMPLAINT', link: '/complaints' },
    { title: 'Task assigned to you', content: 'DEMO Collect ubudehe registration forms was assigned with HIGH priority.', type: 'TASK', link: '/tasks' },
    { title: 'New meeting scheduled', content: 'Village budget consultation has been scheduled for next week.', type: 'MEETING', link: '/meetings' },
    { title: 'Report submitted for review', content: 'Quarterly district performance report is awaiting your review.', type: 'REPORT', link: '/reports' },
    { title: 'New announcement published', content: 'Umuganda community clean-up this Saturday.', type: 'ANNOUNCEMENT', link: '/announcements' },
  ];
  for (const uid of notifTargets) {
    for (let k = 0; k < sampleNotifs.length; k++) {
      const existing = await prisma.notification.findFirst({ where: { userId: uid, title: sampleNotifs[k].title } });
      if (existing) continue;
      await prisma.notification.create({
        data: {
          userId: uid,
          title: sampleNotifs[k].title,
          content: sampleNotifs[k].content,
          type: sampleNotifs[k].type,
          link: sampleNotifs[k].link,
          readAt: k % 2 === 0 ? null : daysAgo(rand(0, 2)),
          createdAt: daysAgo(rand(0, 5)),
        },
      });
      notificationsCreated += 1;
    }
  }

  const stats = {
    tasks: await prisma.task.count(),
    meetings: await prisma.meeting.count(),
    announcements: await prisma.announcement.count(),
    cooperatives: await prisma.cooperative.count(),
    households: await prisma.household.count(),
    events: await prisma.event.count(),
    escalations: await prisma.escalation.count(),
    notifications: await prisma.notification.count(),
    reports: await prisma.report.count(),
    complaintsAssigned: await prisma.complaint.count({ where: { NOT: { assignedOfficerId: null } } }),
    participants: await prisma.eventParticipant.count(),
  };

  console.log('Workshop sample data ready.');
  console.log(`  tasks: ${stats.tasks}  meetings: ${stats.meetings}  announcements: ${stats.announcements}`);
  console.log(`  cooperatives: ${stats.cooperatives}  households: ${stats.households}  events: ${stats.events}`);
  console.log(`  escalations: ${stats.escalations}  notifications: ${stats.notifications}  reports: ${stats.reports}`);
  console.log(`  participants: ${stats.participants}  complaintsAssigned: ${stats.complaintsAssigned}`);
  console.log(`  created: tasks=${tasksCreated} meetings=${meetingsCreated} announcements=${announcementsCreated} cooperatives=${cooperativesCreated} households=${householdsCreated} events=${eventsCreated} escalations=${escalationsCreated} notifications=${notificationsCreated} reports=${reportsCreated}`);
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