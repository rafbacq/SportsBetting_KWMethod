# Kalshi Scraper v2 — Output Data Dictionary

## Quick Start

```bash
pip install requests pandas

# Full scrape: ~10k markets + hourly candles + ticks
python kalshi_scraper_v2.py

# Fast mode: markets only, no candle/tick data
python kalshi_scraper_v2.py --skip-candles --skip-ticks

# Fine-grained: 5k markets, 1-minute candles, 500 ticks each
python kalshi_scraper_v2.py -m 5000 --candle-interval 1 --max-ticks 500
```

---

## How Kalshi Pricing Maps to Probability & Odds

Kalshi contracts settle at **$1.00** if YES, **$0.00** if NO.

```
yes_price = $0.35  →  market says 35% chance YES wins
                   →  if you buy YES at $0.35 and it wins, you get $1.00
                   →  odds_multiplier_yes = 1/0.35 = 2.86×  (your money × 2.86)
                   →  odds_multiplier_no  = 1/0.65 = 1.54×

If YES wins:   profit = $1.00 - $0.35 = $0.65  per contract
If NO  wins:   profit = $1.00 - $0.65 = $0.35  per contract
```

Your betting algo core equation:

```
expected_value_yes = P(actual_win) × odds_multiplier_yes - 1
expected_value_no  = P(actual_loss) × odds_multiplier_no  - 1

Bet YES when: your_estimated_prob > implied_prob (market underprices YES)
Bet NO  when: your_estimated_prob < implied_prob (market overprices YES)
```

---

## File: `markets.csv`

One row per settled market. This is your primary dataset.

| Column | Type | Description |
|--------|------|-------------|
| `ticker` | str | Unique market ID (e.g., `KXNBA-25MAR21-LAL-BOS`) |
| `event_ticker` | str | Parent event/game ID |
| `series_ticker` | str | Series grouping (e.g., `KXNBA`) |
| `league` | str | `NBA` or `NCAA` |
| `title` | str | Full market description |
| `result` | str | Raw result: `yes`, `no`, `all_no` |
| **`result_binary`** | **int** | **1 = YES won, 0 = NO won** |
| **`implied_prob_close`** | **float** | **Market's closing probability for YES (0–1)** |
| **`odds_multiplier_yes`** | **float** | **Payout multiplier if you buy YES = 1/price** |
| **`odds_multiplier_no`** | **float** | **Payout multiplier if you buy NO = 1/(1-price)** |
| **`edge_yes`** | **float** | **Retrospective P&L: result × odds_yes - 1** |
| **`edge_no`** | **float** | **Retrospective P&L: (1-result) × odds_no - 1** |
| `last_price` | float | Final trade price (= implied_prob_close) |
| `yes_bid` / `yes_ask` | float | Final bid/ask for YES contracts |
| `no_bid` / `no_ask` | float | Final bid/ask for NO contracts |
| `spread` | float | yes_ask - yes_bid (market tightness) |
| `volume` | float | Total contracts traded |
| `open_interest` | float | Outstanding contracts at close |
| `settlement_value` | float | Settlement payout per contract |
| `functional_strike` | str | Spread/total line (for spread & totals markets) |
| `strike_type` | str | `greater`, `less`, etc. |
| `open_time` | ISO | When trading opened |
| `close_time` | ISO | When trading closed |

### How to use `edge_yes` / `edge_no`

These are **retrospective** — they tell you what would have happened if you bought at the closing price.

- `edge_yes = +1.86` → buying YES at close would have returned +186% (it won, odds were 2.86×)
- `edge_yes = -1.00` → buying YES at close would have lost 100% (it lost)
- `edge_no = +0.54`  → buying NO at close would have returned +54%

Filter for profitable patterns:
```python
# Markets where YES was underpriced (won at high odds)
df[(df.result_binary == 1) & (df.odds_multiplier_yes > 2.0)]

# Markets where favorite (high prob) still won
df[(df.result_binary == 1) & (df.implied_prob_close > 0.7)]
```

