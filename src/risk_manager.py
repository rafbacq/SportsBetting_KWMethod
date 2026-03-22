"""
Risk management module: position sizing, stop-loss, take-profit, and portfolio limits.

Implements fractional Kelly criterion for optimal position sizing, trailing
stop-losses, and hard portfolio-level risk caps.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class PositionStatus(Enum):
    OPEN = "OPEN"
    CLOSED_TAKE_PROFIT = "CLOSED_TAKE_PROFIT"
    CLOSED_STOP_LOSS = "CLOSED_STOP_LOSS"
    CLOSED_MANUAL = "CLOSED_MANUAL"


@dataclass
class Position:
    event_id: str
    team: str
    entry_price: float
    quantity: int
    entry_timestamp: float
    status: PositionStatus = PositionStatus.OPEN
    exit_price: Optional[float] = None
    exit_timestamp: Optional[float] = None
    highest_price_since_entry: float = 0.0
    pnl: float = 0.0


@dataclass
class RiskConfig:
    max_position_size_pct: float = 0.10
    max_portfolio_risk_pct: float = 0.25
    stop_loss_pct: float = 0.15
    take_profit_pct: float = 0.25
    kelly_fraction: float = 0.25  # fractional Kelly for safety
    max_concurrent_positions: int = 5
    trailing_stop_pct: float = 0.10


class RiskManager:
    def __init__(self, initial_capital: float, config: Optional[RiskConfig] = None):
        self.initial_capital = initial_capital
        self.capital = initial_capital
        self.config = config or RiskConfig()
        self.positions: list[Position] = []
        self.closed_positions: list[Position] = []

    @property
    def open_positions(self) -> list[Position]:
        return [p for p in self.positions if p.status == PositionStatus.OPEN]

    @property
    def total_exposure(self) -> float:
        return sum(p.entry_price * p.quantity for p in self.open_positions)

    def calculate_kelly_size(
        self, win_probability: float, win_payout: float, loss_amount: float
    ) -> float:
        """Fractional Kelly criterion for position sizing.

        Args:
            win_probability: Estimated probability of winning the trade (0-1).
            win_payout: Profit per dollar risked if the trade wins.
            loss_amount: Loss per dollar risked if the trade loses.

        Returns:
            Fraction of capital to allocate.
        """
        if loss_amount == 0:
            return 0.0

        # Kelly formula: f* = (bp - q) / b
        b = win_payout / loss_amount
        p = win_probability
        q = 1.0 - p
        kelly = (b * p - q) / b

        # Apply fractional Kelly and clamp
        fraction = max(0.0, kelly * self.config.kelly_fraction)
        fraction = min(fraction, self.config.max_position_size_pct)

        return fraction

    def can_open_position(self) -> bool:
        if len(self.open_positions) >= self.config.max_concurrent_positions:
            return False
        if self.total_exposure / self.capital > self.config.max_portfolio_risk_pct:
            return False
        return True

    def size_position(
        self,
        price: float,
        win_probability: float = 0.55,
        win_payout: float = 1.0,
        loss_amount: float = 1.0,
    ) -> int:
        """Determine how many contracts to buy at the given price.

        Returns:
            Number of contracts (integer).
        """
        if not self.can_open_position() or price <= 0:
            return 0

        fraction = self.calculate_kelly_size(win_probability, win_payout, loss_amount)
        dollar_amount = self.capital * fraction
        quantity = int(dollar_amount / price)
        return max(0, quantity)

    def open_position(
        self, event_id: str, team: str, price: float, quantity: int, timestamp: float
    ) -> Optional[Position]:
        if not self.can_open_position() or quantity <= 0:
            return None

        cost = price * quantity
        if cost > self.capital:
            quantity = int(self.capital / price)
            if quantity <= 0:
                return None
            cost = price * quantity

        self.capital -= cost
        pos = Position(
            event_id=event_id,
            team=team,
            entry_price=price,
            quantity=quantity,
            entry_timestamp=timestamp,
            highest_price_since_entry=price,
        )
        self.positions.append(pos)
        return pos

    def check_exit_conditions(self, position: Position, current_price: float) -> Optional[PositionStatus]:
        """Check if a position should be closed based on stop-loss or take-profit."""
        if position.status != PositionStatus.OPEN:
            return None

        # Update trailing high
        if current_price > position.highest_price_since_entry:
            position.highest_price_since_entry = current_price

        price_change = (current_price - position.entry_price) / position.entry_price

        # Take profit
        if price_change >= self.config.take_profit_pct:
            return PositionStatus.CLOSED_TAKE_PROFIT

        # Stop loss
        if price_change <= -self.config.stop_loss_pct:
            return PositionStatus.CLOSED_STOP_LOSS

        # Trailing stop: if price has dropped from the high by trailing_stop_pct
        if position.highest_price_since_entry > 0:
            drop_from_high = (
                position.highest_price_since_entry - current_price
            ) / position.highest_price_since_entry
            if drop_from_high >= self.config.trailing_stop_pct:
                return PositionStatus.CLOSED_STOP_LOSS

        return None

    def close_position(
        self, position: Position, exit_price: float, timestamp: float, reason: PositionStatus
    ) -> float:
        position.exit_price = exit_price
        position.exit_timestamp = timestamp
        position.status = reason
        position.pnl = (exit_price - position.entry_price) * position.quantity
        self.capital += exit_price * position.quantity
        self.closed_positions.append(position)
        return position.pnl

    def get_portfolio_summary(self) -> dict:
        total_pnl = sum(p.pnl for p in self.closed_positions)
        wins = [p for p in self.closed_positions if p.pnl > 0]
        losses = [p for p in self.closed_positions if p.pnl <= 0]

        return {
            "current_capital": self.capital,
            "initial_capital": self.initial_capital,
            "total_return_pct": (self.capital - self.initial_capital) / self.initial_capital * 100,
            "total_pnl": total_pnl,
            "open_positions": len(self.open_positions),
            "closed_trades": len(self.closed_positions),
            "winning_trades": len(wins),
            "losing_trades": len(losses),
            "win_rate": len(wins) / len(self.closed_positions) if self.closed_positions else 0,
            "avg_win": sum(p.pnl for p in wins) / len(wins) if wins else 0,
            "avg_loss": sum(p.pnl for p in losses) / len(losses) if losses else 0,
            "total_exposure": self.total_exposure,
        }
