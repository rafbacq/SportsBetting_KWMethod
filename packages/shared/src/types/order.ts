import { Platform } from './platform';

export type OrderSide = 'yes' | 'no';
export type OrderAction = 'buy' | 'sell';
export type OrderType = 'limit' | 'market';
export type OrderStatus = 'pending' | 'open' | 'filled' | 'partial' | 'cancelled' | 'expired';

export interface PlaceOrderParams {
  platform: Platform;
  marketId: string;
  marketTicker: string;
  side: OrderSide;
  action: OrderAction;
  type: OrderType;
  price: number;       // cents (1-99)
  quantity: number;     // number of contracts
}

export interface Order {
  id: string;
  platform: Platform;
  marketId: string;
  marketTicker: string;
  side: OrderSide;
  action: OrderAction;
  type: OrderType;
  price: number;
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  platform: Platform;
  marketId: string;
  marketTicker: string;
  marketTitle: string;
  side: OrderSide;
  quantity: number;
  avgPrice: number;       // average entry price in cents
  currentPrice: number;   // current market price in cents
  marketValue: number;    // quantity * currentPrice
  costBasis: number;      // quantity * avgPrice
  unrealizedPnl: number;  // marketValue - costBasis
  realizedPnl: number;
}

export interface Balance {
  platform: Platform;
  available: number;      // in dollars
  outstanding: number;    // locked in open orders
  total: number;          // available + outstanding
}

export interface GetOrdersParams {
  platform: Platform;
  marketId?: string;
  status?: OrderStatus;
}

export interface GetPositionsParams {
  platform: Platform;
  status?: 'open' | 'closed';
}
