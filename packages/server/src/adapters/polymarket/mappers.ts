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

export function mapPolymarketMarket(m: Partial<PolymarketMarket>): Market {
  let yesPrice = 50;
  let noPrice = 50;
  try {
    if (m.outcomePrices) {
      const prices = JSON.parse(m.outcomePrices);
      if (Array.isArray(prices) && prices.length >= 2) {
        yesPrice = Math.round(parseFloat(prices[0]) * 100) || 50;
        noPrice = Math.round(parseFloat(prices[1]) * 100) || 50;
      }
    }
  } catch {
    // use defaults
  }

  const id = m.condition_id || m.id || '';

  return {
    id,
    platform: 'polymarket',
    ticker: id,
    title: m.question || m.groupItemTitle || '',
    description: m.description || '',
    status: m.closed ? 'closed' : m.active ? 'open' : 'closed',
    yesPrice,
    noPrice,
    volume: m.volume || 0,
    category: undefined,
    createdAt: m.startDate || new Date().toISOString(),
    closesAt: m.endDate || new Date().toISOString(),
    imageUrl: m.image || undefined,
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
  const id = String(o.id || '');
  const marketId = String(o.asset_id || o.market || '');
  const price = Math.round(parseFloat(String(o.price || '0')) * 100) || 0;
  const quantity = parseInt(String(o.original_size || '0'), 10) || 0;
  const filledQuantity = parseInt(String(o.size_matched || '0'), 10) || 0;
  const now = new Date().toISOString();

  return {
    id,
    platform: 'polymarket',
    marketId,
    marketTicker: marketId,
    side: o.side === 'BUY' ? 'yes' : 'no',
    action: o.side === 'BUY' ? 'buy' : 'sell',
    type: 'limit',
    price,
    quantity,
    filledQuantity,
    remainingQuantity: quantity - filledQuantity,
    status: 'open',
    createdAt: String(o.created_at || now),
    updatedAt: String(o.created_at || now),
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
