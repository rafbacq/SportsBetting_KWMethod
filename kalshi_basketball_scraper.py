"""
Kalshi Basketball Market Scraper
================================
Scrapes settled NBA and NCAA basketball markets from Kalshi's public API.
No authentication required for read-only market data.

Usage:
    python kalshi_basketball_scraper.py [--output-dir ./data] [--format csv] [--days-back 90]

Output:
    - nba_settled_markets.csv / .json
    - ncaa_settled_markets.csv / .json
    - all_basketball_settled_markets.csv / .json  (combined)
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

# ─── Configuration ──────────────────────────────────────────────────────────────

BASE_URL = "https://api.elections.kalshi.com/trade-api/v2"

# Rate limit: be polite — ~2 requests/sec
REQUEST_DELAY = 0.5

# Known basketball-related keywords for title matching (fallback filter)
NBA_KEYWORDS = [
    "nba", "lakers", "celtics", "warriors", "knicks", "nets", "bucks",
    "76ers", "suns", "nuggets", "heat", "bulls", "cavaliers", "mavericks",
    "clippers", "thunder", "timberwolves", "grizzlies", "hawks", "hornets",
    "wizards", "pacers", "pistons", "magic", "raptors", "kings", "spurs",
    "rockets", "pelicans", "blazers", "jazz", "trail blazers",
    "pro basketball",
]

NCAA_KEYWORDS = [
    "ncaa", "march madness", "college basketball", "ncaab",
    "final four", "sweet sixteen", "elite eight",
    "tournament", "college hoops",
    # Conference names
    "big ten", "big 12", "sec ", "acc ", "big east", "pac-12",
]


# ─── API Client ─────────────────────────────────────────────────────────────────

class KalshiClient:
    """Lightweight client for Kalshi's public (unauthenticated) API."""

    def __init__(self, base_url: str = BASE_URL, delay: float = REQUEST_DELAY):
        self.base_url = base_url
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "User-Agent": "KalshiBasketballScraper/1.0",
        })

    def _get(self, endpoint: str, params: dict = None) -> dict:
        """Make a GET request with rate limiting and error handling."""
        url = f"{self.base_url}{endpoint}"
        time.sleep(self.delay)

        try:
            resp = self.session.get(url, params=params, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as e:
            if resp.status_code == 429:
                print("  ⚠ Rate limited — waiting 10s...")
                time.sleep(10)
                return self._get(endpoint, params)
            print(f"  ✗ HTTP {resp.status_code} for {endpoint}: {e}")
            raise
        except requests.exceptions.RequestException as e:
            print(f"  ✗ Request failed for {endpoint}: {e}")
            raise

    # ── Discovery ────────────────────────────────────────────────────────────

    def get_sports_filters(self) -> dict:
        """Get all available sports filters (series tickers, competitions)."""
        return self._get("/search/filters_by_sport")

    def get_series_list(self) -> list[dict]:
        """Get all available series."""
        data = self._get("/market/get_series_list")
        return data.get("series", [])

    # ── Events ───────────────────────────────────────────────────────────────

    def get_events(
        self,
        status: str = "settled",
        series_ticker: str = None,
        limit: int = 200,
        with_nested_markets: bool = True,
    ) -> list[dict]:
        """Paginate through all events matching filters."""
        all_events = []
        cursor = None

        while True:
            params = {
                "limit": limit,
                "status": status,
                "with_nested_markets": str(with_nested_markets).lower(),
            }
            if series_ticker:
                params["series_ticker"] = series_ticker
            if cursor:
                params["cursor"] = cursor

            data = self._get("/events", params)
            events = data.get("events", [])
            all_events.extend(events)

            cursor = data.get("cursor", "")
            print(f"    Fetched {len(events)} events (total: {len(all_events)})  cursor={'...' if cursor else 'DONE'}")
            if not cursor or not events:
                break

        return all_events

    # ── Markets ──────────────────────────────────────────────────────────────

    def get_markets(
        self,
        status: str = "settled",
        series_ticker: str = None,
        event_ticker: str = None,
        min_close_ts: int = None,
        max_close_ts: int = None,
        min_settled_ts: int = None,
        max_settled_ts: int = None,
        limit: int = 1000,
    ) -> list[dict]:
        """Paginate through all markets matching filters."""
        all_markets = []
        cursor = None

        while True:
            params = {"limit": limit, "mve_filter": "exclude"}
            if status:
                params["status"] = status
            if series_ticker:
                params["series_ticker"] = series_ticker
            if event_ticker:
                params["event_ticker"] = event_ticker
            if min_close_ts:
                params["min_close_ts"] = min_close_ts
            if max_close_ts:
                params["max_close_ts"] = max_close_ts
            if min_settled_ts:
                params["min_settled_ts"] = min_settled_ts
            if max_settled_ts:
                params["max_settled_ts"] = max_settled_ts
            if cursor:
                params["cursor"] = cursor

            data = self._get("/markets", params)
            markets = data.get("markets", [])
            all_markets.extend(markets)

            cursor = data.get("cursor", "")
            if len(all_markets) % 5000 < limit:
                print(f"    Fetched {len(markets)} markets (total: {len(all_markets)})")
            if not cursor or not markets:
                break

        return all_markets

    # ── Historical Markets (for data older than the cutoff) ──────────────────

    def get_historical_cutoff(self) -> dict:
        """Get the historical data cutoff timestamps."""
        return self._get("/historical/cutoff_timestamps")

    def get_historical_markets(
        self,
        series_ticker: str = None,
        min_close_ts: int = None,
        max_close_ts: int = None,
        limit: int = 1000,
    ) -> list[dict]:
        """Paginate through historical markets (before cutoff)."""
        all_markets = []
        cursor = None

        while True:
            params = {"limit": limit}
            if series_ticker:
                params["series_ticker"] = series_ticker
            if min_close_ts:
                params["min_close_ts"] = min_close_ts
            if max_close_ts:
                params["max_close_ts"] = max_close_ts
            if cursor:
                params["cursor"] = cursor

            try:
                data = self._get("/historical/markets", params)
            except Exception:
                print("    ⚠ Historical endpoint unavailable or returned error.")
                break

            markets = data.get("markets", [])
            all_markets.extend(markets)

            cursor = data.get("cursor", "")
            if len(all_markets) % 5000 < limit:
                print(f"    Fetched {len(markets)} historical markets (total: {len(all_markets)})")
            if not cursor or not markets:
                break

        return all_markets

    # ── Trades for a market ──────────────────────────────────────────────────

    def get_trades(self, ticker: str = None, limit: int = 1000) -> list[dict]:
        """Get trades, optionally filtered by market ticker."""
        all_trades = []
        cursor = None

        while True:
            params = {"limit": limit}
            if ticker:
                params["ticker"] = ticker
            if cursor:
                params["cursor"] = cursor

            data = self._get("/markets/trades", params)
            trades = data.get("trades", [])
            all_trades.extend(trades)

            cursor = data.get("cursor", "")
            if not cursor or not trades:
                break

        return all_trades


# ─── Classification ─────────────────────────────────────────────────────────────

def classify_basketball_market(market: dict) -> Optional[str]:
    """
    Classify a market as 'NBA', 'NCAA', or None.
    Uses series_ticker first, then falls back to title/subtitle keyword matching.
    """
    series = (market.get("series_ticker") or "").lower()
    event = (market.get("event_ticker") or "").lower()
    title = (market.get("title") or "").lower()
    subtitle = (market.get("subtitle") or market.get("sub_title") or "").lower()
    rules = (market.get("rules_primary") or "").lower()
    combined = f"{series} {event} {title} {subtitle} {rules}"

    # ── Series-ticker–based (most reliable) ──────────────────────────────
    # Kalshi uses prefixed series tickers like KXNBA*, KXNCAAB*, etc.
    nba_series_patterns = ["kxnba", "nba"]
    ncaa_series_patterns = ["kxncaab", "kxncaam", "ncaab", "ncaam", "kxmm", "marchmad"]

    for pat in ncaa_series_patterns:
        if pat in series or pat in event:
            return "NCAA"
    for pat in nba_series_patterns:
        if pat in series or pat in event:
            return "NBA"

    # ── Keyword fallback ─────────────────────────────────────────────────
    for kw in NCAA_KEYWORDS:
        if kw in combined:
            return "NCAA"
    for kw in NBA_KEYWORDS:
        if kw in combined:
            return "NBA"

    return None


# ─── Data Processing ────────────────────────────────────────────────────────────

def flatten_market(market: dict) -> dict:
    """Extract the key fields from a market object into a flat dict."""
    return {
        "ticker": market.get("ticker"),
        "event_ticker": market.get("event_ticker"),
        "series_ticker": market.get("series_ticker", ""),
        "title": market.get("title", ""),
        "subtitle": market.get("subtitle", market.get("sub_title", "")),
        "yes_sub_title": market.get("yes_sub_title", ""),
        "no_sub_title": market.get("no_sub_title", ""),
        "status": market.get("status"),
        "result": market.get("result"),  # "yes", "no", or "all_no" etc.
        "market_type": market.get("market_type"),
        # Prices (dollar strings)
        "last_price_dollars": market.get("last_price_dollars"),
        "yes_bid_dollars": market.get("yes_bid_dollars"),
        "yes_ask_dollars": market.get("yes_ask_dollars"),
        "no_bid_dollars": market.get("no_bid_dollars"),
        "no_ask_dollars": market.get("no_ask_dollars"),
        "settlement_value_dollars": market.get("settlement_value_dollars"),
        # Volume
        "volume": market.get("volume_fp"),
        "open_interest": market.get("open_interest_fp"),
        # Timestamps
        "open_time": market.get("open_time"),
        "close_time": market.get("close_time"),
        "expiration_time": market.get("expiration_time") or market.get("latest_expiration_time"),
        "settlement_ts": market.get("settlement_ts"),
        "created_time": market.get("created_time"),
        # Strike / spread info
        "strike_type": market.get("strike_type"),
        "floor_strike": market.get("floor_strike"),
        "cap_strike": market.get("cap_strike"),
        "functional_strike": market.get("functional_strike"),
        # Rules
        "rules_primary": market.get("rules_primary", ""),
        "can_close_early": market.get("can_close_early"),
        "notional_value_dollars": market.get("notional_value_dollars"),
    }


# ─── Main Scraper Logic ─────────────────────────────────────────────────────────

def discover_basketball_series(client: KalshiClient) -> dict:
    """
    Hit the sports-filter endpoint to find basketball series tickers,
    then return them grouped as NBA / NCAA.
    """
    print("\n🔍 Step 1: Discovering basketball series tickers...")
    nba_tickers = set()
    ncaa_tickers = set()

    # Method 1: Sports filter endpoint
    try:
        filters = client.get_sports_filters()
        sports = filters.get("filters_by_sports", {})
        for sport_name, sport_data in sports.items():
            name_lower = sport_name.lower()
            if "basketball" not in name_lower and "hoops" not in name_lower:
                continue
            print(f"  Found sport: {sport_name}")
            # Extract series tickers from competitions / scopes
            competitions = sport_data if isinstance(sport_data, list) else sport_data.get("competitions", [])
            if isinstance(sport_data, dict):
                for key, val in sport_data.items():
                    val_str = json.dumps(val).lower()
                    if any(p in val_str for p in ["ncaa", "college", "march madness", "ncaam"]):
                        if isinstance(val, list):
                            for item in val:
                                if isinstance(item, dict) and "series_ticker" in item:
                                    ncaa_tickers.add(item["series_ticker"])
                    elif any(p in val_str for p in ["nba", "pro basketball"]):
                        if isinstance(val, list):
                            for item in val:
                                if isinstance(item, dict) and "series_ticker" in item:
                                    nba_tickers.add(item["series_ticker"])
    except Exception as e:
        print(f"  ⚠ Sports filter endpoint failed: {e}")

    # Method 2: Scan a sample of settled markets and collect series tickers
    print("  Scanning recent settled markets for basketball series tickers...")
    now = int(datetime.now(timezone.utc).timestamp())
    lookback = now - 60 * 86400  # 60 days
    try:
        sample_markets = client.get_markets(
            status="settled",
            min_settled_ts=lookback,
            limit=1000,
        )
        for m in sample_markets:
            cat = classify_basketball_market(m)
            st = m.get("series_ticker", "")
            if cat == "NBA" and st:
                nba_tickers.add(st)
            elif cat == "NCAA" and st:
                ncaa_tickers.add(st)
    except Exception as e:
        print(f"  ⚠ Market scan failed: {e}")

    print(f"  ✓ NBA series tickers found:  {nba_tickers or '(will use keyword filter)'}")
    print(f"  ✓ NCAA series tickers found: {ncaa_tickers or '(will use keyword filter)'}")
    return {"NBA": nba_tickers, "NCAA": ncaa_tickers}


def scrape_settled_basketball(
    client: KalshiClient,
    series_map: dict,
    days_back: int = 90,
) -> tuple[list[dict], list[dict]]:
    """
    Pull all settled NBA and NCAA basketball markets.
    Returns (nba_markets, ncaa_markets).
    """
    now_ts = int(datetime.now(timezone.utc).timestamp())
    cutoff_ts = now_ts - days_back * 86400

    nba_markets = []
    ncaa_markets = []

    # ── Pull by known series tickers first ───────────────────────────────
    for league, tickers in series_map.items():
        for st in tickers:
            print(f"\n📥 Fetching settled markets for series={st} ({league})...")
            markets = client.get_markets(
                status="settled",
                series_ticker=st,
                min_settled_ts=cutoff_ts,
            )
            for m in markets:
                m["_league"] = league
                m["series_ticker"] = m.get("series_ticker", st)

            if league == "NBA":
                nba_markets.extend(markets)
            else:
                ncaa_markets.extend(markets)
            print(f"    → {len(markets)} markets")

    # ── Broad scan to catch anything missed ──────────────────────────────
    print(f"\n📥 Running broad settled-market scan (last {days_back} days)...")
    all_settled = client.get_markets(
        status="settled",
        min_settled_ts=cutoff_ts,
    )
    print(f"    Total settled markets in window: {len(all_settled)}")

    seen_tickers = {m["ticker"] for m in nba_markets + ncaa_markets}
    added = 0
    for m in all_settled:
        if m["ticker"] in seen_tickers:
            continue
        cat = classify_basketball_market(m)
        if cat == "NBA":
            m["_league"] = "NBA"
            nba_markets.append(m)
            added += 1
        elif cat == "NCAA":
            m["_league"] = "NCAA"
            ncaa_markets.append(m)
            added += 1
    print(f"    → Added {added} additional basketball markets from broad scan")

    # ── Also try historical endpoint ─────────────────────────────────────
    print("\n📥 Checking historical endpoint for older data...")
    try:
        for league, tickers in series_map.items():
            for st in tickers:
                hist = client.get_historical_markets(
                    series_ticker=st,
                    min_close_ts=cutoff_ts,
                )
                new = [m for m in hist if m.get("ticker") not in seen_tickers]
                for m in new:
                    m["_league"] = league
                    seen_tickers.add(m["ticker"])
                if league == "NBA":
                    nba_markets.extend(new)
                else:
                    ncaa_markets.extend(new)
                if new:
                    print(f"    → {len(new)} historical markets for {st}")
    except Exception as e:
        print(f"    ⚠ Historical pull skipped: {e}")

    # Deduplicate
    nba_markets = _dedupe(nba_markets)
    ncaa_markets = _dedupe(ncaa_markets)

    return nba_markets, ncaa_markets


def _dedupe(markets: list[dict]) -> list[dict]:
    seen = set()
    out = []
    for m in markets:
        t = m.get("ticker")
        if t and t not in seen:
            seen.add(t)
            out.append(m)
    return out


# ─── Output ─────────────────────────────────────────────────────────────────────

def save_results(
    nba_markets: list[dict],
    ncaa_markets: list[dict],
    output_dir: str,
    fmt: str,
):
    os.makedirs(output_dir, exist_ok=True)

    nba_flat = [flatten_market(m) for m in nba_markets]
    ncaa_flat = [flatten_market(m) for m in ncaa_markets]
    combined = nba_flat + ncaa_flat

    # Add league column
    for row in nba_flat:
        row["league"] = "NBA"
    for row in ncaa_flat:
        row["league"] = "NCAA"
    for row in combined:
        if "league" not in row:
            row["league"] = "NBA" if row in nba_flat else "NCAA"

    datasets = {
        "nba_settled_markets": nba_flat,
        "ncaa_settled_markets": ncaa_flat,
        "all_basketball_settled_markets": combined,
    }

    for name, rows in datasets.items():
        df = pd.DataFrame(rows)
        if df.empty:
            print(f"  ⚠ {name}: no data to save")
            continue

        # Sort by close_time descending
        if "close_time" in df.columns:
            df = df.sort_values("close_time", ascending=False)

        if fmt in ("csv", "both"):
            path = os.path.join(output_dir, f"{name}.csv")
            df.to_csv(path, index=False)
            print(f"  ✓ Saved {path}  ({len(df)} rows)")

        if fmt in ("json", "both"):
            path = os.path.join(output_dir, f"{name}.json")
            df.to_json(path, orient="records", indent=2)
            print(f"  ✓ Saved {path}  ({len(df)} rows)")

    # Also save the raw JSON for full fidelity
    raw_path = os.path.join(output_dir, "raw_markets.json")
    with open(raw_path, "w") as f:
        json.dump({"nba": nba_markets, "ncaa": ncaa_markets}, f, indent=2)
    print(f"  ✓ Saved {raw_path}  (raw API responses)")


# ─── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Scrape settled NBA & NCAA basketball markets from Kalshi"
    )
    parser.add_argument(
        "--output-dir", "-o", default="./kalshi_data",
        help="Directory to save output files (default: ./kalshi_data)"
    )
    parser.add_argument(
        "--format", "-f", choices=["csv", "json", "both"], default="both",
        help="Output format (default: both)"
    )
    parser.add_argument(
        "--days-back", "-d", type=int, default=90,
        help="How many days back to scrape (default: 90)"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("  Kalshi Basketball Market Scraper")
    print("=" * 60)
    print(f"  Looking back: {args.days_back} days")
    print(f"  Output dir:   {args.output_dir}")
    print(f"  Format:       {args.format}")

    client = KalshiClient()

    # Step 1: Discover series tickers
    series_map = discover_basketball_series(client)

    # Step 2: Scrape settled markets
    print("\n" + "─" * 60)
    print("🏀 Step 2: Scraping settled basketball markets...")
    print("─" * 60)
    nba, ncaa = scrape_settled_basketball(client, series_map, args.days_back)

    # Step 3: Save
    print("\n" + "─" * 60)
    print("💾 Step 3: Saving results...")
    print("─" * 60)
    save_results(nba, ncaa, args.output_dir, args.format)

    # Summary
    print("\n" + "=" * 60)
    print("  ✅ DONE")
    print(f"  NBA markets:  {len(nba)}")
    print(f"  NCAA markets: {len(ncaa)}")
    print(f"  Total:        {len(nba) + len(ncaa)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
