import { Router } from 'express';
import type { Platform, PlatformCredentials } from '@sports-betting/shared';
import { adapterFactory } from '../adapters/adapterFactory.js';

const router = Router();

// POST /api/auth/connect - Connect to a platform
router.post('/connect', async (req, res, next) => {
  try {
    const credentials: PlatformCredentials = req.body;
    const adapter = adapterFactory.get(credentials.platform);
    await adapter.initialize(credentials);
    res.json({ success: true, platform: credentials.platform });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/status?platform=kalshi
router.get('/status', (req, res) => {
  const platform = req.query.platform as Platform;

  if (platform) {
    const adapter = adapterFactory.get(platform);
    res.json({
      platform,
      authenticated: adapter.isAuthenticated(),
    });
    return;
  }

  // Return status for all platforms
  const statuses = adapterFactory.getAll().map((a) => ({
    platform: a.platform,
    authenticated: a.isAuthenticated(),
  }));
  res.json(statuses);
});

export default router;
