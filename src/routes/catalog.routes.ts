import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, notFound } from '../lib/httpError';
import { validate } from '../middleware/validate';
import { optionalAuthenticate, authenticate } from '../middleware/auth';
import { getScope } from '../services/scope.service';
import { cacheGet, cacheSet } from '../lib/cache';

const router = Router();

const CATALOG_TTL = 10 * 60 * 1000; // geography is effectively static at runtime

/** read-through cached lookup for a repeatable query */
async function cached<T>(key: string, query: () => Promise<T>, ttlMs = CATALOG_TTL): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const value = await query();
  cacheSet(key, value, ttlMs);
  return value;
}

// Public read-only lookups (used by the registration page). A valid token is
// optional: when present, results are scoped to the user's administration area;
// anonymous callers see the full catalog.
router.use(optionalAuthenticate);

const unitIdSchema = z.object({ id: z.coerce.number().int().positive() });

/** List districts. Scoped to the caller's province when authenticated. */
router.get(
  '/districts',
  asyncHandler(async (req, res) => {
    const scope = req.user ? await getScope(req.user.id) : null;
    const key = `geo:cat:districts:${scope?.provinceId ?? 'all'}`;
    const items = await cached(key, () =>
      prisma.district.findMany({
        where: scope?.provinceId ? { provinceId: scope.provinceId } : {},
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true, _count: { select: { sectors: true } } },
      }),
    );
    res.json({ items });
  }),
);

router.get(
  '/districts/:id/sectors',
  validate(unitIdSchema, 'params'),
  asyncHandler(async (req, res) => {
    const scope = req.user ? await getScope(req.user.id) : null;
    const district = await prisma.district.findUnique({ where: { id: Number(req.params.id) } });
    if (!district) throw notFound('District not found');
    if (scope?.provinceId && district.provinceId !== scope.provinceId) throw notFound('District not found');
    const key = `geo:cat:sectors:${district.id}`;
    const items = await cached(key, () =>
      prisma.sector.findMany({
        where: { districtId: district.id },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true, _count: { select: { cells: true } } },
      }),
    );
    res.json({ items });
  }),
);

router.get(
  '/sectors/:id/cells',
  validate(unitIdSchema, 'params'),
  asyncHandler(async (req, res) => {
    const scope = req.user ? await getScope(req.user.id) : null;
    const sector = await prisma.sector.findUnique({ where: { id: Number(req.params.id) } });
    if (!sector) throw notFound('Sector not found');
    if (scope?.districtId && sector.districtId !== scope.districtId) throw notFound('Sector not found');
    const key = `geo:cat:cells:${sector.id}`;
    const items = await cached(key, () =>
      prisma.cell.findMany({
        where: { sectorId: sector.id },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true, _count: { select: { villages: true } } },
      }),
    );
    res.json({ items });
  }),
);

router.get(
  '/cells/:id/villages',
  validate(unitIdSchema, 'params'),
  asyncHandler(async (req, res) => {
    const scope = req.user ? await getScope(req.user.id) : null;
    const cell = await prisma.cell.findUnique({ where: { id: Number(req.params.id) } });
    if (!cell) throw notFound('Cell not found');
    if (scope?.sectorId && cell.sectorId !== scope.sectorId) throw notFound('Cell not found');
    const key = `geo:cat:villages:${cell.id}`;
    const items = await cached(key, () =>
      prisma.village.findMany({
        where: { cellId: cell.id },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
      }),
    );
    res.json({ items });
  }),
);

/** Public registration lookup: full chain for a village. */
router.get(
  '/village/:id/chain',
  validate(unitIdSchema, 'params'),
  asyncHandler(async (req, res) => {
    const chain = await cached(`geo:cat:chain:${req.params.id}`, () =>
      prisma.village.findUnique({
        where: { id: Number(req.params.id) },
        include: { cell: { include: { sector: { include: { district: { include: { province: true } } } } } } },
      }),
    );
    if (!chain) throw notFound('Village not found');
    res.json({
      province: chain.cell.sector.district.province,
      district: chain.cell.sector.district,
      sector: chain.cell.sector,
      cell: chain.cell,
      village: chain,
    });
  }),
);

/** The full scope tree for the current user (breadcrumbs / admin management). Requires auth. */
router.get(
  '/scope-tree',
  authenticate,
  asyncHandler(async (req, res) => {
    const scope = await getScope(req.user!.id);
    let village: { id: number; name: string } | null = null;
    if (scope.level >= 5 && scope.villageId) {
      const v = await prisma.village.findUnique({
        where: { id: scope.villageId },
        select: { id: true, name: true },
      });
      village = v;
    }
    res.json({ scope, village });
  }),
);

export default router;
