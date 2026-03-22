import { api } from './client';
import type { Position, Balance, PaginatedResult, Platform } from '@sports-betting/shared';

export async function fetchPositions(platform: Platform): Promise<PaginatedResult<Position>> {
  const { data } = await api.get('/positions', { params: { platform } });
  return data;
}

export async function fetchBalance(platform: Platform): Promise<Balance> {
  const { data } = await api.get('/balance', { params: { platform } });
  return data;
}
