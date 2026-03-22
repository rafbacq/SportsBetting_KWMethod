import { api } from './client';
import type { Market, Orderbook, MarketHistory, PaginatedResult, Platform } from '@sports-betting/shared';

export async function fetchMarkets(params: {
  platform: Platform;
  status?: string;
  search?: string;
  category?: string;
  cursor?: string;
  limit?: number;
}): Promise<PaginatedResult<Market>> {
  const { data } = await api.get('/markets', { params });
  return data;
}

export async function fetchMarket(id: string, platform: Platform): Promise<Market> {
  const { data } = await api.get(`/markets/${id}`, { params: { platform } });
  return data;
}

export async function fetchOrderbook(marketId: string, platform: Platform): Promise<Orderbook> {
  const { data } = await api.get(`/markets/${marketId}/orderbook`, { params: { platform } });
  return data;
}

export async function fetchMarketHistory(marketId: string, platform: Platform): Promise<MarketHistory> {
  const { data } = await api.get(`/markets/${marketId}/history`, { params: { platform } });
  return data;
}
