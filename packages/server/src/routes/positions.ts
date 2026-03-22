import { Router } from 'express';
import type { Platform } from '@sports-betting/shared';
import { adapterFactory } from '../adapters/adapterFactory.js';

const router = Router();

// GET /api/positions?platform=kalshi
router.get('/', async (req, res, next) => {
  try {
    const platform = (req.query.platform as Platform) || 'kalshi';
    const adapter = adapterFactory.get(platform);
    const result = await adapter.getPositions({
      status: req.query.status as 'open' | 'closed',
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
