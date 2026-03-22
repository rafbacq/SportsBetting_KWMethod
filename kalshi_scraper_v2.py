"""
Kalshi Basketball Scraper v2 — Ticks + K-Lines + Probability/Odds
==================================================================
3-phase scraper for settled NBA & NCAA basketball markets on Kalshi.

Phase 1: Scrape ~10,000 settled market metadata
Phase 2: Batch-fetch candlestick (K-line) OHLC data for each market
Phase 3: Fetch tick-level trades for each market

Derived fields computed for betting algorithm:
  - implied_prob       = yes_price  (Kalshi contracts settle at $1.00)
  - odds_multiplier    = 1 / yes_price  (payout ratio if YES wins)
  - no_odds_multiplier = 1 / no_price   (payout ratio if NO wins)
  - edge_yes           = result_binary * odds_multiplier - 1
  - edge_no            = (1 - result_binary) * no_odds_multiplier - 1

Usage:
    python kalshi_scraper_v2.py                           # defaults
    python kalshi_scraper_v2.py --max-markets 5000        # fewer markets
    python kalshi_scraper_v2.py --candle-interval 60      # hourly candles
    python kalshi_scraper_v2.py --skip-ticks              # skip trade data
    python kalshi_scraper_v2.py --skip-candles            # skip k-lines

Outputs (in ./kalshi_data/):
    markets.csv              — flat market data + derived probabilities
    candlesticks.csv         — OHLC k-line rows (ticker, ts, O, H, L, C, vol)
    trades.csv               — tick-level trades (ticker, ts, price, size, side)
    raw_markets.json         — full API responses
    scrape_summary.json      — run metadata & stats
"""

import requests
import pandas as pd
import json
import time
import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Optional
from dataclasses import dataclass, field, asdict

# ─── Configuration ──────────────────────────────────────────────────────────────

BASE_URL = "https://api.elections.kalshi.com/trade-api/v2"
REQUEST_DELAY = 0.35  # seconds between requests
MAX_RETRIES = 3

# Basketball classification patterns
NBA_SERIES = ["kxnba", "nba"]
NCAA_SERIES = ["kxncaab", "kxncaam", "ncaab", "ncaam", "kxmm", "marchmad"]

NBA_TITLE_KW = [
    "nba", "lakers", "celtics", "warriors", "knicks", "nets", "bucks",
    "76ers", "sixers", "suns", "nuggets", "heat", "bulls", "cavaliers",
    "mavericks", "clippers", "thunder", "timberwolves", "grizzlies",
    "hawks", "hornets", "wizards", "pacers", "pistons", "magic",
    "raptors", "kings", "spurs", "rockets", "pelicans", "blazers",
    "jazz", "trail blazers", "pro basketball",
]

NCAA_TITLE_KW = [
    "ncaa", "march madness", "college basketball", "ncaab", "ncaam",
    "final four", "sweet sixteen", "elite eight", "round of 64",
    "round of 32", "first four",
]


# ─── Helpers ────────────────────────────────────────────────────────────────────

def ts_now() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def safe_float(v) -> Optional[float]:
    """Parse dollar-string or numeric to float, or None."""
    if v is None:
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def classify(market: dict) -> Optional[str]:
    """Return 'NBA', 'NCAA', or None."""
    series = (market.get("series_ticker") or "").lower()
    event = (market.get("event_ticker") or "").lower()
    title = (market.get("title") or "").lower()
    subtitle = (market.get("subtitle") or market.get("sub_title") or "").lower()
    blob = f"{series} {event} {title} {subtitle}"

    for p in NCAA_SERIES:
        if p in series or p in event:
            return "NCAA"
    for p in NBA_SERIES:
        if p in series or p in event:
            return "NBA"
    for kw in NCAA_TITLE_KW:
        if kw in blob:
            return "NCAA"
    for kw in NBA_TITLE_KW:
        if kw in blob:
            return "NBA"
    return None


# ─── API Client ─────────────────────────────────────────────────────────────────

