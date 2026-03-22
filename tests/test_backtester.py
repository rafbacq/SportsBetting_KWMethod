"""Tests for the backtesting engine."""

import pytest

from src.backtester import BacktestConfig, Backtester, generate_synthetic_game
from src.signal_processor import SignalProcessorConfig
from src.risk_manager import RiskConfig


def test_synthetic_game_generation():
    ts, probs = generate_synthetic_game(duration=100, seed=42)
    assert len(ts) == 100
    assert len(probs) == 100
    assert all(0 < p < 1 for p in probs)


def test_synthetic_game_reproducibility():
    ts1, p1 = generate_synthetic_game(seed=42)
    ts2, p2 = generate_synthetic_game(seed=42)
    assert p1 == p2


def test_backtest_runs():
    ts, probs = generate_synthetic_game(duration=200, volatility=0.04, seed=42)
    config = BacktestConfig(
        initial_capital=10000,
        signal_config=SignalProcessorConfig(prominence_threshold=0.03, ema_span=3),
        risk_config=RiskConfig(stop_loss_pct=0.15, take_profit_pct=0.25),
    )
    bt = Backtester(config)
    result = bt.run(ts, probs)

    assert result.final_capital > 0
    assert len(result.equity_curve) == len(ts)
    assert result.total_trades >= 0


def test_backtest_equity_curve_length():
    ts, probs = generate_synthetic_game(duration=50, seed=1)
    bt = Backtester(BacktestConfig(initial_capital=5000))
    result = bt.run(ts, probs)
    assert len(result.equity_curve) == 50


def test_multi_game_backtest():
    games = []
    for i in range(3):
        ts, probs = generate_synthetic_game(duration=100, seed=i + 10)
        games.append({
            "timestamps": ts,
            "probabilities": probs,
            "event_id": f"game_{i}",
            "team": f"Team_{i}",
        })

    bt = Backtester(BacktestConfig(initial_capital=10000))
    result = bt.run_multi_game(games)

    assert result.final_capital > 0
    assert len(result.equity_curve) == 300  # 3 games * 100 ticks


def test_backtest_summary_string():
    ts, probs = generate_synthetic_game(duration=100, seed=42)
    bt = Backtester(BacktestConfig(initial_capital=10000))
    result = bt.run(ts, probs)

    summary = result.summary()
    assert "Total Trades" in summary
    assert "Win Rate" in summary
    assert "Sharpe Ratio" in summary
