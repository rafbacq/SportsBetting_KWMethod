"""
Backtesting engine for evaluating the KW win-probability trading strategy
on historical game data.

Simulates the full trading loop: signal detection -> position sizing ->
order execution -> risk checks -> position closure. Produces detailed
performance metrics and trade logs.
"""

from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

from src.risk_manager import Position, PositionStatus, RiskConfig, RiskManager
from src.signal_processor import SignalProcessorConfig, SignalProcessor, SignalType


@dataclass
class BacktestConfig:
    initial_capital: float = 10000.0
    commission_per_trade: float = 0.01  # $0.01 per contract
    slippage_pct: float = 0.005  # 0.5% slippage
    signal_config: Optional[SignalProcessorConfig] = None
    risk_config: Optional[RiskConfig] = None


@dataclass
class TradeRecord:
    event_id: str
    team: str
    entry_time: float
    exit_time: float
    entry_price: float
    exit_price: float
    quantity: int
    pnl: float
    exit_reason: str


@dataclass
class BacktestResult:
    trades: list[TradeRecord]
    equity_curve: list[float]
    timestamps: list[float]
    final_capital: float
    total_return_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float
    win_rate: float
    total_trades: int
    avg_trade_pnl: float
    profit_factor: float

    def summary(self) -> str:
        return (
            f"=== Backtest Results ===\n"
            f"Total Trades:    {self.total_trades}\n"
            f"Win Rate:        {self.win_rate:.1%}\n"
            f"Total Return:    {self.total_return_pct:.2f}%\n"
            f"Final Capital:   ${self.final_capital:,.2f}\n"
            f"Max Drawdown:    {self.max_drawdown_pct:.2f}%\n"
            f"Sharpe Ratio:    {self.sharpe_ratio:.3f}\n"
            f"Avg Trade PnL:   ${self.avg_trade_pnl:.2f}\n"
            f"Profit Factor:   {self.profit_factor:.2f}\n"
        )