---

## File: `candlesticks.csv`

K-line / OHLC data. Multiple rows per market (one per time period).

| Column | Type | Description |
|--------|------|-------------|
| `ticker` | str | Market ID |
| `league` | str | NBA / NCAA |
| `end_period_ts` | int | Unix timestamp for candle period end |
| **`price_open`** | **float** | **Opening probability for the period** |
| **`price_high`** | **float** | **Highest probability during period** |
| **`price_low`** | **float** | **Lowest probability during period** |
| **`price_close`** | **float** | **Closing probability for period** |
| `price_mean` | float | Mean probability during period |
| `price_previous` | float | Previous period's closing price |
| `yes_bid_open/close` | float | Bid side OHLC |
| `yes_ask_open/close` | float | Ask side OHLC |
| `volume` | float | Contracts traded in this period |
| `open_interest` | float | Open interest at period end |
| **`implied_prob`** | **float** | **= price_close (convenience alias)** |
| **`odds_multiplier_yes`** | **float** | **1 / price_close** |
| **`odds_multiplier_no`** | **float** | **1 / (1 - price_close)** |
| **`spread`** | **float** | **ask_close - bid_close** |

### K-line analysis patterns

```python
# Load candles for a specific game
game = df_candles[df_candles.ticker == 'KXNBA-25MAR21-LAL-BOS']
game = game.sort_values('end_period_ts')

# Probability trajectory over the game
plt.plot(game.end_period_ts, game.implied_prob)

# Volatility = high - low range per candle
game['volatility'] = game.price_high - game.price_low

# Momentum = close - open
game['momentum'] = game.price_close - game.price_open

# Find "odds collapse" moments (big probability swing)
big_swings = game[game.volatility > 0.15]
```

---

## File: `trades.csv`

Tick-level individual trades. Finest granularity available.

| Column | Type | Description |
|--------|------|-------------|
| `ticker` | str | Market ID |
| `league` | str | NBA / NCAA |
| `trade_id` | str | Unique trade ID |
| `created_time` | ISO | Trade execution timestamp |
| **`yes_price`** | **float** | **Price of YES contract (= implied prob)** |
| **`no_price`** | **float** | **Price of NO contract (= 1 - yes_price)** |
| `count` | float | Number of contracts in this trade |
| **`taker_side`** | **str** | **`yes` or `no` — which side initiated** |
| `implied_prob` | float | = yes_price |
| `odds_multiplier_yes` | float | 1 / yes_price |
| `odds_multiplier_no` | float | 1 / no_price |
| `notional` | float | Dollar notional (count × $1) |

### Tick analysis patterns

```python
# Taker-side imbalance (buy pressure indicator)
trades = df_trades[df_trades.ticker == 'SOME_TICKER']
yes_volume = trades[trades.taker_side == 'yes']['count'].sum()
no_volume = trades[trades.taker_side == 'no']['count'].sum()
imbalance = (yes_volume - no_volume) / (yes_volume + no_volume)

# VWAP (volume-weighted average probability)
vwap = (trades.yes_price * trades['count']).sum() / trades['count'].sum()

# Price impact: large trades vs small trades
large = trades[trades['count'] > trades['count'].quantile(0.9)]
small = trades[trades['count'] < trades['count'].quantile(0.5)]
```

---

## Runtime Estimates

| Config | Markets | API Calls | Est. Time |
|--------|---------|-----------|-----------|
| `--skip-candles --skip-ticks` | 10,000 | ~30 | ~15s |
| `--skip-ticks` (candles only) | 10,000 | ~130 | ~2min |
| Full (candles + ticks) | 10,000 | ~10,130 | ~60–90min |
| `--skip-candles -m 2000` | 2,000 | ~2,030 | ~15min |
| `-m 1000 --max-ticks 50` | 1,000 | ~1,030 | ~8min |

The tick phase dominates runtime (1 API call per market). Adjust `--max-ticks` and `--max-markets` to balance coverage vs speed.