class KalshiAPI:
    def __init__(self, delay=REQUEST_DELAY):
        self.base = BASE_URL
        self.delay = delay
        self.s = requests.Session()
        self.s.headers["Accept"] = "application/json"
        self.s.headers["User-Agent"] = "KalshiScraper/2.0"
        self.request_count = 0

    def _get(self, path: str, params: dict = None) -> dict:
        time.sleep(self.delay)
        self.request_count += 1
        url = f"{self.base}{path}"
        for attempt in range(MAX_RETRIES):
            try:
                r = self.s.get(url, params=params, timeout=30)
                if r.status_code == 429:
                    wait = 10 * (attempt + 1)
                    print(f"    ⚠ Rate limited, waiting {wait}s...")
                    time.sleep(wait)
                    continue
                r.raise_for_status()
                return r.json()
            except requests.exceptions.RequestException as e:
                if attempt == MAX_RETRIES - 1:
                    raise
                time.sleep(2 * (attempt + 1))
        return {}

    # ── Markets (paginated) ──────────────────────────────────────────────

    def get_markets_page(self, params: dict) -> tuple[list, str]:
        data = self._get("/markets", params)
        return data.get("markets", []), data.get("cursor", "")

    def get_all_markets(
        self,
        status="settled",
        series_ticker=None,
        min_settled_ts=None,
        max_settled_ts=None,
        max_total=None,
    ) -> list[dict]:
        all_m = []
        cursor = None
        while True:
            p = {"limit": 1000, "status": status, "mve_filter": "exclude"}
            if series_ticker:
                p["series_ticker"] = series_ticker
            if min_settled_ts:
                p["min_settled_ts"] = min_settled_ts
            if max_settled_ts:
                p["max_settled_ts"] = max_settled_ts
            if cursor:
                p["cursor"] = cursor

            batch, cursor = self.get_markets_page(p)
            all_m.extend(batch)
            if len(all_m) % 3000 < 1000:
                print(f"      ... {len(all_m)} markets so far")
            if not cursor or not batch:
                break
            if max_total and len(all_m) >= max_total:
                break
        return all_m

    # ── Candlesticks (batch — up to 100 tickers, 10k candles) ────────────

    def get_batch_candlesticks(
        self,
        tickers: list[str],
        start_ts: int,
        end_ts: int,
        period_interval: int = 60,
    ) -> dict:
        """
        Returns {ticker: [candle, ...]} for up to 100 tickers.
        Each candle has: end_period_ts, price.{open,high,low,close,mean}_dollars,
                         yes_bid/yes_ask OHLC, volume_fp, open_interest_fp.
        """
        if not tickers:
            return {}
        params = {
            "market_tickers": ",".join(tickers[:100]),
            "start_ts": start_ts,
            "end_ts": end_ts,
            "period_interval": period_interval,
            "include_latest_before_start": "true",
        }
        try:
            data = self._get("/markets/candlesticks", params)
        except Exception as e:
            print(f"    ⚠ Batch candlestick error: {e}")
            return {}

        result = {}
        for entry in data.get("markets", []):
            t = entry.get("market_ticker", "")
            result[t] = entry.get("candlesticks", [])
        return result

    # ── Single market candlesticks (fallback) ────────────────────────────

    def get_candlesticks(
        self,
        series_ticker: str,
        ticker: str,
        start_ts: int,
        end_ts: int,
        period_interval: int = 60,
    ) -> list[dict]:
        try:
            data = self._get(
                f"/series/{series_ticker}/markets/{ticker}/candlesticks",
                {
                    "start_ts": start_ts,
                    "end_ts": end_ts,
                    "period_interval": period_interval,
                },
            )
            return data.get("candlesticks", [])
        except Exception:
            return []

    # ── Trades / Ticks ───────────────────────────────────────────────────

    def get_trades(
        self,
        ticker: str,
        min_ts: int = None,
        max_ts: int = None,
        max_trades: int = 500,
    ) -> list[dict]:
        """Get tick-level trades for a single market."""
        all_t = []
        cursor = None
        while True:
            p = {"limit": 1000, "ticker": ticker}
            if min_ts:
                p["min_ts"] = min_ts
            if max_ts:
                p["max_ts"] = max_ts
            if cursor:
                p["cursor"] = cursor
            try:
                data = self._get("/markets/trades", p)
            except Exception:
                break
            trades = data.get("trades", [])
            all_t.extend(trades)
            cursor = data.get("cursor", "")
            if not cursor or not trades or len(all_t) >= max_trades:
                break
        return all_t[:max_trades]

    # ── Sports filter discovery ──────────────────────────────────────────

    def get_sports_filters(self) -> dict:
        try:
            return self._get("/search/filters_by_sport")
        except Exception:
            return {}


