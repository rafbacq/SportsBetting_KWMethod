import { Router } from 'express';
import type { Platform } from '@sports-betting/shared';
import { adapterFactory } from '../adapters/adapterFactory.js';

const router = Router();

// GET /api/balance?platform=kalshi
router.get('/', async (req, res, next) => {
  try {
    const platform = (req.query.platform as Platform) || 'kalshi';
    const adapter = adapterFactory.get(platform);
    const balance = await adapter.getBalance();
    res.json(balance);
  } catch (err) {
    next(err);
  }
});

export default router;
