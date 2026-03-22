import { Router } from 'express';
import type { Platform } from '@sports-betting/shared';
import { adapterFactory } from '../adapters/adapterFactory.js';

const router = Router();

// GET /api/orders?platform=kalshi
router.get('/', async (req, res, next) => {
  try {
    const platform = (req.query.platform as Platform) || 'kalshi';
    const adapter = adapterFactory.get(platform);
    const result = await adapter.getOrders({
      marketId: req.query.marketId as string,
      status: req.query.status as never,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/orders
router.post('/', async (req, res, next) => {
  try {
    const { platform, ...orderParams } = req.body;
    const adapter = adapterFactory.get(platform || 'kalshi');
    const order = await adapter.placeOrder(orderParams);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/orders/:id?platform=kalshi
router.delete('/:id', async (req, res, next) => {
  try {
    const platform = (req.query.platform as Platform) || 'kalshi';
    const adapter = adapterFactory.get(platform);
    await adapter.cancelOrder(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