# ─── Phase 1: Collect settled basketball markets ────────────────────────────────

def phase1_collect_markets(api: KalshiAPI, days_back: int, max_markets: int) -> list[dict]:
    """
    Gather up to max_markets settled NBA + NCAA basketball markets.
    """
    print("\n" + "=" * 65)
    print("  PHASE 1: Collecting settled basketball markets")
    print("=" * 65)

    cutoff_ts = ts_now() - days_back * 86400
    basketball = []
    seen = set()

    # 1a — Discover series tickers from sports filter
    print("\n  🔍 Discovering series tickers from sports filter...")
    discovered_series = set()
    filters = api.get_sports_filters()
    sports = filters.get("filters_by_sports", {})
    for sport_name, sport_data in sports.items():
        if "basketball" not in sport_name.lower() and "hoops" not in sport_name.lower():
            continue
        print(f"     Found sport group: {sport_name}")
        blob = json.dumps(sport_data).lower()
        # Extract any series_ticker values
        if isinstance(sport_data, dict):
            for v in sport_data.values():
                if isinstance(v, list):
                    for item in v:
                        if isinstance(item, dict) and "series_ticker" in item:
                            discovered_series.add(item["series_ticker"])
    if discovered_series:
        print(f"     Series from filter: {discovered_series}")

    # 1b — Pull markets by discovered series tickers
    for st in discovered_series:
        print(f"\n  📥 Pulling settled markets for series={st}...")
        ms = api.get_all_markets(
            status="settled",
            series_ticker=st,
            min_settled_ts=cutoff_ts,
            max_total=max_markets,
        )
        for m in ms:
            t = m.get("ticker")
            if t and t not in seen:
                league = classify(m)
                if league:
                    m["_league"] = league
                    basketball.append(m)
                    seen.add(t)
        print(f"     → basketball matches: {len(basketball)}")
        if len(basketball) >= max_markets:
            break

    # 1c — Broad scan of all settled markets to catch stragglers
    if len(basketball) < max_markets:
        print(f"\n  📥 Broad scan of all settled markets (last {days_back} days)...")
        all_settled = api.get_all_markets(
            status="settled",
            min_settled_ts=cutoff_ts,
            max_total=max_markets * 5,  # oversample, then filter
        )
        print(f"     Total settled in window: {len(all_settled)}")
        for m in all_settled:
            t = m.get("ticker")
            if t and t not in seen:
                league = classify(m)
                if league:
                    m["_league"] = league
                    basketball.append(m)
                    seen.add(t)
            if len(basketball) >= max_markets:
                break
        print(f"     → basketball total after broad scan: {len(basketball)}")

    basketball = basketball[:max_markets]
    nba_count = sum(1 for m in basketball if m.get("_league") == "NBA")
    ncaa_count = len(basketball) - nba_count
    print(f"\n  ✅ Phase 1 complete: {len(basketball)} markets (NBA={nba_count}, NCAA={ncaa_count})")
    return basketball


# ─── Phase 2: Fetch candlestick (K-line) data ──────────────────────────────────

