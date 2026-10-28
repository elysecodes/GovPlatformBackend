import { prisma } from '../lib/prisma';
import { notifyLevel } from './notify.service';

const SLA_HOURS = parseInt(process.env.SLA_HOURS || '168', 10);

export async function runSlaEscalation(): Promise<{ escalated: number }> {
  const cutoff = new Date(Date.now() - SLA_HOURS * 60 * 60 * 1000);

  const stale = await prisma.complaint.findMany({
    where: {
      status: { in: ['SUBMITTED', 'ASSIGNED', 'UNDER_REVIEW', 'IN_PROGRESS'] },
      updatedAt: { lt: cutoff },
      currentLevel: { not: 1 },
    },
    take: 100,
  });

  let escalated = 0;
  for (const c of stale) {
    const nextLevel = c.currentLevel - 1;
    if (nextLevel < 1) continue;

    const levelName = nextLevel === 1 ? 'PROVINCE' : nextLevel === 2 ? 'DISTRICT' : nextLevel === 3 ? 'SECTOR' : nextLevel === 4 ? 'CELL' : 'VILLAGE';

    await prisma.complaint.update({
      where: { id: c.id },
      data: { currentLevel: nextLevel, status: 'ESCALATED', updatedAt: new Date() },
    });

    await prisma.complaintComment.create({
      data: {
        complaintId: c.id,
        userId: c.assignedOfficerId ?? 1,
        comment: `Auto-escalated after ${SLA_HOURS}h without resolution`,
      },
    });

    await notifyLevel(nextLevel, c.provinceId, c.districtId, c.sectorId, c.cellId, c.villageId,
      'Complaint auto-escalated', `Complaint ${c.complaintNo} escalated due to SLA breach`, 'COMPLAINT', `/complaints/${c.id}`);

    escalated++;
  }
  return { escalated };
}