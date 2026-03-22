import type {
  PlatformCredentials,
  Market,
  Orderbook,
  MarketHistory,
  PaginatedResult,
  GetMarketsParams,
  PlaceOrderParams,
  Order,
  GetOrdersParams,
  Position,
  GetPositionsParams,
  Balance,
} from '@sports-betting/shared';
import type { PlatformAdapter } from '../types.js';
import { KalshiClient } from './client.js';
import {
  mapKalshiMarket,
  mapKalshiOrderbook,
  mapKalshiOrder,
  mapKalshiPosition,
  mapKalshiBalance,
} from './mappers.js';
import { config } from '../../config/env.js';

export class KalshiAdapter implements PlatformAdapter {
  readonly platform = 'kalshi' as const;
  private client: KalshiClient;
  private authenticated = false;

  constructor() {
    this.client = new KalshiClient(
      config.kalshi.baseUrl,
      config.kalshi.apiKey,
      config.kalshi.getPrivateKey(),
    );
    this.authenticated = this.client.isConfigured;
  }

  async initialize(credentials: PlatformCredentials): Promise<void> {
    this.client = new KalshiClient(
      config.kalshi.baseUrl,
      credentials.apiKey,
      credentials.privateKey,
    );
    // Verify credentials by fetching balance
    await this.client.get('/portfolio/balance');
    this.authenticated = true;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  async getMarkets(params: Omit<GetMarketsParams, 'platform'>): Promise<PaginatedResult<Market>> {
    // Use events endpoint to get richer market data with titles and categories
    const queryParams: Record<string, string> = {
      with_nested_markets: 'true',
    };
    if (params.status) queryParams.status = params.status;
    if (params.cursor) queryParams.cursor = params.cursor;
    if (params.limit) queryParams.limit = params.limit.toString();
    if (params.category) queryParams.series_ticker = params.category;

    const res = await this.client.get<{
      events: Array<{
        title: string;
        category: string;
        markets: Array<Record<string, unknown>>;
      }>;
      cursor?: string;
    }>('/events', queryParams);

    // Flatten events into markets, enriching with event-level data
    const markets: Market[] = [];
    for (const event of res.events || []) {
      for (const m of event.markets || []) {
        const mapped = mapKalshiMarket(m);
        // Use event title if market title is missing or generic
        if (!mapped.title || mapped.title === 'undefined') {
          mapped.title = event.title;
        }
        if (!mapped.category) {
          mapped.category = event.category;
        }
        markets.push(mapped);
      }
    }

    return {
      data: markets,
      cursor: res.cursor,
      hasMore: !!res.cursor,
    };
  }

  async getMarket(id: string): Promise<Market> {
    const res = await this.client.get<{ market: Record<string, unknown> }>(`/markets/${id}`);
    return mapKalshiMarket(res.market);
  }

  async getOrderbook(marketId: string): Promise<Orderbook> {
    const res = await this.client.get<{ orderbook: Record<string, unknown> }>(
      `/markets/${marketId}/orderbook`,
    );
    return mapKalshiOrderbook(res.orderbook as never, marketId);
  }

  async getMarketHistory(marketId: string): Promise<MarketHistory> {
    // Kalshi provides candlestick data via /series endpoint
    try {
      const res = await this.client.get<{
        history: Array<{ ts: number; yes_price: number; volume: number }>;
      }>(`/markets/${marketId}/history`, { min_ts: '0' });

      return {
        marketId,
        points: (res.history || []).map((p) => ({
          timestamp: new Date(p.ts * 1000).toISOString(),
          yesPrice: p.yes_price,
          volume: p.volume || 0,
        })),
      };
    } catch {
      // Return empty history if endpoint not available
      return { marketId, points: [] };
    }
  }

  async placeOrder(params: Omit<PlaceOrderParams, 'platform'>): Promise<Order> {
    if (!this.authenticated) throw new Error('Not authenticated with Kalshi');

    const body = {
      ticker: params.marketTicker,
      action: params.action,
      side: params.side,
      type: params.type,
      count: params.quantity,
      ...(params.type === 'limit'
        ? { [params.side === 'yes' ? 'yes_price' : 'no_price']: params.price }
        : {}),
    };

    const res = await this.client.post<{ order: Record<string, unknown> }>(
      '/portfolio/orders',
      body,
    );
    return mapKalshiOrder(res.order as never);
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.client.delete(`/portfolio/orders/${orderId}`);
  }

  async getOrders(params?: Omit<GetOrdersParams, 'platform'>): Promise<PaginatedResult<Order>> {
    if (!this.authenticated) throw new Error('Not authenticated with Kalshi');

    const queryParams: Record<string, string> = {};
    if (params?.marketId) queryParams.ticker = params.marketId;
    if (params?.status) queryParams.status = params.status;

    const res = await this.client.get<{
      orders: Array<Record<string, unknown>>;
      cursor?: string;
    }>('/portfolio/orders', queryParams);

    return {
      data: (res.orders || []).map((o) => mapKalshiOrder(o as never)),
      cursor: res.cursor,
      hasMore: !!res.cursor,
    };
  }

  async getPositions(
    params?: Omit<GetPositionsParams, 'platform'>,
  ): Promise<PaginatedResult<Position>> {
    if (!this.authenticated) throw new Error('Not authenticated with Kalshi');

    const queryParams: Record<string, string> = {};
    if (params?.status === 'open') queryParams.settlement_status = 'unsettled';

    const res = await this.client.get<{
      market_positions: Array<Record<string, unknown>>;
      cursor?: string;
    }>('/portfolio/positions', queryParams);

    // Get market info for each position to enrich data
    const positions = await Promise.all(
      (res.market_positions || []).map(async (p: Record<string, unknown>) => {
        let market: Market | undefined;
        try {
          market = await this.getMarket(p.ticker as string);
        } catch {
          // ignore
        }
        return mapKalshiPosition(p as never, market);
      }),
    );

    return {
      data: positions,
      cursor: res.cursor,
      hasMore: !!res.cursor,
    };
  }

  async getBalance(): Promise<Balance> {
    if (!this.authenticated) throw new Error('Not authenticated with Kalshi');

    const res = await this.client.get<Record<string, unknown>>('/portfolio/balance');
    return mapKalshiBalance(res as never);
  }
}
