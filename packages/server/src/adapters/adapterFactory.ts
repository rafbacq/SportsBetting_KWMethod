import type { Platform } from '@sports-betting/shared';
import type { PlatformAdapter } from './types.js';
import { KalshiAdapter } from './kalshi/index.js';
import { PolymarketAdapter } from './polymarket/index.js';

class AdapterFactory {
  private adapters = new Map<Platform, PlatformAdapter>();

  constructor() {
    this.register(new KalshiAdapter());
    this.register(new PolymarketAdapter());
  }

  private register(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  get(platform: Platform): PlatformAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new Error(`No adapter registered for platform: ${platform}`);
    }
    return adapter;
  }

  getAll(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const adapterFactory = new AdapterFactory();
