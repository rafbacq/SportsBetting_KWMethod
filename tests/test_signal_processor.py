"""Tests for the signal processing module."""

import numpy as np
import pytest

from src.signal_processor import SignalProcessor, SignalProcessorConfig, SignalType


def make_valley_series():
    """Create a series with a clear valley at index 10."""
    # Declining then rising pattern
    prices = [0.50, 0.48, 0.45, 0.42, 0.38, 0.35, 0.32, 0.30, 0.28, 0.26,
              0.25,  # valley
              0.27, 0.30, 0.33, 0.36, 0.40, 0.43, 0.46, 0.49, 0.52]
    timestamps = list(range(len(prices)))
    return timestamps, prices


def make_peak_series():
    """Create a series with a clear peak at index 10."""
    prices = [0.50, 0.52, 0.55, 0.58, 0.62, 0.65, 0.68, 0.70, 0.72, 0.74,
              0.75,  # peak
              0.73, 0.70, 0.67, 0.64, 0.60, 0.57, 0.54, 0.51, 0.48]
    timestamps = list(range(len(prices)))
    return timestamps, prices


def test_ema_smoothing():
    config = SignalProcessorConfig(ema_span=3)
    proc = SignalProcessor(config)

    proc.process_tick(0, 0.50)
    proc.process_tick(1, 0.60)
    proc.process_tick(2, 0.55)

    assert len(proc.smoothed_prices) == 3
    # EMA should be between min and max of inputs
    assert 0.50 <= proc.smoothed_prices[-1] <= 0.60


def test_detects_buy_signal_on_valley():
    config = SignalProcessorConfig(
        prominence_threshold=0.03,
        ema_span=2,
        confirmation_ticks=2,
        min_distance_between_extrema=2,
    )
    proc = SignalProcessor(config)
    timestamps, prices = make_valley_series()

    signals = []
    for ts, price in zip(timestamps, prices):
        sig = proc.process_tick(ts, price)
        if sig.signal_type == SignalType.BUY:
            signals.append(sig)

    assert len(signals) >= 1, "Should detect at least one buy signal at the valley"


def test_detects_sell_signal_on_peak():
    config = SignalProcessorConfig(
        prominence_threshold=0.03,
        ema_span=2,
        confirmation_ticks=2,
        min_distance_between_extrema=2,
    )
    proc = SignalProcessor(config)

    # First create a valley so BUY fires, then a peak so SELL can fire
    timestamps, prices = make_valley_series()
    _, peak_prices = make_peak_series()
    full_prices = prices + peak_prices
    full_ts = list(range(len(full_prices)))

    signals = []
    for ts, price in zip(full_ts, full_prices):
        sig = proc.process_tick(ts, price)
        if sig.signal_type == SignalType.SELL:
            signals.append(sig)

    assert len(signals) >= 1, "Should detect at least one sell signal at the peak"


def test_alternation_enforced():
    """Should not emit two consecutive BUY or SELL signals."""
    config = SignalProcessorConfig(
        prominence_threshold=0.02,
        ema_span=2,
        confirmation_ticks=1,
        min_distance_between_extrema=2,
    )
    proc = SignalProcessor(config)

    # Create oscillating data
    np.random.seed(42)
    prices = []
    for i in range(100):
        prices.append(0.5 + 0.15 * np.sin(i * 0.3) + np.random.normal(0, 0.01))

    non_hold = []
    for i, p in enumerate(prices):
        sig = proc.process_tick(float(i), p)
        if sig.signal_type != SignalType.HOLD:
            non_hold.append(sig.signal_type)

    # Check no consecutive duplicates
    for i in range(1, len(non_hold)):
        assert non_hold[i] != non_hold[i - 1], \
            f"Consecutive duplicate signal at index {i}: {non_hold[i]}"


def test_noise_filtering():
    """Small random noise should not trigger signals."""
    config = SignalProcessorConfig(
        prominence_threshold=0.10,  # high threshold
        ema_span=5,
    )
    proc = SignalProcessor(config)

    # Flat price with tiny noise
    np.random.seed(7)
    prices = [0.50 + np.random.normal(0, 0.005) for _ in range(50)]

    signals = [proc.process_tick(float(i), p) for i, p in enumerate(prices)]
    non_hold = [s for s in signals if s.signal_type != SignalType.HOLD]

    assert len(non_hold) == 0, "Noise should be filtered by prominence threshold"


def test_batch_analyze():
    config = SignalProcessorConfig(ema_span=3, prominence_threshold=0.03)
    proc = SignalProcessor(config)
    timestamps, prices = make_valley_series()

    signals = proc.batch_analyze(timestamps, prices)
    assert len(signals) == len(prices)

    peaks, valleys = proc.get_batch_extrema()
    assert len(valleys) >= 1, "Batch analysis should find the valley"


def test_reset():
    proc = SignalProcessor()
    proc.process_tick(0, 0.5)
    proc.process_tick(1, 0.6)
    proc.reset()

    assert len(proc.raw_prices) == 0
    assert len(proc.smoothed_prices) == 0
    assert proc._ema is None
