import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest } from '../lib/httpError';
import { validate } from '../middleware/validate';
import { authenticate, requirePermission } from '../middleware/auth';
import { audit } from '../middleware/audit';
import { getScope, scopeVillageIds } from '../services/scope.service';
import { notify } from '../services/notify.service';
import { parsePagination, pageResponse } from '../utils/pagination';

const router = Router();
router.use(authenticate);

const sendSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(1).max(2000),
  link: z.string().max(300).optional().or(z.literal('')),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as any);
    const where = { userId: req.user!.id };
    const [total, items] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    ]);
    res.json(pageResponse(items, total, page, limit));
  }),
);

router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const count = await prisma.notification.count({
      where: { userId: req.user!.id, readAt: null },
    });
    res.json({ count });
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ message: 'All notifications marked as read' });
  }),
);

router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { id: Number(req.params.id), userId: req.user!.id },
      data: { readAt: new Date() },
    });
    res.json({ message: 'ok' });
  }),
);

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    await prisma.notification.deleteMany({ where: { userId: req.user!.id } });
    res.json({ message: 'All notifications deleted' });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { count } = await prisma.notification.deleteMany({
      where: { id: Number(req.params.id), userId: req.user!.id },
    });
    if (count === 0) throw badRequest('Notification not found');
    res.json({ message: 'Notification deleted' });
  }),
);

/**
 * Broadcasts an important notification to every citizen inside the leader's
 * administrative scope (a citizen user with a profile in the leader's villages).
 */
router.post(
  '/send',
  requirePermission('notifications.send'),
  validate(sendSchema),
  asyncHandler(async (req, res) => {
    const scope = await getScope(req.user!.id);
    const villageIds = await scopeVillageIds(scope);
    const citizens = await prisma.user.findMany({
      where: {
        role: { is: { slug: 'CITIZEN' } },
        status: 'ACTIVE',
        citizenProfile: { villageId: { in: villageIds } },
      },
      select: { id: true },
    });
    if (citizens.length === 0) throw badRequest('No registered citizens inside your administrative scope');

    for (const c of citizens) {
      await notify(
        c.id,
        req.body.title,
        req.body.content,
        'BROADCAST',
        req.body.link || undefined,
      );
    }
    await audit(req, 'NOTIFICATION_BROADCAST', 'NOTIFICATION', null, undefined, {
      recipients: citizens.length,
    });
    res.status(201).json({ sent: citizens.length });
  }),
);

export default router;