class Backtester:
    def __init__(self, config: Optional[BacktestConfig] = None):
        self.config = config or BacktestConfig()

    def run(
        self,
        timestamps: list[float],
        probabilities: list[float],
        event_id: str = "backtest",
        team: str = "TeamA",
    ) -> BacktestResult:
        """Run a backtest on a single game's win probability series.

        Args:
            timestamps: List of time points (e.g., seconds elapsed).
            probabilities: Win probability at each time point.
            event_id: Identifier for the event being tested.
            team: Team name for positions.

        Returns:
            BacktestResult with full performance metrics.
        """
        sig_config = self.config.signal_config or SignalProcessorConfig()
        risk_config = self.config.risk_config or RiskConfig()

        processor = SignalProcessor(sig_config)
        risk_mgr = RiskManager(self.config.initial_capital, risk_config)

        trades: list[TradeRecord] = []
        equity_curve: list[float] = []
        active_position: Optional[Position] = None

        for ts, prob in zip(timestamps, probabilities):
            signal = processor.process_tick(ts, prob)
            price = prob  # In prediction markets, price ≈ probability

            # Check exit conditions on active position
            if active_position and active_position.status == PositionStatus.OPEN:
                exit_reason = risk_mgr.check_exit_conditions(active_position, price)
                if exit_reason is not None:
                    exit_price = price * (1 - self.config.slippage_pct)
                    pnl = risk_mgr.close_position(
                        active_position, exit_price, ts, exit_reason
                    )
                    trades.append(
                        TradeRecord(
                            event_id=event_id,
                            team=team,
                            entry_time=active_position.entry_timestamp,
                            exit_time=ts,
                            entry_price=active_position.entry_price,
                            exit_price=exit_price,
                            quantity=active_position.quantity,
                            pnl=pnl,
                            exit_reason=exit_reason.value,
                        )
                    )
                    active_position = None

            # Act on signals
            if signal.signal_type == SignalType.BUY and active_position is None:
                entry_price = price * (1 + self.config.slippage_pct)
                qty = risk_mgr.size_position(entry_price)
                if qty > 0:
                    active_position = risk_mgr.open_position(
                        event_id, team, entry_price, qty, ts
                    )

            elif signal.signal_type == SignalType.SELL and active_position is not None:
                if active_position.status == PositionStatus.OPEN:
                    exit_price = price * (1 - self.config.slippage_pct)
                    pnl = risk_mgr.close_position(
                        active_position,
                        exit_price,
                        ts,
                        PositionStatus.CLOSED_TAKE_PROFIT,
                    )
                    trades.append(
                        TradeRecord(
                            event_id=event_id,
                            team=team,
                            entry_time=active_position.entry_timestamp,
                            exit_time=ts,
                            entry_price=active_position.entry_price,
                            exit_price=exit_price,
                            quantity=active_position.quantity,
                            pnl=pnl,
                            exit_reason="SIGNAL_SELL",
                        )
                    )
                    active_position = None

            # Track equity
            mark_to_market = risk_mgr.capital
            if active_position and active_position.status == PositionStatus.OPEN:
                mark_to_market += price * active_position.quantity
            equity_curve.append(mark_to_market)

        # Close any remaining position at end
        if active_position and active_position.status == PositionStatus.OPEN:
            final_price = probabilities[-1] * (1 - self.config.slippage_pct)
            pnl = risk_mgr.close_position(
                active_position, final_price, timestamps[-1], PositionStatus.CLOSED_MANUAL
            )
            trades.append(
                TradeRecord(
                    event_id=event_id,
                    team=team,
                    entry_time=active_position.entry_timestamp,
                    exit_time=timestamps[-1],
                    entry_price=active_position.entry_price,
                    exit_price=final_price,
                    quantity=active_position.quantity,
                    pnl=pnl,
                    exit_reason="END_OF_GAME",
                )
            )

        return self._compute_results(
            trades, equity_curve, timestamps, risk_mgr.capital
        )

    def run_multi_game(
        self,
        games: list[dict],
    ) -> BacktestResult:
        """Run backtest across multiple games sequentially.

        Args:
            games: List of dicts with keys 'timestamps', 'probabilities',
                   'event_id', 'team'.
        """
        all_trades: list[TradeRecord] = []
        all_equity: list[float] = []
        all_timestamps: list[float] = []
        capital = self.config.initial_capital

        for game in games:
            game_config = BacktestConfig(
                initial_capital=capital,
                commission_per_trade=self.config.commission_per_trade,
                slippage_pct=self.config.slippage_pct,
                signal_config=self.config.signal_config,
                risk_config=self.config.risk_config,
            )
            bt = Backtester(game_config)
            result = bt.run(
                game["timestamps"],
                game["probabilities"],
                game.get("event_id", "game"),
                game.get("team", "TeamA"),
            )
            all_trades.extend(result.trades)
            all_equity.extend(result.equity_curve)
            offset = all_timestamps[-1] if all_timestamps else 0
            all_timestamps.extend([t + offset for t in result.timestamps])
            capital = result.final_capital

        return self._compute_results(all_trades, all_equity, all_timestamps, capital)

    def _compute_results(
        self,
        trades: list[TradeRecord],
        equity_curve: list[float],
        timestamps: list[float],
        final_capital: float,
    ) -> BacktestResult:
        total_trades = len(trades)
        wins = [t for t in trades if t.pnl > 0]
        losses = [t for t in trades if t.pnl <= 0]

        win_rate = len(wins) / total_trades if total_trades else 0
        avg_pnl = sum(t.pnl for t in trades) / total_trades if total_trades else 0

        gross_profit = sum(t.pnl for t in wins) if wins else 0
        gross_loss = abs(sum(t.pnl for t in losses)) if losses else 1
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")

        # Max drawdown
        eq = np.array(equity_curve) if equity_curve else np.array([self.config.initial_capital])
        peak = np.maximum.accumulate(eq)
        drawdown = (peak - eq) / peak
        max_drawdown = float(drawdown.max()) * 100

        # Sharpe ratio (annualized assuming ~250 trading periods)
        if len(eq) > 1:
            returns = np.diff(eq) / eq[:-1]
            sharpe = (
                float(np.mean(returns) / np.std(returns) * np.sqrt(250))
                if np.std(returns) > 0
                else 0
            )
        else:
            sharpe = 0

        return BacktestResult(
            trades=trades,
            equity_curve=equity_curve,
            timestamps=timestamps,
            final_capital=final_capital,
            total_return_pct=(final_capital - self.config.initial_capital)
            / self.config.initial_capital
            * 100,
            max_drawdown_pct=max_drawdown,
            sharpe_ratio=sharpe,
            win_rate=win_rate,
            total_trades=total_trades,
            avg_trade_pnl=avg_pnl,
            profit_factor=profit_factor,
        )


def generate_synthetic_game(
    duration: int = 200,
    initial_prob: float = 0.5,
    volatility: float = 0.03,
    mean_reversion_strength: float = 0.02,
    seed: Optional[int] = None,
) -> tuple[list[float], list[float]]:
    """Generate a synthetic win probability time series for testing.

    Uses a mean-reverting random walk (Ornstein-Uhlenbeck–like process)
    bounded between 0 and 1.

    Args:
        duration: Number of time steps.
        initial_prob: Starting win probability.
        volatility: Standard deviation of random shocks.
        mean_reversion_strength: Pull towards 0.5.
        seed: Random seed for reproducibility.

    Returns:
        Tuple of (timestamps, probabilities).
    """
    if seed is not None:
        np.random.seed(seed)

    prob = initial_prob
    timestamps = []
    probabilities = []

    for t in range(duration):
        timestamps.append(float(t))
        probabilities.append(prob)

        shock = np.random.normal(0, volatility)
        reversion = mean_reversion_strength * (0.5 - prob)
        prob += shock + reversion
        prob = np.clip(prob, 0.01, 0.99)

    return timestamps, probabilities
