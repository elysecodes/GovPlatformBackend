import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, forbidden, notFound } from '../lib/httpError';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, ip: true, userAgent: true, createdAt: true, expiresAt: true, revokedAt: true },
  });
  res.json({ sessions });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const session = await prisma.session.findUnique({ where: { id: Number(req.params.id) } });
  if (!session) throw notFound('Session not found');
  if (session.userId !== req.user!.id) throw forbidden();
  await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  res.json({ message: 'Session revoked' });
}));

export default router;