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
import { PolymarketClient } from './client.js';
import {
  mapPolymarketEvents,
  mapPolymarketMarket,
  mapPolymarketOrderbook,
  mapPolymarketOrder,
  mapPolymarketBalance,
} from './mappers.js';
import { config } from '../../config/env.js';

export class PolymarketAdapter implements PlatformAdapter {
  readonly platform = 'polymarket' as const;
  private client: PolymarketClient;
  private authenticated = false;

  constructor() {
    this.client = new PolymarketClient(
      config.polymarket.gammaBaseUrl,
      config.polymarket.clobBaseUrl,
      config.polymarket.apiKey,
      config.polymarket.secret,
      config.polymarket.passphrase,
    );
    this.authenticated = this.client.isConfigured;
  }

  async initialize(credentials: PlatformCredentials): Promise<void> {
    // For Polymarket, the privateKey field contains pre-derived API credentials
    // Format: "apiKey:secret:passphrase"
    const [apiKey, secret, passphrase] = credentials.privateKey.split(':');
    this.client = new PolymarketClient(
      config.polymarket.gammaBaseUrl,
      config.polymarket.clobBaseUrl,
      apiKey || credentials.apiKey,
      secret || '',
      passphrase || '',
    );
    this.authenticated = true;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  async getMarkets(params: Omit<GetMarketsParams, 'platform'>): Promise<PaginatedResult<Market>> {
    const queryParams: Record<string, string> = {
      active: 'true',
      closed: 'false',
    };
    if (params.limit) queryParams.limit = params.limit.toString();
    if (params.cursor) queryParams.offset = params.cursor;
    if (params.search) queryParams.tag = params.search;

    const events = await this.client.getGamma<Array<Record<string, unknown>>>('/events', queryParams);
    const markets = mapPolymarketEvents(events as never);

    return {
      data: markets.slice(0, params.limit || 20),
      cursor: undefined,
      hasMore: false,
    };
  }

  async getMarket(id: string): Promise<Market> {
    const res = await this.client.getGamma<Record<string, unknown>>(`/markets/${id}`);
    return mapPolymarketMarket(res as never);
  }

  async getOrderbook(marketId: string): Promise<Orderbook> {
    const res = await this.client.getCLOB<Record<string, unknown>>(`/book`, {
      token_id: marketId,
    });
    return mapPolymarketOrderbook(res as never, marketId);
  }

  async getMarketHistory(marketId: string): Promise<MarketHistory> {
    try {
      const res = await this.client.getCLOB<{
        history: Array<{ t: number; p: number }>;
      }>(`/prices-history`, {
        market: marketId,
        interval: 'max',
        fidelity: '60',
      });

      return {
        marketId,
        points: (res.history || []).map((p) => ({
          timestamp: new Date(p.t * 1000).toISOString(),
          yesPrice: Math.round(p.p * 100),
          volume: 0,
        })),
      };
    } catch {
      return { marketId, points: [] };
    }
  }

  async placeOrder(params: Omit<PlaceOrderParams, 'platform'>): Promise<Order> {
    if (!this.authenticated) throw new Error('Not authenticated with Polymarket');

    const body = {
      tokenID: params.marketId,
      price: params.price / 100,
      size: params.quantity,
      side: params.action === 'buy' ? 'BUY' : 'SELL',
      type: params.type === 'market' ? 'FOK' : 'GTC',
    };

    const res = await this.client.postCLOB<Record<string, unknown>>('/order', body);
    return mapPolymarketOrder(res);
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.client.deleteCLOB(`/order/${orderId}`);
  }

  async getOrders(_params?: Omit<GetOrdersParams, 'platform'>): Promise<PaginatedResult<Order>> {
    if (!this.authenticated) throw new Error('Not authenticated with Polymarket');

    const res = await this.client.getCLOB<Array<Record<string, unknown>>>('/orders');
    return {
      data: (res || []).map(mapPolymarketOrder),
      hasMore: false,
    };
  }

  async getPositions(_params?: Omit<GetPositionsParams, 'platform'>): Promise<PaginatedResult<Position>> {
    if (!this.authenticated) throw new Error('Not authenticated with Polymarket');
    // Polymarket positions are tracked differently
    return { data: [], hasMore: false };
  }

  async getBalance(): Promise<Balance> {
    if (!this.authenticated) throw new Error('Not authenticated with Polymarket');
    const res = await this.client.getCLOB<Record<string, unknown>>('/balance-allowance');
    return mapPolymarketBalance(res);
  }
}
