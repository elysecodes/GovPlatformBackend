import { Router } from 'express';
import { asyncHandler } from '../lib/httpError';
import { authenticate, requirePermission } from '../middleware/auth';
import { runSlaEscalation } from '../services/sla.service';

const router = Router();
router.use(authenticate, requirePermission('complaints.manage'));

router.post('/run', asyncHandler(async (_req, res) => {
  const result = await runSlaEscalation();
  res.json(result);
}));

export default router;