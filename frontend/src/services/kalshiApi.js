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

// ─── RSA Key Handling ────────────────────────────────────────────────────────────

/**
 * DER-encode a tag + content (ASN.1 TLV).
 * Handles lengths up to 3 bytes (supports keys up to ~16MB).
 */
function derWrap(tag, content) {
  const len = content.length;
  let header;
  if (len < 128) {
    header = new Uint8Array([tag, len]);
  } else if (len < 256) {
    header = new Uint8Array([tag, 0x81, len]);
  } else if (len < 65536) {
    header = new Uint8Array([tag, 0x82, (len >> 8) & 0xff, len & 0xff]);
  } else {
    header = new Uint8Array([tag, 0x83, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
  }
  const result = new Uint8Array(header.length + content.length);
  result.set(header);
  result.set(content, header.length);
  return result;
}

/**
 * Convert PKCS#1 (BEGIN RSA PRIVATE KEY) to PKCS#8 (BEGIN PRIVATE KEY).
 * Web Crypto API only accepts PKCS#8 format.
 */
function pkcs1ToPkcs8(pkcs1Der) {
  // PKCS#8 structure:
  //   SEQUENCE {
  //     INTEGER 0,
  //     SEQUENCE { OID 1.2.840.113549.1.1.1 (rsaEncryption), NULL },
  //     OCTET STRING { <PKCS#1 key bytes> }
  //   }
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const rsaOid = new Uint8Array([
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    0x05, 0x00,
  ]);
  const algorithmId = derWrap(0x30, rsaOid);
  const octetString = derWrap(0x04, pkcs1Der);

  const inner = new Uint8Array(version.length + algorithmId.length + octetString.length);
  inner.set(version, 0);
  inner.set(algorithmId, version.length);
  inner.set(octetString, version.length + algorithmId.length);

  return derWrap(0x30, inner);
}

async function importPrivateKey(pemString) {
  const pem = pemString.trim();
  const isPkcs1 = pem.includes('BEGIN RSA PRIVATE KEY');

  // Strip PEM headers/footers and whitespace to get raw base64
  const pemBody = pem
    .replace(/-----BEGIN [\w\s]+-----/g, '')
    .replace(/-----END [\w\s]+-----/g, '')
    .replace(/\s/g, '');

  if (!pemBody) throw new Error('Private key PEM is empty.');

  let pkcs8Der;
  try {
    const rawDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
    pkcs8Der = isPkcs1 ? pkcs1ToPkcs8(rawDer) : rawDer;
  } catch (e) {
    throw new Error('Failed to decode private key base64: ' + e.message);
  }

  try {
    return await crypto.subtle.importKey(
      'pkcs8',
      pkcs8Der.buffer,
      { name: 'RSA-PSS', hash: 'SHA-256' },
      false,
      ['sign']
    );
  } catch (e) {
    throw new Error(
      'Failed to import private key. Ensure you paste the full PEM file contents ' +
      'including the BEGIN/END lines. Error: ' + e.message
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

/**
 * Fetch candlesticks with automatic fallback to longer time windows.
 * Tries the requested period first, then progressively wider windows.
 */
export async function getCandlesticksWithFallback(ticker, seconds, interval) {
  const now = Math.floor(Date.now() / 1000);

  // Try the requested window first
  let candles = await getCandlesticks(ticker, {
    startTs: now - seconds,
    endTs: now,
    periodInterval: interval,
  });
  if (candles.length >= 2) return candles;

  // Fallback: try progressively larger windows
  const fallbacks = [
    { seconds: 7 * 86400, interval: 3600 },      // 7 days, 1h intervals
    { seconds: 30 * 86400, interval: 14400 },     // 30 days, 4h intervals
    { seconds: 90 * 86400, interval: 86400 },     // 90 days, daily intervals
  ];

  for (const fb of fallbacks) {
    if (fb.seconds <= seconds) continue; // skip if smaller than what we already tried
    candles = await getCandlesticks(ticker, {
      startTs: now - fb.seconds,
      endTs: now,
      periodInterval: fb.interval,
    });
    if (candles.length >= 2) return candles;
  }

  return candles;
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
