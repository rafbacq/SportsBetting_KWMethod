# SportsBetting_KWMethod

Submitted to the HackDuke Hackathon.

## Overview

A win-probability mean-reversion trading system for sports prediction markets (Kalshi). The core strategy buys contracts when a team's win probability hits a local minimum and sells at local maxima, capturing profit from natural probability fluctuations during live games.

## Architecture

```
src/
  signal_processor.py  — EMA smoothing + peak/valley detection with prominence filtering
  risk_manager.py      — Fractional Kelly sizing, stop-loss, trailing stops, portfolio limits
  kalshi_client.py     — Kalshi REST API client for market data and order execution
  backtester.py        — Full backtesting engine with synthetic data generation
  trading_engine.py    — Live trading loop tying all modules together
app.py                 — Streamlit UI with 4 views (dashboard, backtest, signal explorer, config)
configs/default.json   — Default parameters
tests/                 — Pytest suite (22 tests)
```

## Quick Start

```bash
pip install -r requirements.txt

# Run the UI
streamlit run app.py

# Run tests
python -m pytest tests/ -v
```

## Key Techniques

- **Signal Detection**: Exponential Moving Average (EMA) smoothing + scipy `find_peaks` with prominence thresholds to filter noise from meaningful swings
- **Confirmation**: Signals require N subsequent ticks confirming the reversal before emitting
- **Risk Management**: Fractional Kelly criterion (quarter-Kelly default), 15% stop-loss, 10% trailing stop, max 5 concurrent positions
- **Backtesting**: Ornstein-Uhlenbeck synthetic game generation for strategy evaluation with slippage and commission modeling

## Configuration

Edit `configs/default.json` or use the Configuration page in the UI. Set Kalshi credentials in `.env` (see `.env.example`).
