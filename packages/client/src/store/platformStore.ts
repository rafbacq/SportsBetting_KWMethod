import { create } from 'zustand';
import type { Platform } from '@sports-betting/shared';

interface PlatformState {
  activePlatform: Platform;
  setActivePlatform: (platform: Platform) => void;
}

export const usePlatformStore = create<PlatformState>((set) => ({
  activePlatform: 'kalshi',
  setActivePlatform: (platform) => set({ activePlatform: platform }),
}));
