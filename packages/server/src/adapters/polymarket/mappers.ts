import type { Market, Orderbook, OrderbookLevel, Order, Position, Balance } from '@sports-betting/shared';

interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  description: string;
  active: boolean;
  closed: boolean;
  markets: PolymarketMarket[];
}

interface PolymarketMarket {
  id: string;
  condition_id: string;
  question: string;
  description: string;
  active: boolean;
  closed: boolean;
  outcomePrices: string; // JSON string "[0.55, 0.45]"
  volume: number;
  liquidity: number;
  startDate: string;
  endDate: string;
  image: string;
  groupItemTitle?: string;
  clobTokenIds?: string; // JSON string "[\"tokenId1\", \"tokenId2\"]"
}

export function mapPolymarketMarket(m: PolymarketMarket): Market {
  let yesPrice = 50;
  let noPrice = 50;
  try {
    const prices = JSON.parse(m.outcomePrices);
    yesPrice = Math.round(parseFloat(prices[0]) * 100);
    noPrice = Math.round(parseFloat(prices[1]) * 100);
  } catch {
    // use defaults
  }

  return {
    id: m.condition_id || m.id,
    platform: 'polymarket',
    ticker: m.condition_id || m.id,
    title: m.question || m.groupItemTitle || '',
    description: m.description || '',
    status: m.closed ? 'closed' : m.active ? 'open' : 'closed',
    yesPrice,
    noPrice,
    volume: m.volume || 0,
    category: undefined,
    createdAt: m.startDate,
    closesAt: m.endDate,
    imageUrl: m.image,
  };
}

export function mapPolymarketEvents(events: PolymarketEvent[]): Market[] {
  const markets: Market[] = [];
  for (const event of events) {
    for (const m of event.markets || []) {
      markets.push(mapPolymarketMarket(m));
    }
  }
  return markets;
}

export function mapPolymarketOrderbook(
  data: { bids: Array<{ price: string; size: string }>; asks: Array<{ price: string; size: string }> },
  marketId: string,
): Orderbook {
  const mapSide = (levels: Array<{ price: string; size: string }>): OrderbookLevel[] =>
    levels.map((l) => ({
      price: Math.round(parseFloat(l.price) * 100),
      quantity: parseInt(l.size, 10),
    }));

  return {
    marketId,
    yes: mapSide(data.bids || []),
    no: mapSide(data.asks || []),
    timestamp: new Date().toISOString(),
  };
}

export function mapPolymarketOrder(o: Record<string, unknown>): Order {
  return {
    id: o.id as string,
    platform: 'polymarket',
    marketId: (o.asset_id || o.market) as string,
    marketTicker: (o.asset_id || o.market) as string,
    side: o.side === 'BUY' ? 'yes' : 'no',
    action: o.side === 'BUY' ? 'buy' : 'sell',
    type: 'limit',
    price: Math.round(parseFloat(o.price as string) * 100),
    quantity: parseInt(o.original_size as string, 10),
    filledQuantity: parseInt(o.size_matched as string, 10) || 0,
    remainingQuantity: parseInt(o.original_size as string, 10) - (parseInt(o.size_matched as string, 10) || 0),
    status: 'open',
    createdAt: o.created_at as string || new Date().toISOString(),
    updatedAt: o.created_at as string || new Date().toISOString(),
  };
}

export function mapPolymarketBalance(data: Record<string, unknown>): Balance {
  const balance = parseFloat(data.balance as string || '0');
  return {
    platform: 'polymarket',
    available: balance,
    outstanding: 0,
    total: balance,
  };
}
