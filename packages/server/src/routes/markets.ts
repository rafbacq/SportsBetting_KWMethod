import { Router } from 'express';
import type { Platform } from '@sports-betting/shared';
import { adapterFactory } from '../adapters/adapterFactory.js';

const router = Router();

// GET /api/markets?platform=kalshi&status=open&search=&limit=20&cursor=
router.get('/', async (req, res, next) => {
  try {
    const platform = (req.query.platform as Platform) || 'kalshi';
    const adapter = adapterFactory.get(platform);
    const result = await adapter.getMarkets({
      status: req.query.status as 'open' | 'closed' | 'settled',
      search: req.query.search as string,
      category: req.query.category as string,
      cursor: req.query.cursor as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/markets/:id?platform=kalshi
router.get('/:id', async (req, res, next) => {
  try {
    const platform = (req.query.platform as Platform) || 'kalshi';
    const adapter = adapterFactory.get(platform);
    const market = await adapter.getMarket(req.params.id);
    res.json(market);
  } catch (err) {
    next(err);
  }
});

// GET /api/markets/:id/orderbook?platform=kalshi
router.get('/:id/orderbook', async (req, res, next) => {
  try {
    const platform = (req.query.platform as Platform) || 'kalshi';
    const adapter = adapterFactory.get(platform);
    const orderbook = await adapter.getOrderbook(req.params.id);
    res.json(orderbook);
  } catch (err) {
    next(err);
  }
});

// GET /api/markets/:id/history?platform=kalshi
router.get('/:id/history', async (req, res, next) => {
  try {
    const platform = (req.query.platform as Platform) || 'kalshi';
    const adapter = adapterFactory.get(platform);
    const history = await adapter.getMarketHistory(req.params.id);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

export default router;
