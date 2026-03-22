"""
Signal processing module for detecting local minima and maxima in win probability streams.

Uses a combination of exponential moving average (EMA) smoothing and scipy's
peak-finding algorithms with configurable prominence thresholds to filter noise
and identify actionable buy/sell signals in real time.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import numpy as np
from scipy.signal import argrelextrema, find_peaks


class SignalType(Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


@dataclass
class Signal:
    signal_type: SignalType
    timestamp: float
    probability: float
    smoothed_probability: float
    confidence: float  # 0-1 how strong the signal is


@dataclass
class SignalProcessorConfig:
    smoothing_window: int = 5
    prominence_threshold: float = 0.05
    min_distance_between_extrema: int = 3
    ema_span: int = 5
    confirmation_ticks: int = 2  # require N ticks after extremum to confirm


class SignalProcessor:
    """Real-time signal processor for win probability streams.

    Algorithm overview:
    1. Incoming raw probabilities are smoothed with an EMA to reduce noise.
    2. A rolling window of smoothed values is maintained.
    3. After each new tick, the processor checks whether a local minimum or
       maximum has formed using scipy's peak-finding with a prominence filter.
    4. A signal is only emitted after `confirmation_ticks` subsequent values
       confirm the extremum (i.e., the trend has reversed).
    5. Alternating enforcement: a BUY must follow a SELL and vice-versa to
       avoid duplicate signals in the same direction.
    """

    def __init__(self, config: Optional[SignalProcessorConfig] = None):
        self.config = config or SignalProcessorConfig()
        self.raw_prices: list[float] = []
        self.smoothed_prices: list[float] = []
        self.timestamps: list[float] = []
        self.signals: list[Signal] = []
        self._ema: Optional[float] = None
        self._last_signal_type: Optional[SignalType] = None

    def _update_ema(self, value: float) -> float:
        alpha = 2.0 / (self.config.ema_span + 1)
        if self._ema is None:
            self._ema = value
        else:
            self._ema = alpha * value + (1 - alpha) * self._ema
        return self._ema

    def process_tick(self, timestamp: float, probability: float) -> Signal:
        """Process a single tick of win probability data.

        Args:
            timestamp: Time of the observation (e.g., game clock seconds elapsed).
            probability: Raw win probability in [0, 1].

        Returns:
            Signal indicating BUY, SELL, or HOLD with confidence.
        """
        self.raw_prices.append(probability)
        self.timestamps.append(timestamp)

        smoothed = self._update_ema(probability)
        self.smoothed_prices.append(smoothed)

        signal = self._detect_signal()
        self.signals.append(signal)
        return signal

    def _detect_signal(self) -> Signal:
        n = len(self.smoothed_prices)
        confirm = self.config.confirmation_ticks

        if n < self.config.min_distance_between_extrema + confirm + 1:
            return self._hold_signal()

        window = np.array(self.smoothed_prices)

        # Detect local minima (buy signals) — look for valleys
        buy_signal = self._check_for_minimum(window, confirm)
        if buy_signal is not None:
            return buy_signal

        # Detect local maxima (sell signals) — look for peaks
        sell_signal = self._check_for_maximum(window, confirm)
        if sell_signal is not None:
            return sell_signal

        return self._hold_signal()

    def _check_for_minimum(self, data: np.ndarray, confirm: int) -> Optional[Signal]:
        """Check if a confirmed local minimum exists at position -(confirm+1)."""
        candidate_idx = len(data) - confirm - 1
        if candidate_idx < 1:
            return None

        candidate_val = data[candidate_idx]

        # The candidate must be lower than its neighbors
        left = data[candidate_idx - 1]
        right_vals = data[candidate_idx + 1: candidate_idx + 1 + confirm]

        if not (candidate_val < left and all(candidate_val < r for r in right_vals)):
            return None

        # Check prominence: the dip must be significant
        local_window_start = max(0, candidate_idx - self.config.smoothing_window)
        local_window = data[local_window_start: candidate_idx + confirm + 1]
        prominence = local_window.max() - candidate_val

        if prominence < self.config.prominence_threshold:
            return None

        # Enforce alternation: don't emit two BUYs in a row
        if self._last_signal_type == SignalType.BUY:
            return None

        confidence = min(1.0, prominence / (2 * self.config.prominence_threshold))
        self._last_signal_type = SignalType.BUY

        return Signal(
            signal_type=SignalType.BUY,
            timestamp=self.timestamps[candidate_idx],
            probability=self.raw_prices[candidate_idx],
            smoothed_probability=float(candidate_val),
            confidence=confidence,
        )

    def _check_for_maximum(self, data: np.ndarray, confirm: int) -> Optional[Signal]:
        """Check if a confirmed local maximum exists at position -(confirm+1)."""
        candidate_idx = len(data) - confirm - 1
        if candidate_idx < 1:
            return None

        candidate_val = data[candidate_idx]

        left = data[candidate_idx - 1]
        right_vals = data[candidate_idx + 1: candidate_idx + 1 + confirm]

        if not (candidate_val > left and all(candidate_val > r for r in right_vals)):
            return None

        local_window_start = max(0, candidate_idx - self.config.smoothing_window)
        local_window = data[local_window_start: candidate_idx + confirm + 1]
        prominence = candidate_val - local_window.min()

        if prominence < self.config.prominence_threshold:
            return None

        if self._last_signal_type == SignalType.SELL:
            return None

        confidence = min(1.0, prominence / (2 * self.config.prominence_threshold))
        self._last_signal_type = SignalType.SELL

        return Signal(
            signal_type=SignalType.SELL,
            timestamp=self.timestamps[candidate_idx],
            probability=self.raw_prices[candidate_idx],
            smoothed_probability=float(candidate_val),
            confidence=confidence,
        )

    def _hold_signal(self) -> Signal:
        return Signal(
            signal_type=SignalType.HOLD,
            timestamp=self.timestamps[-1] if self.timestamps else 0,
            probability=self.raw_prices[-1] if self.raw_prices else 0,
            smoothed_probability=self.smoothed_prices[-1] if self.smoothed_prices else 0,
            confidence=0.0,
        )

    def batch_analyze(
        self, timestamps: list[float], probabilities: list[float]
    ) -> list[Signal]:
        """Process a full series at once (for backtesting).

        Also runs scipy find_peaks on the complete smoothed series for a
        higher-quality post-hoc analysis.
        """
        self.reset()
        signals = []
        for ts, prob in zip(timestamps, probabilities):
            sig = self.process_tick(ts, prob)
            signals.append(sig)
        return signals

    def get_batch_extrema(self) -> tuple[np.ndarray, np.ndarray]:
        """After batch_analyze, return indices of all detected peaks and valleys
        using scipy find_peaks on the full smoothed series."""
        data = np.array(self.smoothed_prices)

        peaks, _ = find_peaks(
            data,
            prominence=self.config.prominence_threshold,
            distance=self.config.min_distance_between_extrema,
        )
        valleys, _ = find_peaks(
            -data,
            prominence=self.config.prominence_threshold,
            distance=self.config.min_distance_between_extrema,
        )
        return peaks, valleys

    def reset(self):
        self.raw_prices.clear()
        self.smoothed_prices.clear()
        self.timestamps.clear()
        self.signals.clear()
        self._ema = None
        self._last_signal_type = None
