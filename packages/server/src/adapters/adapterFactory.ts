import type { Platform } from '@sports-betting/shared';
import type { PlatformAdapter } from './types.js';
import { KalshiAdapter } from './kalshi/index.js';
import { PolymarketAdapter } from './polymarket/index.js';
import { loadAllCredentials } from '../config/credentialStore.js';

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

  async restoreCredentials(): Promise<void> {
    const saved = loadAllCredentials();
    for (const creds of saved) {
      try {
        const adapter = this.adapters.get(creds.platform);
        if (adapter && !adapter.isAuthenticated()) {
          await adapter.initialize(creds);
          console.log(`[Auth] Restored credentials for ${creds.platform}`);
        }
      } catch (err) {
        console.warn(`[Auth] Failed to restore credentials for ${creds.platform}:`, err);
      }
    }
  }
}

export const adapterFactory = new AdapterFactory();