def _parse_candle(ticker: str, league: str, c: dict) -> dict:
    """Flatten one candlestick into a row with derived probability fields."""
    price = c.get("price", {})
    yes_bid = c.get("yes_bid", {})
    yes_ask = c.get("yes_ask", {})

    close_p = safe_float(price.get("close_dollars"))
    open_p = safe_float(price.get("open_dollars"))
    high_p = safe_float(price.get("high_dollars"))
    low_p = safe_float(price.get("low_dollars"))
    mean_p = safe_float(price.get("mean_dollars"))

    # Derived: on Kalshi, yes_price ≈ implied probability
    # odds_multiplier = payout if YES wins = 1 / yes_price
    implied_prob = close_p
    odds_yes = (1.0 / close_p) if close_p and close_p > 0 else None
    odds_no = (1.0 / (1.0 - close_p)) if close_p and close_p < 1.0 else None

    return {
        "ticker": ticker,
        "league": league,
        "end_period_ts": c.get("end_period_ts"),
        # Price OHLC (these ARE the implied probabilities, range 0-1)
        "price_open": open_p,
        "price_high": high_p,
        "price_low": low_p,
        "price_close": close_p,
        "price_mean": mean_p,
        "price_previous": safe_float(price.get("previous_dollars")),
        # Yes bid/ask spread
        "yes_bid_open": safe_float(yes_bid.get("open_dollars")),
        "yes_bid_close": safe_float(yes_bid.get("close_dollars")),
        "yes_ask_open": safe_float(yes_ask.get("open_dollars")),
        "yes_ask_close": safe_float(yes_ask.get("close_dollars")),
        # Volume & OI
        "volume": safe_float(c.get("volume_fp")),
        "open_interest": safe_float(c.get("open_interest_fp")),
        # ── Derived for betting algo ──
        "implied_prob": implied_prob,         # = close price
        "odds_multiplier_yes": odds_yes,      # 1/p  — what you multiply buying YES
        "odds_multiplier_no": odds_no,        # 1/(1-p) — what you multiply buying NO
        # Spread = ask - bid (tightness of market)
        "spread": (
            safe_float(yes_ask.get("close_dollars") or 0) -
            safe_float(yes_bid.get("close_dollars") or 0)
        ) if yes_ask.get("close_dollars") and yes_bid.get("close_dollars") else None,
    }


def phase2_candlesticks(
    api: KalshiAPI,
    markets: list[dict],
    period_interval: int = 60,
) -> list[dict]:
    """
    Fetch K-line data for all markets using the batch endpoint.
    Batches of 100 tickers at a time.
    """
    print("\n" + "=" * 65)
    print(f"  PHASE 2: Fetching candlestick data ({period_interval}min intervals)")
    print("=" * 65)

    all_candle_rows = []
    tickers_with_ts = []

    # Prepare: for each market, compute its time window
    for m in markets:
        ticker = m["ticker"]
        league = m.get("_league", "")
        # Use open_time → close_time (or expiration) as the candle window
        open_t = m.get("open_time")
        close_t = m.get("close_time") or m.get("expiration_time") or m.get("latest_expiration_time")
        if not open_t or not close_t:
            continue

        try:
            start = int(datetime.fromisoformat(open_t.replace("Z", "+00:00")).timestamp())
            end = int(datetime.fromisoformat(close_t.replace("Z", "+00:00")).timestamp())
        except Exception:
            continue

        tickers_with_ts.append({
            "ticker": ticker,
            "league": league,
            "series_ticker": m.get("series_ticker", ""),
            "start_ts": start,
            "end_ts": end,
        })

    print(f"  Markets with valid time windows: {len(tickers_with_ts)}")

    # Group into batches of 100 with similar time windows
    # For simplicity, use a global window = min(start)..max(end) for each batch
    batch_size = 100
    for i in range(0, len(tickers_with_ts), batch_size):
        batch = tickers_with_ts[i : i + batch_size]
        batch_tickers = [b["ticker"] for b in batch]
        batch_start = min(b["start_ts"] for b in batch)
        batch_end = max(b["end_ts"] for b in batch)
        league_map = {b["ticker"]: b["league"] for b in batch}

        batch_num = i // batch_size + 1
        total_batches = (len(tickers_with_ts) + batch_size - 1) // batch_size
        print(f"    Batch {batch_num}/{total_batches}: {len(batch_tickers)} tickers...")

        result = api.get_batch_candlesticks(
            tickers=batch_tickers,
            start_ts=batch_start,
            end_ts=batch_end,
            period_interval=period_interval,
        )

        batch_candles = 0
        for ticker, candles in result.items():
            lg = league_map.get(ticker, "")
            for c in candles:
                row = _parse_candle(ticker, lg, c)
                all_candle_rows.append(row)
                batch_candles += 1

        if batch_num % 10 == 0 or batch_num == total_batches:
            print(f"      → cumulative candle rows: {len(all_candle_rows)}")

    print(f"\n  ✅ Phase 2 complete: {len(all_candle_rows)} candlestick rows")
    return all_candle_rows


