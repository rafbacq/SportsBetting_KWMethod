import type { Market, Orderbook, OrderbookLevel, Order, Position, Balance } from '@sports-betting/shared';

// Kalshi API response types (subset of what they return)
interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle?: string;
  status: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume: number;
  open_interest: number;
  category?: string;
  close_time: string;
  open_time: string;
  result?: string;
  image_url?: string;
}

interface KalshiOrderbookFP {
  yes_dollars: Array<[string, string]>; // [price_string, qty_string]
  no_dollars: Array<[string, string]>;  // [price_string, qty_string]
}

interface KalshiOrder {
  order_id: string;
  ticker: string;
  side: string;
  action: string;
  type: string;
  yes_price: number;
  no_price: number;
  yes_price_dollars?: string;
  no_price_dollars?: string;
  created_time: string;
  updated_time?: string;
  status: string;
  remaining_count: number;
  initial_count: number;
}

interface KalshiPosition {
  ticker: string;
  market_exposure: number;
  position: number;
  resting_orders_count: number;
  total_traded: number;
  realized_pnl: number;
}

export function mapKalshiMarket(m: Record<string, unknown>): Market {
  const statusMap: Record<string, Market['status']> = {
    open: 'open',
    active: 'open',
    closed: 'closed',
    settled: 'settled',
    finalized: 'settled',
  };

  const status = String(m.status || 'open');

  // Kalshi API v2 uses dollar-denominated string fields like "0.5500"
  const parseDollars = (val: unknown): number => {
    const n = parseFloat(String(val || '0'));
    return isNaN(n) ? 0 : Math.round(n * 100); // convert to cents
  };

  const yesBid = parseDollars(m.yes_bid_dollars || m.previous_yes_bid_dollars);
  const noAsk = parseDollars(m.no_ask_dollars);
  const lastPrice = parseDollars(m.last_price_dollars || m.previous_price_dollars);
  const yesPrice = yesBid || lastPrice || 50;
  const noPrice = noAsk || (100 - yesPrice);

  // Title: Kalshi uses title for events, markets use yes/no_sub_title
  const title = String(m.title || m.yes_sub_title || m.no_sub_title || m.subtitle || '');

  return {
    id: String(m.ticker || m.market_ticker || ''),
    platform: 'kalshi',
    ticker: String(m.ticker || m.market_ticker || ''),
    title,
    description: String(m.subtitle || m.no_sub_title || title),
    status: statusMap[status] || 'open',
    yesPrice,
    noPrice,
    volume: parseDollars(m.volume_dollars || m.volume) / 100, // volume is in dollars
    openInterest: parseFloat(String(m.open_interest_fp || m.open_interest || '0')),
    category: m.category ? String(m.category) : undefined,
    eventTicker: m.event_ticker ? String(m.event_ticker) : undefined,
    createdAt: String(m.open_time || m.created_time || new Date().toISOString()),
    closesAt: String(m.close_time || m.expiration_time || new Date().toISOString()),
    imageUrl: m.image_url ? String(m.image_url) : undefined,
  };
}

export function mapKalshiOrderbook(data: Record<string, unknown>, marketId: string): Orderbook {
  // Kalshi uses orderbook_fp format with yes_dollars/no_dollars as [price_string, qty_string] arrays
  const ob = (data.orderbook_fp || data) as KalshiOrderbookFP;

  const mapLevels = (levels: Array<[string, string]> | undefined): OrderbookLevel[] =>
    (levels || []).map(([priceStr, qtyStr]) => ({
      price: Math.round(parseFloat(priceStr) * 100), // dollar string to cents
      quantity: Math.round(parseFloat(qtyStr)),
    }));

  return {
    marketId,
    yes: mapLevels(ob.yes_dollars),
    no: mapLevels(ob.no_dollars),
    timestamp: new Date().toISOString(),
  };
}

export function mapKalshiOrder(o: KalshiOrder): Order {
  const statusMap: Record<string, Order['status']> = {
    resting: 'open',
    pending: 'pending',
    canceled: 'cancelled',
    executed: 'filled',
    partial: 'partial',
  };

  return {
    id: o.order_id,
    platform: 'kalshi',
    marketId: o.ticker,
    marketTicker: o.ticker,
    side: o.side === 'yes' ? 'yes' : 'no',
    action: o.action === 'buy' ? 'buy' : 'sell',
    type: o.type === 'market' ? 'market' : 'limit',
    price: o.yes_price_dollars || o.no_price_dollars
      ? Math.round(parseFloat(o.yes_price_dollars || o.no_price_dollars || '0') * 100)
      : (o.yes_price || o.no_price),
    quantity: o.initial_count,
    filledQuantity: o.initial_count - o.remaining_count,
    remainingQuantity: o.remaining_count,
    status: statusMap[o.status] || 'open',
    createdAt: o.created_time,
    updatedAt: o.updated_time || o.created_time,
  };
}

export function mapKalshiPosition(p: KalshiPosition, market?: Market): Position {
  const side = p.position > 0 ? 'yes' : 'no';
  const qty = Math.abs(p.position);
  const currentPrice = market ? (side === 'yes' ? market.yesPrice : market.noPrice) : 50;
  const avgPrice = qty > 0 ? Math.abs(p.market_exposure) / qty : 0;

  return {
    id: p.ticker,
    platform: 'kalshi',
    marketId: p.ticker,
    marketTicker: p.ticker,
    marketTitle: market?.title || p.ticker,
    side: side as 'yes' | 'no',
    quantity: qty,
    avgPrice: Math.round(avgPrice * 100),
    currentPrice,
    marketValue: qty * currentPrice,
    costBasis: qty * Math.round(avgPrice * 100),
    unrealizedPnl: qty * (currentPrice - Math.round(avgPrice * 100)),
    realizedPnl: p.realized_pnl,
  };
}

export function mapKalshiBalance(data: Record<string, unknown>): Balance {
  // Kalshi now uses dollar strings (e.g. "125.50") instead of cents
  const parseDollarBalance = (val: unknown): number => {
    const n = parseFloat(String(val || '0'));
    return isNaN(n) ? 0 : n;
  };

  const available = parseDollarBalance(data.balance_dollars || data.balance);
  const portfolioValue = parseDollarBalance(data.portfolio_value_dollars || data.portfolio_value);

  return {
    platform: 'kalshi',
    available,
    outstanding: 0,
    total: portfolioValue || available,
  };
}
