import type {
  Platform,
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

/**
 * Every betting platform adapter must implement this interface.
 * This is the core abstraction enabling multi-platform support.
 */
export interface PlatformAdapter {
  readonly platform: Platform;

  // Connection
  initialize(credentials: PlatformCredentials): Promise<void>;
  isAuthenticated(): boolean;

  // Markets (public endpoints)
  getMarkets(params: Omit<GetMarketsParams, 'platform'>): Promise<PaginatedResult<Market>>;
  getMarket(id: string): Promise<Market>;
  getOrderbook(marketId: string): Promise<Orderbook>;
  getMarketHistory(marketId: string): Promise<MarketHistory>;

  // Trading (authenticated)
  placeOrder(params: Omit<PlaceOrderParams, 'platform'>): Promise<Order>;
  cancelOrder(orderId: string): Promise<void>;
  getOrders(params?: Omit<GetOrdersParams, 'platform'>): Promise<PaginatedResult<Order>>;

  // Portfolio (authenticated)
  getPositions(params?: Omit<GetPositionsParams, 'platform'>): Promise<PaginatedResult<Position>>;
  getBalance(): Promise<Balance>;
}