# ─── Phase 3: Fetch tick-level trade data ───────────────────────────────────────

def phase3_ticks(
    api: KalshiAPI,
    markets: list[dict],
    max_trades_per_market: int = 200,
) -> list[dict]:
    """
    Fetch individual trades for each market.
    Each trade = one tick with price, size, taker_side.
    """
    print("\n" + "=" * 65)
    print(f"  PHASE 3: Fetching tick-level trades (up to {max_trades_per_market}/market)")
    print("=" * 65)

    all_tick_rows = []
    total = len(markets)

    for idx, m in enumerate(markets):
        ticker = m["ticker"]
        league = m.get("_league", "")

        # Get time window
        open_t = m.get("open_time")
        close_t = m.get("close_time") or m.get("expiration_time")
        min_ts = None
        max_ts = None
        try:
            if open_t:
                min_ts = int(datetime.fromisoformat(open_t.replace("Z", "+00:00")).timestamp())
            if close_t:
                max_ts = int(datetime.fromisoformat(close_t.replace("Z", "+00:00")).timestamp())
        except Exception:
            pass

        trades = api.get_trades(
            ticker=ticker,
            min_ts=min_ts,
            max_ts=max_ts,
            max_trades=max_trades_per_market,
        )

        for t in trades:
            yes_p = safe_float(t.get("yes_price_dollars"))
            no_p = safe_float(t.get("no_price_dollars"))
            count = safe_float(t.get("count_fp"))

            all_tick_rows.append({
                "ticker": ticker,
                "league": league,
                "trade_id": t.get("trade_id"),
                "created_time": t.get("created_time"),
                "yes_price": yes_p,
                "no_price": no_p,
                "count": count,
                "taker_side": t.get("taker_side"),  # "yes" or "no"
                # Derived
                "implied_prob": yes_p,
                "odds_multiplier_yes": (1.0 / yes_p) if yes_p and yes_p > 0 else None,
                "odds_multiplier_no": (1.0 / no_p) if no_p and no_p > 0 else None,
                "notional": (count * 1.0) if count else None,  # $1 per contract
            })

        if (idx + 1) % 200 == 0 or idx == total - 1:
            print(f"    [{idx+1}/{total}] total ticks: {len(all_tick_rows)}")

    print(f"\n  ✅ Phase 3 complete: {len(all_tick_rows)} trade ticks")
    return all_tick_rows


# ─── Flatten market metadata with derived betting fields ────────────────────────

