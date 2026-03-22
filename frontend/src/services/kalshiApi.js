/**
 * Kalshi API Client
 *
 * Uses the events API with nested markets for proper titles and categories.
 * All requests go through the CRA dev proxy (setupProxy.js) to avoid CORS.
 *
 * Public endpoints (events, markets, candlesticks) work without auth.
 * Trading endpoints (orders, positions) require API key authentication.
 */

const API_PREFIX = '/trade-api/v2';

// ─── RSA-PSS Signing (Web Crypto API) ───────────────────────────────────────────

async function importPrivateKey(pemString) {
  const pem = pemString.trim();

  // Try PKCS8 first, then PKCS1
  const formats = [
    { name: 'pkcs8', header: '-----BEGIN PRIVATE KEY-----', footer: '-----END PRIVATE KEY-----' },
    { name: 'pkcs8', header: '-----BEGIN RSA PRIVATE KEY-----', footer: '-----END RSA PRIVATE KEY-----' },
  ];

  let binaryDer;
  for (const fmt of formats) {
    if (pem.includes(fmt.header) || formats.indexOf(fmt) === formats.length - 1) {
      const pemBody = pem
        .replace(/-----BEGIN [\w\s]+-----/, '')
        .replace(/-----END [\w\s]+-----/, '')
        .replace(/\s/g, '');
      binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
      break;
    }
  }

  if (!binaryDer) throw new Error('Could not parse private key PEM');

  try {
    return await crypto.subtle.importKey(
      'pkcs8',
      binaryDer.buffer,
      { name: 'RSA-PSS', hash: 'SHA-256' },
      false,
      ['sign']
    );
  } catch (e) {
    throw new Error(
      'Failed to import private key. Ensure you paste the full PEM including ' +
      '"-----BEGIN PRIVATE KEY-----" and "-----END PRIVATE KEY-----" lines. ' +
      'Original error: ' + e.message
    );
  }
}

