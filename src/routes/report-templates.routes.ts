import { Router } from 'express';
import { asyncHandler } from '../lib/httpError';
import { authenticate, requirePermission } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const router = Router();
router.use(authenticate);
const FILE = path.join(process.cwd(), 'uploads', 'report-templates.json');

function load(): any[] {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
}
function save(data: any[]) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }

router.get('/', asyncHandler(async (_req, res) => {
  res.json({ items: load() });
}));

router.post('/', requirePermission('reports.create'), asyncHandler(async (req, res) => {
  const items = load();
  const tmpl = { id: Date.now(), name: req.body.name, content: req.body.content, createdAt: new Date().toISOString() };
  items.push(tmpl);
  save(items);
  res.status(201).json({ template: tmpl });
}));

export default router;