def flatten_market(m: dict) -> dict:
    """Convert raw market dict to flat row with betting-algo–ready fields."""
    last_p = safe_float(m.get("last_price_dollars"))
    yes_bid = safe_float(m.get("yes_bid_dollars"))
    yes_ask = safe_float(m.get("yes_ask_dollars"))
    no_bid = safe_float(m.get("no_bid_dollars"))
    no_ask = safe_float(m.get("no_ask_dollars"))
    settle_val = safe_float(m.get("settlement_value_dollars"))
    volume = safe_float(m.get("volume_fp"))
    oi = safe_float(m.get("open_interest_fp"))
    result_raw = m.get("result")  # "yes", "no", "all_no", etc.

    # Binary result: 1 if YES won, 0 if NO won
    result_binary = None
    if result_raw == "yes":
        result_binary = 1
    elif result_raw in ("no", "all_no"):
        result_binary = 0

    # Implied probability at last trade
    implied_prob = last_p

    # Odds multipliers
    odds_yes = (1.0 / last_p) if last_p and last_p > 0 else None
    odds_no = (1.0 / (1.0 - last_p)) if last_p and last_p < 1.0 else None

    # Retrospective edge: if you bought YES at last_price, what was your P&L per $1?
    # edge_yes = result_binary * (1/price) - 1  → positive means profitable
    edge_yes = None
    edge_no = None
    if result_binary is not None and odds_yes is not None:
        edge_yes = result_binary * odds_yes - 1.0
    if result_binary is not None and odds_no is not None:
        edge_no = (1 - result_binary) * odds_no - 1.0

    return {
        "ticker": m.get("ticker"),
        "event_ticker": m.get("event_ticker"),
        "series_ticker": m.get("series_ticker", ""),
        "league": m.get("_league", ""),
        "title": m.get("title", ""),
        "subtitle": m.get("subtitle", m.get("sub_title", "")),
        "yes_sub_title": m.get("yes_sub_title", ""),
        "no_sub_title": m.get("no_sub_title", ""),
        "market_type": m.get("market_type"),
        "status": m.get("status"),
        # ── Result ──
        "result": result_raw,
        "result_binary": result_binary,        # 1=YES won, 0=NO won
        "settlement_value": settle_val,
        # ── Prices ──
        "last_price": last_p,                  # = implied probability at close
        "yes_bid": yes_bid,
        "yes_ask": yes_ask,
        "no_bid": no_bid,
        "no_ask": no_ask,
        # ── Probability & Odds (your algo's core inputs) ──
        "implied_prob_close": implied_prob,     # P(YES) at market close
        "odds_multiplier_yes": odds_yes,        # payout ratio buying YES
        "odds_multiplier_no": odds_no,          # payout ratio buying NO
        "edge_yes": edge_yes,                   # retrospective: profit/loss per $1 YES
        "edge_no": edge_no,                     # retrospective: profit/loss per $1 NO
        # ── Volume / Liquidity ──
        "volume": volume,
        "open_interest": oi,
        "spread": (yes_ask - yes_bid) if yes_ask is not None and yes_bid is not None else None,
        "notional_value": safe_float(m.get("notional_value_dollars")),
        # ── Timestamps ──
        "open_time": m.get("open_time"),
        "close_time": m.get("close_time"),
        "expiration_time": m.get("expiration_time") or m.get("latest_expiration_time"),
        "settlement_ts": m.get("settlement_ts"),
        "created_time": m.get("created_time"),
        # ── Strike / line info ──
        "strike_type": m.get("strike_type"),
        "floor_strike": m.get("floor_strike"),
        "cap_strike": m.get("cap_strike"),
        "functional_strike": m.get("functional_strike"),
        "can_close_early": m.get("can_close_early"),
        "rules_primary": (m.get("rules_primary") or "")[:300],
    }


# ─── Save everything ────────────────────────────────────────────────────────────

def save_all(
    markets: list[dict],
    candle_rows: list[dict],
    tick_rows: list[dict],
    output_dir: str,
    api_requests: int,
):
    os.makedirs(output_dir, exist_ok=True)

    # 1. Markets
    flat = [flatten_market(m) for m in markets]
    df_m = pd.DataFrame(flat)
    if not df_m.empty and "close_time" in df_m.columns:
        df_m = df_m.sort_values("close_time", ascending=False)
    df_m.to_csv(os.path.join(output_dir, "markets.csv"), index=False)
    print(f"  ✓ markets.csv              ({len(df_m)} rows)")

    # 2. Candlesticks
    if candle_rows:
        df_c = pd.DataFrame(candle_rows)
        if "end_period_ts" in df_c.columns:
            df_c = df_c.sort_values(["ticker", "end_period_ts"])
        df_c.to_csv(os.path.join(output_dir, "candlesticks.csv"), index=False)
        print(f"  ✓ candlesticks.csv         ({len(df_c)} rows)")
    else:
        print(f"  ⚠ candlesticks.csv         (skipped)")

    # 3. Trades / ticks
    if tick_rows:
        df_t = pd.DataFrame(tick_rows)
        if "created_time" in df_t.columns:
            df_t = df_t.sort_values(["ticker", "created_time"])
        df_t.to_csv(os.path.join(output_dir, "trades.csv"), index=False)
        print(f"  ✓ trades.csv               ({len(df_t)} rows)")
    else:
        print(f"  ⚠ trades.csv               (skipped)")

    # 4. Raw JSON
    raw_path = os.path.join(output_dir, "raw_markets.json")
    with open(raw_path, "w") as f:
        json.dump(markets, f, indent=2, default=str)
    print(f"  ✓ raw_markets.json         (full API data)")

    # 5. Summary
    nba_count = sum(1 for m in flat if m.get("league") == "NBA")
    ncaa_count = sum(1 for m in flat if m.get("league") == "NCAA")
    summary = {
        "scrape_time": datetime.now(timezone.utc).isoformat(),
        "total_markets": len(flat),
        "nba_markets": nba_count,
        "ncaa_markets": ncaa_count,
        "candlestick_rows": len(candle_rows),
        "trade_tick_rows": len(tick_rows),
        "api_requests_made": api_requests,
        "unique_series_tickers": list(set(m.get("series_ticker", "") for m in flat if m.get("series_ticker"))),
    }
    with open(os.path.join(output_dir, "scrape_summary.json"), "w") as f:
        json.dump(summary, f, indent=2)
    print(f"  ✓ scrape_summary.json")