async function signRequest(privateKey, timestampMs, method, path) {
  const message = new TextEncoder().encode(timestampMs + method + path);
  const signature = await crypto.subtle.sign(
    { name: 'RSA-PSS', saltLength: 32 },
    privateKey,
    message
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export { importPrivateKey };

// ─── HTTP Helpers ───────────────────────────────────────────────────────────────

function buildUrl(path, params = {}) {
  const url = new URL(`${API_PREFIX}${path}`, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });
  return url.toString();
}

async function request(method, path, { params, body, auth } = {}) {
  const url = buildUrl(path, params);
  const headers = { Accept: 'application/json' };

  if (auth && auth.keyId && auth.privateKey) {
    const timestampMs = String(Date.now());
    const sigPath = `${API_PREFIX}${path}`;
    const signature = await signRequest(auth.privateKey, timestampMs, method.toUpperCase(), sigPath);
    headers['KALSHI-ACCESS-KEY'] = auth.keyId;
    headers['KALSHI-ACCESS-TIMESTAMP'] = timestampMs;
    headers['KALSHI-ACCESS-SIGNATURE'] = signature;
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

// ─── Events (public — the primary way to browse markets) ────────────────────────

export async function getEvents({ limit = 200, cursor, seriesTicker, withNestedMarkets = true } = {}) {
  const data = await request('GET', '/events', {
    params: {
      limit,
      cursor,
      series_ticker: seriesTicker,
      with_nested_markets: withNestedMarkets,
    },
  });
  return { events: data.events || [], cursor: data.cursor || '' };
}

export async function getAllEvents(maxPages = 15) {
  const allEvents = [];
  let cursor = '';
  for (let page = 0; page < maxPages; page++) {
    const { events, cursor: next } = await getEvents({
      limit: 200,
      cursor: cursor || undefined,
      withNestedMarkets: true,
    });
    allEvents.push(...events);
    if (!next || events.length === 0) break;
    cursor = next;
  }
  return allEvents;
}

// ─── Markets (public) ───────────────────────────────────────────────────────────

export async function getMarket(ticker) {
  const data = await request('GET', `/markets/${ticker}`);
  return data.market;
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

// ─── Portfolio (auth required) ──────────────────────────────────────────────────

export async function getBalance(auth) {
  const data = await request('GET', '/portfolio/balance', { auth });
  return data;
}

export async function placeOrder(auth, { ticker, side, type = 'market', count }) {
  const body = { ticker, action: 'buy', side, type, count };
  const data = await request('POST', '/portfolio/orders', { auth, body });
  return data.order;
}

export async function sellPosition(auth, { ticker, side, count }) {
  const body = { ticker, action: 'sell', side, type: 'market', count };
  const data = await request('POST', '/portfolio/orders', { auth, body });
  return data.order;
}

// ─── Subcategory Detection ──────────────────────────────────────────────────────

const SPORTS_SUBCATEGORIES = [
  { sub: 'Basketball', prefixes: ['KXNBA', 'KXNCAAMB', 'KXNCAAWB', 'KXWNBA'] },
  { sub: 'Football', prefixes: ['KXNFL', 'KXNCAAF', 'KXSUPERBOWL', 'KXUSFL', 'KXUFL'] },
  { sub: 'Baseball', prefixes: ['KXMLB'] },
  { sub: 'Hockey', prefixes: ['KXNHL'] },
  { sub: 'Soccer', prefixes: ['KXLALIGA', 'KXEPL', 'KXMLS', 'KXCHAMPIONS', 'KXLIGA', 'KXSERIE', 'KXLIGUE', 'KXBUNDES', 'KXUEFA', 'KXFIFA', 'KXWORLDCUP'] },
  { sub: 'Golf', prefixes: ['KXGOLF', 'KXPGA', 'KXMASTERS'] },
  { sub: 'Tennis', prefixes: ['KXTENNIS', 'KXATP', 'KXWTA'] },
  { sub: 'MMA/Boxing', prefixes: ['KXMMA', 'KXUFC', 'KXBOXING'] },
  { sub: 'Racing', prefixes: ['KXF1', 'KXNASCAR', 'KXINDY'] },
  { sub: 'Other Sports', prefixes: [] },
];

export function getSportsSubcategory(seriesTicker) {
  const upper = (seriesTicker || '').toUpperCase();
  for (const { sub, prefixes } of SPORTS_SUBCATEGORIES) {
    if (prefixes.some((p) => upper.startsWith(p))) return sub;
  }
  // Also check title keywords as fallback
  return 'Other Sports';
}

export function getSportsSubcategoryFromEvent(event) {
  const sub = getSportsSubcategory(event.series_ticker);
  if (sub !== 'Other Sports') return sub;

  // Check product_metadata.competition
  const comp = ((event.product_metadata || {}).competition || '').toLowerCase();
  if (comp.includes('basketball')) return 'Basketball';
  if (comp.includes('football')) return 'Football';
  if (comp.includes('baseball')) return 'Baseball';
  if (comp.includes('hockey')) return 'Hockey';
  if (comp.includes('soccer') || comp.includes('football') || comp.includes('liga')) return 'Soccer';

  // Check title
  const title = (event.title || '').toLowerCase();
  if (title.includes('basketball') || title.includes('nba') || title.includes('ncaa')) return 'Basketball';
  if (title.includes('football') || title.includes('nfl')) return 'Football';
  if (title.includes('hockey') || title.includes('nhl') || title.includes('stanley')) return 'Hockey';
  if (title.includes('soccer') || title.includes('liga') || title.includes('premier league')) return 'Soccer';

  return 'Other Sports';
}

// ─── Event Helpers ──────────────────────────────────────────────────────────────

/** Filter out MVE combo/parlay events that have junk titles */
export function isRealEvent(event) {
  const ticker = (event.event_ticker || '').toUpperCase();
  if (ticker.includes('KXMVE')) return false;
  if (ticker.includes('MULTIGAME')) return false;
  return true;
}

/** Get the best market from an event (highest volume or first) */
export function getPrimaryMarket(event) {
  const markets = event.markets || [];
  if (markets.length === 0) return null;
  // Sort by volume descending and return highest
  return [...markets].sort((a, b) =>
    parseFloat(b.volume_fp || 0) - parseFloat(a.volume_fp || 0)
  )[0];
}

/** Format cents from dollar string */
export function formatCents(dollarStr) {
  if (!dollarStr) return '—';
  const cents = Math.round(parseFloat(dollarStr) * 100);
  return `${cents}¢`;
}

/** Format volume number */
export function formatVolume(vol) {
  const n = parseFloat(vol || 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}
