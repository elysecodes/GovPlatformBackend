import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/httpError';
import { authenticate } from '../middleware/auth';
import { getScope, scopeVillageIds } from '../services/scope.service';
import { parsePagination } from '../utils/pagination';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) {
    res.json({ results: [] });
    return;
  }
  const scope = await getScope(req.user!.id);
  const villageIds = await scopeVillageIds(scope);

  const [complaints, requests, reports, meetings, announcements] = await Promise.all([
    prisma.complaint.findMany({
      where: { villageId: { in: villageIds }, OR: [{ title: { contains: q } }, { description: { contains: q } }, { complaintNo: { contains: q } }] },
      select: { id: true, complaintNo: true, title: true, status: true },
      take: 10,
    }),
    prisma.serviceRequest.findMany({
      where: { villageId: { in: villageIds }, OR: [{ title: { contains: q } }, { description: { contains: q } }] },
      select: { id: true, title: true, status: true },
      take: 10,
    }),
    prisma.report.findMany({
      where: { villageId: { in: villageIds }, OR: [{ title: { contains: q } }, { reportNo: { contains: q } }] },
      select: { id: true, reportNo: true, title: true, status: true },
      take: 10,
    }),
    prisma.meeting.findMany({
      where: { villageId: { in: villageIds }, OR: [{ title: { contains: q } }, { agenda: { contains: q } }, { location: { contains: q } }] },
      select: { id: true, title: true, status: true, meetingDate: true },
      take: 10,
    }),
    prisma.announcement.findMany({
      where: { OR: [{ title: { contains: q } }, { content: { contains: q } }] },
      select: { id: true, title: true, createdAt: true },
      take: 10,
    }),
  ]);

  res.json({
    results: [
      ...complaints.map((c) => ({ type: 'complaint', id: c.id, title: c.title, subtitle: c.complaintNo, status: c.status, link: `/complaints/${c.id}` })),
      ...requests.map((r) => ({ type: 'request', id: r.id, title: r.title, status: r.status, link: `/requests/${r.id}` })),
      ...reports.map((r) => ({ type: 'report', id: r.id, title: r.title, subtitle: r.reportNo, status: r.status, link: `/reports/${r.id}` })),
      ...meetings.map((m) => ({ type: 'meeting', id: m.id, title: m.title, status: m.status, link: `/meetings` })),
      ...announcements.map((a) => ({ type: 'announcement', id: a.id, title: a.title, link: `/announcements` })),
    ],
  });
}));

export default router;