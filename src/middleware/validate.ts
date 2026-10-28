import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { unprocessable } from '../lib/httpError';

export const validate =
  (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(unprocessable('Validation failed', result.error.flatten()));
    }
    // Write the cleaned value back so handlers always read parsed data:
    // unknown keys are stripped, defaults/coerces are applied, and mass
    // assignment through raw req.body is no longer possible.
    if (source === 'query') {
      // Express exposes req.query as a read-only getter that re-parses the
      // URL on each access, so merge in place where the object allows it.
      try {
        const q = req.query as Record<string, unknown>;
        for (const k of Object.keys(q)) delete q[k];
        Object.assign(q, result.data as Record<string, unknown>);
      } catch {
        /* getter is not writable: parsed value stays available below */
      }
    } else {
      (req as unknown as Record<string, unknown>)[source] = result.data;
    }
    (req as any).validated = { ...((req as any).validated ?? {}), [source]: result.data };
    next();
  };
