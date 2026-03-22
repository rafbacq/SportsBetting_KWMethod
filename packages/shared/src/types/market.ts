import { Platform } from './platform';

export interface Market {
  id: string;
  platform: Platform;
  ticker: string;
  title: string;
  description: string;
  status: 'open' | 'closed' | 'settled';
  yesPrice: number;   // 0-100 (cents) for display
  noPrice: number;     // 0-100 (cents) for display
  volume: number;      // total volume in dollars
  openInterest?: number;
  category?: string;
  eventTicker?: string;
  createdAt: string;
  closesAt: string;
  imageUrl?: string;
}

export interface MarketEvent {
  id: string;
  platform: Platform;
  title: string;
  category: string;
  markets: Market[];
}

export interface OrderbookLevel {
  price: number;  // cents (1-99)
  quantity: number;
}

export interface Orderbook {
  marketId: string;
  yes: OrderbookLevel[];
  no: OrderbookLevel[];
  timestamp: string;
}

export interface PricePoint {
  timestamp: string;
  yesPrice: number;
  volume: number;
}

export interface MarketHistory {
  marketId: string;
  points: PricePoint[];
}

export interface GetMarketsParams {
  platform: Platform;
  status?: 'open' | 'closed' | 'settled';
  category?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  cursor?: string;
  hasMore: boolean;
}