# ─── CLI ────────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Kalshi Basketball Scraper v2")
    p.add_argument("--max-markets", "-m", type=int, default=10000,
                   help="Max markets to collect (default: 10000)")
    p.add_argument("--days-back", "-d", type=int, default=180,
                   help="How far back to look (default: 180)")
    p.add_argument("--candle-interval", "-c", type=int, default=60,
                   choices=[1, 60, 1440],
                   help="Candlestick interval in minutes: 1, 60, 1440 (default: 60)")
    p.add_argument("--max-ticks", type=int, default=200,
                   help="Max trades per market (default: 200)")
    p.add_argument("--skip-candles", action="store_true",
                   help="Skip candlestick fetching")
    p.add_argument("--skip-ticks", action="store_true",
                   help="Skip trade/tick fetching")
    p.add_argument("--output-dir", "-o", default="./kalshi_data",
                   help="Output directory (default: ./kalshi_data)")
    args = p.parse_args()

    print("╔" + "═" * 63 + "╗")
    print("║  Kalshi Basketball Scraper v2 — Ticks + K-Lines + Odds       ║")
    print("╠" + "═" * 63 + "╣")
    print(f"║  Max markets:      {args.max_markets:<43}║")
    print(f"║  Days back:        {args.days_back:<43}║")
    print(f"║  Candle interval:  {args.candle_interval}min{' ':39}║")
    print(f"║  Max ticks/market: {args.max_ticks:<43}║")
    print(f"║  Skip candles:     {str(args.skip_candles):<43}║")
    print(f"║  Skip ticks:       {str(args.skip_ticks):<43}║")
    print(f"║  Output:           {args.output_dir:<43}║")
    print("╚" + "═" * 63 + "╝")

    api = KalshiAPI()

    # Phase 1
    markets = phase1_collect_markets(api, args.days_back, args.max_markets)
    if not markets:
        print("\n  ✗ No basketball markets found. Exiting.")
        sys.exit(1)

    # Phase 2
    candle_rows = []
    if not args.skip_candles:
        candle_rows = phase2_candlesticks(api, markets, args.candle_interval)

    # Phase 3
    tick_rows = []
    if not args.skip_ticks:
        tick_rows = phase3_ticks(api, markets, args.max_ticks)

    # Save
    print("\n" + "=" * 65)
    print("  SAVING RESULTS")
    print("=" * 65)
    save_all(markets, candle_rows, tick_rows, args.output_dir, api.request_count)

    # Final summary
    nba = sum(1 for m in markets if m.get("_league") == "NBA")
    ncaa = len(markets) - nba
    print("\n╔" + "═" * 63 + "╗")
    print("║  ✅ SCRAPE COMPLETE" + " " * 44 + "║")
    print(f"║  NBA:  {nba:<55}║")
    print(f"║  NCAA: {ncaa:<55}║")
    print(f"║  Candlestick rows: {len(candle_rows):<43}║")
    print(f"║  Trade tick rows:  {len(tick_rows):<43}║")
    print(f"║  API requests:     {api.request_count:<43}║")
    print("╚" + "═" * 63 + "╝")


if __name__ == "__main__":
    main()
