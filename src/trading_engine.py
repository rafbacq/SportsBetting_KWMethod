"""
Trading engine that ties together signal processing, risk management,
and Kalshi API execution into a live trading loop.
"""

import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from src.kalshi_client import KalshiClient, KalshiConfig, Market
from src.risk_manager import Position, PositionStatus, RiskConfig, RiskManager
from src.signal_processor import SignalProcessor, SignalProcessorConfig, SignalType

logger = logging.getLogger(__name__)


@dataclass
class EngineConfig:
    poll_interval: float = 5.0  # seconds between market data polls
    dry_run: bool = True  # if True, log trades but don't execute


class TradingEngine:
    """Orchestrates live trading on Kalshi sports markets."""

    def __init__(
        self,
        kalshi_config: Optional[KalshiConfig] = None,
        signal_config: Optional[SignalProcessorConfig] = None,
        risk_config: Optional[RiskConfig] = None,
        engine_config: Optional[EngineConfig] = None,
        initial_capital: float = 10000.0,
    ):
        self.kalshi = KalshiClient(kalshi_config)
        self.signal_config = signal_config or SignalProcessorConfig()
        self.risk_mgr = RiskManager(initial_capital, risk_config)
        self.engine_config = engine_config or EngineConfig()

        # Per-market signal processors
        self._processors: dict[str, SignalProcessor] = {}
        # Map ticker -> active Position
        self._active_positions: dict[str, Position] = {}
        self._running = False
        self.trade_log: list[dict] = []

    def _get_processor(self, ticker: str) -> SignalProcessor:
        if ticker not in self._processors:
            self._processors[ticker] = SignalProcessor(self.signal_config)
        return self._processors[ticker]

    def start(self, tickers: list[str]):
        """Begin the live trading loop for the given market tickers.

        Args:
            tickers: Kalshi market tickers to monitor.
        """
        logger.info(f"Starting trading engine for {tickers}")
        if not self.engine_config.dry_run:
            self.kalshi.login()

        self._running = True
        while self._running:
            for ticker in tickers:
                try:
                    self._process_ticker(ticker)
                except Exception as e:
                    logger.error(f"Error processing {ticker}: {e}")
            time.sleep(self.engine_config.poll_interval)

    def stop(self):
        self._running = False
        logger.info("Trading engine stopped")

    def _process_ticker(self, ticker: str):
        # Fetch current market price
        if self.engine_config.dry_run:
            return  # In dry run, data must be fed via process_tick_manual

        market = self.kalshi.get_market(ticker)
        price = market.yes_price
        timestamp = time.time()

        self._evaluate(ticker, timestamp, price, market)

    def process_tick_manual(
        self, ticker: str, timestamp: float, price: float
    ) -> dict:
        """Feed a single data point manually (for UI or testing).

        Returns dict with signal info and any trade action taken.
        """
        return self._evaluate(ticker, timestamp, price)

    def _evaluate(
        self,
        ticker: str,
        timestamp: float,
        price: float,
        market: Optional[Market] = None,
    ) -> dict:
        processor = self._get_processor(ticker)
        signal = processor.process_tick(timestamp, price)

        result = {
            "ticker": ticker,
            "timestamp": timestamp,
            "price": price,
            "signal": signal.signal_type.value,
            "confidence": signal.confidence,
            "action": "NONE",
        }

        active_pos = self._active_positions.get(ticker)

        # Check exit conditions on active position
        if active_pos and active_pos.status == PositionStatus.OPEN:
            exit_reason = self.risk_mgr.check_exit_conditions(active_pos, price)
            if exit_reason is not None:
                self._close(ticker, active_pos, price, timestamp, exit_reason)
                result["action"] = f"CLOSE ({exit_reason.value})"

        # Act on signals
        if signal.signal_type == SignalType.BUY and ticker not in self._active_positions:
            qty = self.risk_mgr.size_position(price)
            if qty > 0:
                pos = self.risk_mgr.open_position(
                    ticker, ticker, price, qty, timestamp
                )
                if pos:
                    self._active_positions[ticker] = pos
                    if not self.engine_config.dry_run and market:
                        try:
                            self.kalshi.place_order(
                                ticker, "yes", qty, price, "limit"
                            )
                        except Exception as e:
                            logger.error(f"Order failed: {e}")
                    result["action"] = f"BUY {qty}@{price:.4f}"

        elif signal.signal_type == SignalType.SELL and ticker in self._active_positions:
            active_pos = self._active_positions[ticker]
            if active_pos.status == PositionStatus.OPEN:
                self._close(
                    ticker,
                    active_pos,
                    price,
                    timestamp,
                    PositionStatus.CLOSED_TAKE_PROFIT,
                )
                result["action"] = f"SELL@{price:.4f}"

        self.trade_log.append(result)
        return result

    def _close(
        self,
        ticker: str,
        position: Position,
        price: float,
        timestamp: float,
        reason: PositionStatus,
    ):
        pnl = self.risk_mgr.close_position(position, price, timestamp, reason)
        logger.info(f"Closed {ticker}: PnL=${pnl:.2f} ({reason.value})")

        if not self.engine_config.dry_run:
            try:
                self.kalshi.sell_position(
                    ticker, "yes", position.quantity, price
                )
            except Exception as e:
                logger.error(f"Sell order failed: {e}")

        del self._active_positions[ticker]

    def get_state(self) -> dict:
        """Return the current engine state for the UI."""
        return {
            "running": self._running,
            "portfolio": self.risk_mgr.get_portfolio_summary(),
            "active_positions": {
                t: {
                    "entry_price": p.entry_price,
                    "quantity": p.quantity,
                    "entry_time": p.entry_timestamp,
                }
                for t, p in self._active_positions.items()
            },
            "processors": {
                t: {
                    "ticks": len(proc.raw_prices),
                    "last_signal": proc.signals[-1].signal_type.value
                    if proc.signals
                    else "NONE",
                }
                for t, proc in self._processors.items()
            },
        }


def load_config(config_path: str = "configs/default.json") -> dict:
    with open(config_path) as f:
        return json.load(f)
