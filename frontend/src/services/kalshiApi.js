/**
 * Kalshi API Client
 *
 * Handles authentication (email/password login) and all API interactions.
 * Public endpoints (markets, events, candlesticks) work without auth.
 * Trading endpoints (orders, positions) require authentication.
 *
 * All requests go through the CRA dev proxy (setupProxy.js) to avoid CORS.
 */

const API_PREFIX = '/trade-api/v2';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function buildUrl(path, params = {}) {
  const url = new URL(`${API_PREFIX}${path}`, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });
  return url.toString();
}

async function request(method, path, { params, body, token } = {}) {
  const url = buildUrl(path, params);
  const headers = { Accept: 'application/json' };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Kalshi API ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

// ─── Auth ───────────────────────────────────────────────────────────────────────

export async function login(email, password) {
  const data = await request('POST', '/login', {
    body: { email, password },
  });
  return { token: data.token, memberId: data.member_id };
}

// ─── Markets (public) ───────────────────────────────────────────────────────────

export async function getMarkets({ status = 'open', limit = 200, cursor, seriesTicker, eventTicker } = {}) {
  const data = await request('GET', '/markets', {
    params: {
      status,
      limit,
      cursor,
      series_ticker: seriesTicker,
      event_ticker: eventTicker,
    },
  });
  return { markets: data.markets || [], cursor: data.cursor || '' };
}

export async function getAllOpenMarkets(maxPages = 10) {
  const allMarkets = [];
  let cursor = '';
  for (let page = 0; page < maxPages; page++) {
    const { markets, cursor: next } = await getMarkets({
      status: 'open',
      limit: 1000,
      cursor: cursor || undefined,
    });
    allMarkets.push(...markets);
    if (!next || markets.length === 0) break;
    cursor = next;
  }
  return allMarkets;
}

export async function getMarket(ticker) {
  const data = await request('GET', `/markets/${ticker}`);
  return data.market;
}

// ─── Events (public) ────────────────────────────────────────────────────────────

export async function getEvents({ status = 'open', limit = 200, cursor, seriesTicker } = {}) {
  const data = await request('GET', '/events', {
    params: { status, limit, cursor, series_ticker: seriesTicker },
  });
  return { events: data.events || [], cursor: data.cursor || '' };
}

// ─── Candlesticks (public) ──────────────────────────────────────────────────────

export async function getCandlesticks(ticker, { startTs, endTs, periodInterval = 60 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const data = await request('GET', '/markets/candlesticks', {
    params: {
      market_tickers: ticker,
      start_ts: startTs || now - 86400,
      end_ts: endTs || now,
      period_interval: periodInterval,
    },
  });
  const entry = (data.markets || []).find((m) => m.market_ticker === ticker);
  return entry ? entry.candlesticks || [] : [];
}

// ─── Trades (public) ────────────────────────────────────────────────────────────

export async function getTrades(ticker, { limit = 100, cursor } = {}) {
  const data = await request('GET', '/markets/trades', {
    params: { ticker, limit, cursor },
  });
  return { trades: data.trades || [], cursor: data.cursor || '' };
}

// ─── Portfolio (auth required) ──────────────────────────────────────────────────

export async function getPositions(token) {
  const data = await request('GET', '/portfolio/positions', { token });
  return data.market_positions || [];
}

export async function getBalance(token) {
  const data = await request('GET', '/portfolio/balance', { token });
  return data;
}

export async function placeOrder(token, { ticker, side, type = 'market', count, yesPrice, noPrice }) {
  const body = {
    ticker,
    action: 'buy',
    side,
    type,
    count,
  };
  if (type === 'limit') {
    if (side === 'yes') body.yes_price = yesPrice;
    else body.no_price = noPrice;
  }
  const data = await request('POST', '/portfolio/orders', { token, body });
  return data.order;
}

export async function sellPosition(token, { ticker, side, count }) {
  const body = {
    ticker,
    action: 'sell',
    side,
    type: 'market',
    count,
  };
  const data = await request('POST', '/portfolio/orders', { token, body });
  return data.order;
}

export async function cancelOrder(token, orderId) {
  await request('DELETE', `/portfolio/orders/${orderId}`, { token });
}

// ─── Category Detection ─────────────────────────────────────────────────────────

const CATEGORY_PATTERNS = [
  { category: 'Sports', patterns: ['kxnba', 'kxncaa', 'kxnfl', 'kxmlb', 'kxnhl', 'kxmma', 'kxsoccer', 'kxtennis', 'kxgolf', 'kxf1'] },
  { category: 'Politics', patterns: ['kxpolitics', 'kxelection', 'kxtrump', 'kxbiden', 'kxpotus', 'kxsenate', 'kxhouse', 'kxgov', 'kxpolicy'] },
  { category: 'Economics', patterns: ['kxgdp', 'kxcpi', 'kxjobs', 'kxfed', 'kxinflation', 'kxunemployment', 'kxecon'] },
  { category: 'Crypto', patterns: ['kxbtc', 'kxeth', 'kxcrypto', 'kxbitcoin', 'kxethereum', 'kxsol'] },
  { category: 'Finance', patterns: ['kxspy', 'kxstocks', 'kxnasdaq', 'kxsp500', 'kxdow', 'kxrates', 'kxfinance'] },
  { category: 'Weather', patterns: ['kxweather', 'kxtemp', 'kxhurricane', 'kxclimate'] },
  { category: 'Culture', patterns: ['kxoscars', 'kxemmy', 'kxmovie', 'kxtv', 'kxmusic', 'kxawards', 'kxentertainment'] },
  { category: 'Tech', patterns: ['kxtech', 'kxai', 'kxapple', 'kxgoogle', 'kxmeta', 'kxtesla'] },
];

const TITLE_CATEGORY_MAP = [
  { category: 'Sports', keywords: ['nba', 'ncaa', 'nfl', 'mlb', 'nhl', 'basketball', 'football', 'baseball', 'hockey', 'soccer', 'tennis', 'golf', 'mma', 'ufc', 'boxing', 'f1', 'nascar', 'march madness'] },
  { category: 'Politics', keywords: ['president', 'election', 'senate', 'congress', 'governor', 'democrat', 'republican', 'trump', 'biden', 'vote', 'ballot', 'political', 'policy'] },
  { category: 'Economics', keywords: ['gdp', 'inflation', 'cpi', 'unemployment', 'jobs report', 'fed ', 'federal reserve', 'interest rate', 'payroll'] },
  { category: 'Crypto', keywords: ['bitcoin', 'ethereum', 'btc', 'eth', 'crypto', 'solana'] },
  { category: 'Finance', keywords: ['s&p', 'nasdaq', 'dow jones', 'stock', 'treasury', 'bond yield'] },
  { category: 'Weather', keywords: ['temperature', 'hurricane', 'tornado', 'rainfall', 'snowfall', 'weather'] },
  { category: 'Culture', keywords: ['oscar', 'emmy', 'grammy', 'movie', 'box office', 'streaming', 'tv show', 'album'] },
  { category: 'Tech', keywords: ['ai ', 'artificial intelligence', 'apple', 'google', 'spacex', 'launch'] },
];

export function categorizeMarket(market) {
  const eventTicker = (market.event_ticker || '').toLowerCase();
  const seriesTicker = (market.series_ticker || '').toLowerCase();
  const tickerBlob = eventTicker + ' ' + seriesTicker;

  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some((p) => tickerBlob.includes(p))) return category;
  }

  const title = (market.title || '').toLowerCase();
  const subtitle = (market.subtitle || market.yes_sub_title || '').toLowerCase();
  const textBlob = title + ' ' + subtitle;

  for (const { category, keywords } of TITLE_CATEGORY_MAP) {
    if (keywords.some((kw) => textBlob.includes(kw))) return category;
  }

  return 'Other';
}
