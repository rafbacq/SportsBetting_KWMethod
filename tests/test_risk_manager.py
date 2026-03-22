"""Tests for the risk management module."""

import pytest

from src.risk_manager import PositionStatus, RiskConfig, RiskManager


@pytest.fixture
def risk_mgr():
    config = RiskConfig(
        max_position_size_pct=0.10,
        stop_loss_pct=0.15,
        take_profit_pct=0.25,
        kelly_fraction=0.25,
        max_concurrent_positions=3,
    )
    return RiskManager(initial_capital=10000.0, config=config)


def test_kelly_sizing(risk_mgr):
    fraction = risk_mgr.calculate_kelly_size(
        win_probability=0.60,
        win_payout=1.0,
        loss_amount=1.0,
    )
    # Kelly = (1*0.6 - 0.4)/1 = 0.2; quarter Kelly = 0.05
    assert 0.0 < fraction <= 0.10


def test_position_sizing(risk_mgr):
    qty = risk_mgr.size_position(price=0.50)
    assert qty > 0
    # With 10000 capital and max 10% position, max $1000
    assert qty * 0.50 <= 1000


def test_open_position(risk_mgr):
    pos = risk_mgr.open_position("evt1", "TeamA", 0.50, 10, 0.0)
    assert pos is not None
    assert pos.status == PositionStatus.OPEN
    assert risk_mgr.capital == 10000.0 - 0.50 * 10


def test_max_concurrent_positions(risk_mgr):
    for i in range(3):
        risk_mgr.open_position(f"evt{i}", "Team", 0.50, 5, float(i))

    assert len(risk_mgr.open_positions) == 3
    assert not risk_mgr.can_open_position()

    # Should return None when limit reached
    pos = risk_mgr.open_position("evt4", "Team", 0.50, 5, 4.0)
    assert pos is None


def test_stop_loss(risk_mgr):
    pos = risk_mgr.open_position("evt1", "TeamA", 1.00, 10, 0.0)
    # Price drops 20% — beyond 15% stop loss
    result = risk_mgr.check_exit_conditions(pos, 0.80)
    assert result == PositionStatus.CLOSED_STOP_LOSS


def test_take_profit(risk_mgr):
    pos = risk_mgr.open_position("evt1", "TeamA", 0.50, 10, 0.0)
    # Price rises 30% — beyond 25% take profit
    result = risk_mgr.check_exit_conditions(pos, 0.65)
    assert result == PositionStatus.CLOSED_TAKE_PROFIT


def test_close_position_pnl(risk_mgr):
    pos = risk_mgr.open_position("evt1", "TeamA", 0.50, 10, 0.0)
    initial = risk_mgr.capital

    pnl = risk_mgr.close_position(pos, 0.60, 1.0, PositionStatus.CLOSED_TAKE_PROFIT)
    assert pnl == pytest.approx((0.60 - 0.50) * 10)
    assert risk_mgr.capital == pytest.approx(initial + 0.60 * 10)


def test_trailing_stop(risk_mgr):
    config = RiskConfig(trailing_stop_pct=0.10, stop_loss_pct=0.50, take_profit_pct=0.50)
    mgr = RiskManager(10000, config)
    pos = mgr.open_position("evt1", "TeamA", 0.50, 10, 0.0)

    # Price rises to 0.70
    mgr.check_exit_conditions(pos, 0.70)
    assert pos.highest_price_since_entry == 0.70

    # Price drops to 0.62 — 11.4% drop from high, triggers trailing stop
    result = mgr.check_exit_conditions(pos, 0.62)
    assert result == PositionStatus.CLOSED_STOP_LOSS


def test_portfolio_summary(risk_mgr):
    pos = risk_mgr.open_position("evt1", "TeamA", 0.50, 10, 0.0)
    risk_mgr.close_position(pos, 0.60, 1.0, PositionStatus.CLOSED_TAKE_PROFIT)

    summary = risk_mgr.get_portfolio_summary()
    assert summary["closed_trades"] == 1
    assert summary["winning_trades"] == 1
    assert summary["win_rate"] == 1.0
