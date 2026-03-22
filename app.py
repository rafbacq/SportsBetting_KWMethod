"""
Streamlit UI for the KW Win Probability Trading System.

Provides four main views:
1. Live Trading Dashboard — monitor markets and execute trades
2. Backtesting — run strategy on synthetic or uploaded data
3. Signal Explorer — visualize how the signal processor detects extrema
4. Configuration — adjust all parameters from the UI
"""

import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

from src.backtester import BacktestConfig, Backtester, generate_synthetic_game
from src.risk_manager import RiskConfig
from src.signal_processor import SignalProcessor, SignalProcessorConfig, SignalType
from src.trading_engine import EngineConfig, TradingEngine, load_config

# ── Page config ──────────────────────────────────────────────
st.set_page_config(
    page_title="KW Method — Win Probability Trading",
    page_icon="📈",
    layout="wide",
)

# ── Sidebar ──────────────────────────────────────────────────
st.sidebar.title("KW Method")
page = st.sidebar.radio(
    "Navigate",
    ["Live Dashboard", "Backtesting", "Signal Explorer", "Configuration"],
)

# Load default config
CONFIG_PATH = Path("configs/default.json")
if CONFIG_PATH.exists():
    default_cfg = json.loads(CONFIG_PATH.read_text())
else:
    default_cfg = {}


def get_signal_config() -> SignalProcessorConfig:
    sp = default_cfg.get("signal_processing", {})
    return SignalProcessorConfig(
        smoothing_window=sp.get("smoothing_window", 5),
        prominence_threshold=sp.get("prominence_threshold", 0.05),
        min_distance_between_extrema=sp.get("min_distance_between_extrema", 3),
        ema_span=sp.get("ema_span", 5),
    )


def get_risk_config() -> RiskConfig:
    rm = default_cfg.get("risk_management", {})
    return RiskConfig(
        max_position_size_pct=rm.get("max_position_size_pct", 0.10),
        max_portfolio_risk_pct=rm.get("max_portfolio_risk_pct", 0.25),
        stop_loss_pct=rm.get("stop_loss_pct", 0.15),
        take_profit_pct=rm.get("take_profit_pct", 0.25),
        kelly_fraction=rm.get("kelly_fraction", 0.25),
        max_concurrent_positions=rm.get("max_concurrent_positions", 5),
    )


# ═══════════════════════════════════════════════════════════════
# PAGE: Live Dashboard
# ═══════════════════════════════════════════════════════════════
if page == "Live Dashboard":
    st.title("Live Trading Dashboard")

    col1, col2 = st.columns([3, 1])

    with col2:
        st.subheader("Controls")
        mode = st.selectbox("Mode", ["Dry Run (Paper)", "Live Trading"])
        ticker = st.text_input("Market Ticker", "KXNBA-TEAMWIN-YES")
        poll_interval = st.slider("Poll interval (s)", 1, 30, 5)

        if "engine" not in st.session_state:
            st.session_state.engine = TradingEngine(
                signal_config=get_signal_config(),
                risk_config=get_risk_config(),
                engine_config=EngineConfig(
                    poll_interval=poll_interval,
                    dry_run=(mode == "Dry Run (Paper)"),
                ),
            )
            st.session_state.tick_data = []

        st.subheader("Manual Price Feed")
        st.caption("Enter prices manually to simulate live data")
        manual_price = st.number_input("Price (0-1)", 0.0, 1.0, 0.50, 0.01)
        if st.button("Submit Tick"):
            ts = time.time()
            result = st.session_state.engine.process_tick_manual(
                ticker, ts, manual_price
            )
            st.session_state.tick_data.append(result)
            if result["action"] != "NONE":
                st.success(f"Action: {result['action']}")
            else:
                st.info(f"Signal: {result['signal']} (conf: {result['confidence']:.2f})")

    with col1:
        engine = st.session_state.engine
        state = engine.get_state()

        # Portfolio metrics
        portfolio = state["portfolio"]
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Capital", f"${portfolio['current_capital']:,.2f}")
        m2.metric("Return", f"{portfolio['total_return_pct']:.2f}%")
        m3.metric("Open Positions", portfolio["open_positions"])
        m4.metric("Win Rate", f"{portfolio['win_rate']:.0%}")

        # Price chart
        if st.session_state.tick_data:
            df = pd.DataFrame(st.session_state.tick_data)
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                y=df["price"],
                mode="lines+markers",
                name="Price",
                line=dict(color="#2196F3"),
            ))

            # Annotate buy/sell signals
            buys = df[df["action"].str.startswith("BUY")]
            sells = df[df["action"].str.contains("SELL|CLOSE")]
            if not buys.empty:
                fig.add_trace(go.Scatter(
                    x=buys.index, y=buys["price"],
                    mode="markers",
                    marker=dict(symbol="triangle-up", size=14, color="green"),
                    name="Buy",
                ))
            if not sells.empty:
                fig.add_trace(go.Scatter(
                    x=sells.index, y=sells["price"],
                    mode="markers",
                    marker=dict(symbol="triangle-down", size=14, color="red"),
                    name="Sell",
                ))

            fig.update_layout(
                title="Win Probability & Signals",
                yaxis_title="Probability",
                height=400,
            )
            st.plotly_chart(fig, use_container_width=True)

        # Trade log
        if st.session_state.tick_data:
            st.subheader("Trade Log")
            actions = [t for t in st.session_state.tick_data if t["action"] != "NONE"]
            if actions:
                st.dataframe(pd.DataFrame(actions), use_container_width=True)

# ═══════════════════════════════════════════════════════════════
# PAGE: Backtesting
# ═══════════════════════════════════════════════════════════════
elif page == "Backtesting":
    st.title("Strategy Backtester")

    col1, col2 = st.columns([1, 3])

    with col1:
        st.subheader("Parameters")
        data_source = st.radio("Data Source", ["Synthetic Game", "Upload CSV"])

        if data_source == "Synthetic Game":
            duration = st.slider("Game Duration (ticks)", 50, 500, 200)
            volatility = st.slider("Volatility", 0.01, 0.10, 0.03, 0.005)
            mean_rev = st.slider("Mean Reversion", 0.0, 0.10, 0.02, 0.005)
            seed = st.number_input("Random Seed", 0, 9999, 42)
            num_games = st.slider("Number of Games", 1, 20, 5)

        initial_capital = st.number_input("Initial Capital ($)", 1000, 100000, 10000, 1000)
        prominence = st.slider("Signal Prominence", 0.01, 0.20, 0.05, 0.01)
        ema_span = st.slider("EMA Span", 2, 20, 5)
        stop_loss = st.slider("Stop Loss %", 0.05, 0.50, 0.15, 0.05)
        take_profit = st.slider("Take Profit %", 0.05, 0.50, 0.25, 0.05)

        run_backtest = st.button("Run Backtest", type="primary")

    with col2:
        if run_backtest:
            sig_config = SignalProcessorConfig(
                prominence_threshold=prominence,
                ema_span=ema_span,
            )
            risk_config = RiskConfig(
                stop_loss_pct=stop_loss,
                take_profit_pct=take_profit,
            )
            bt_config = BacktestConfig(
                initial_capital=initial_capital,
                signal_config=sig_config,
                risk_config=risk_config,
            )
            bt = Backtester(bt_config)

            if data_source == "Synthetic Game":
                if num_games == 1:
                    timestamps, probs = generate_synthetic_game(
                        duration=duration,
                        volatility=volatility,
                        mean_reversion_strength=mean_rev,
                        seed=seed,
                    )
                    result = bt.run(timestamps, probs)
                else:
                    games = []
                    for i in range(num_games):
                        ts, pr = generate_synthetic_game(
                            duration=duration,
                            volatility=volatility,
                            mean_reversion_strength=mean_rev,
                            seed=seed + i,
                        )
                        games.append({
                            "timestamps": ts,
                            "probabilities": pr,
                            "event_id": f"game_{i}",
                            "team": f"Team_{i}",
                        })
                    result = bt.run_multi_game(games)
            else:
                uploaded = st.file_uploader("Upload CSV", type=["csv"])
                if uploaded:
                    df = pd.read_csv(uploaded)
                    timestamps = df.iloc[:, 0].tolist()
                    probs = df.iloc[:, 1].tolist()
                    result = bt.run(timestamps, probs)
                else:
                    st.warning("Please upload a CSV with columns: timestamp, probability")
                    st.stop()

            # Display results
            st.subheader("Performance Summary")
            r1, r2, r3, r4 = st.columns(4)
            r1.metric("Total Return", f"{result.total_return_pct:.2f}%")
            r2.metric("Win Rate", f"{result.win_rate:.0%}")
            r3.metric("Sharpe Ratio", f"{result.sharpe_ratio:.3f}")
            r4.metric("Max Drawdown", f"{result.max_drawdown_pct:.2f}%")

            r5, r6, r7, r8 = st.columns(4)
            r5.metric("Total Trades", result.total_trades)
            r6.metric("Avg PnL/Trade", f"${result.avg_trade_pnl:.2f}")
            r7.metric("Profit Factor", f"{result.profit_factor:.2f}")
            r8.metric("Final Capital", f"${result.final_capital:,.2f}")

            # Equity curve
            fig_eq = go.Figure()
            fig_eq.add_trace(go.Scatter(
                y=result.equity_curve,
                mode="lines",
                name="Equity",
                line=dict(color="#4CAF50", width=2),
            ))
            fig_eq.update_layout(
                title="Equity Curve",
                yaxis_title="Portfolio Value ($)",
                height=350,
            )
            st.plotly_chart(fig_eq, use_container_width=True)

            # Win prob + signals chart (for single game)
            if data_source == "Synthetic Game" and num_games == 1:
                processor = SignalProcessor(sig_config)
                signals = processor.batch_analyze(timestamps, probs)
                peaks, valleys = processor.get_batch_extrema()

                fig_sig = go.Figure()
                fig_sig.add_trace(go.Scatter(
                    x=timestamps, y=probs,
                    mode="lines", name="Raw Probability",
                    line=dict(color="#90CAF9", width=1),
                ))
                fig_sig.add_trace(go.Scatter(
                    x=timestamps, y=processor.smoothed_prices,
                    mode="lines", name="Smoothed (EMA)",
                    line=dict(color="#2196F3", width=2),
                ))
                if len(valleys) > 0:
                    fig_sig.add_trace(go.Scatter(
                        x=[timestamps[i] for i in valleys],
                        y=[processor.smoothed_prices[i] for i in valleys],
                        mode="markers",
                        marker=dict(symbol="triangle-up", size=12, color="green"),
                        name="Buy Signal (Valley)",
                    ))
                if len(peaks) > 0:
                    fig_sig.add_trace(go.Scatter(
                        x=[timestamps[i] for i in peaks],
                        y=[processor.smoothed_prices[i] for i in peaks],
                        mode="markers",
                        marker=dict(symbol="triangle-down", size=12, color="red"),
                        name="Sell Signal (Peak)",
                    ))
                fig_sig.update_layout(
                    title="Win Probability with Detected Signals",
                    yaxis_title="Probability",
                    height=400,
                )
                st.plotly_chart(fig_sig, use_container_width=True)

            # Trade list
            if result.trades:
                st.subheader("Trade Details")
                trade_data = [
                    {
                        "Event": t.event_id,
                        "Entry Time": f"{t.entry_time:.0f}",
                        "Exit Time": f"{t.exit_time:.0f}",
                        "Entry Price": f"{t.entry_price:.4f}",
                        "Exit Price": f"{t.exit_price:.4f}",
                        "Qty": t.quantity,
                        "PnL": f"${t.pnl:.2f}",
                        "Reason": t.exit_reason,
                    }
                    for t in result.trades
                ]
                st.dataframe(pd.DataFrame(trade_data), use_container_width=True)

# ═══════════════════════════════════════════════════════════════
# PAGE: Signal Explorer
# ═══════════════════════════════════════════════════════════════
elif page == "Signal Explorer":
    st.title("Signal Explorer")
    st.caption("Visualize how signal processing parameters affect detection")

    col1, col2 = st.columns([1, 3])

    with col1:
        st.subheader("Generate Data")
        duration = st.slider("Duration", 50, 500, 150, key="se_dur")
        volatility = st.slider("Volatility", 0.01, 0.15, 0.04, 0.005, key="se_vol")
        mean_rev = st.slider("Mean Reversion", 0.0, 0.10, 0.02, 0.005, key="se_mr")
        seed = st.number_input("Seed", 0, 9999, 123, key="se_seed")

        st.subheader("Signal Parameters")
        prominence = st.slider("Prominence Threshold", 0.01, 0.20, 0.05, 0.01, key="se_prom")
        ema_span = st.slider("EMA Span", 2, 20, 5, key="se_ema")
        confirm_ticks = st.slider("Confirmation Ticks", 1, 5, 2, key="se_conf")
        min_dist = st.slider("Min Distance Between Extrema", 1, 10, 3, key="se_dist")

    with col2:
        timestamps, probs = generate_synthetic_game(
            duration=duration,
            volatility=volatility,
            mean_reversion_strength=mean_rev,
            seed=seed,
        )

        config = SignalProcessorConfig(
            prominence_threshold=prominence,
            ema_span=ema_span,
            confirmation_ticks=confirm_ticks,
            min_distance_between_extrema=min_dist,
        )
        processor = SignalProcessor(config)
        signals = processor.batch_analyze(timestamps, probs)
        peaks, valleys = processor.get_batch_extrema()

        # Main chart
        fig = make_subplots(
            rows=2, cols=1,
            shared_xaxes=True,
            row_heights=[0.7, 0.3],
            vertical_spacing=0.05,
        )

        fig.add_trace(go.Scatter(
            x=timestamps, y=probs,
            mode="lines", name="Raw",
            line=dict(color="#B0BEC5", width=1),
        ), row=1, col=1)

        fig.add_trace(go.Scatter(
            x=timestamps, y=processor.smoothed_prices,
            mode="lines", name="Smoothed",
            line=dict(color="#2196F3", width=2),
        ), row=1, col=1)

        if len(valleys) > 0:
            fig.add_trace(go.Scatter(
                x=[timestamps[i] for i in valleys],
                y=[processor.smoothed_prices[i] for i in valleys],
                mode="markers",
                marker=dict(symbol="triangle-up", size=14, color="#4CAF50"),
                name="Local Minima (Buy)",
            ), row=1, col=1)

        if len(peaks) > 0:
            fig.add_trace(go.Scatter(
                x=[timestamps[i] for i in peaks],
                y=[processor.smoothed_prices[i] for i in peaks],
                mode="markers",
                marker=dict(symbol="triangle-down", size=14, color="#F44336"),
                name="Local Maxima (Sell)",
            ), row=1, col=1)

        # Confidence subplot
        buy_signals = [(s.timestamp, s.confidence) for s in signals if s.signal_type == SignalType.BUY]
        sell_signals = [(s.timestamp, s.confidence) for s in signals if s.signal_type == SignalType.SELL]

        if buy_signals:
            fig.add_trace(go.Bar(
                x=[b[0] for b in buy_signals],
                y=[b[1] for b in buy_signals],
                name="Buy Confidence",
                marker_color="#4CAF50",
            ), row=2, col=1)
        if sell_signals:
            fig.add_trace(go.Bar(
                x=[s[0] for s in sell_signals],
                y=[s[1] for s in sell_signals],
                name="Sell Confidence",
                marker_color="#F44336",
            ), row=2, col=1)

        fig.update_layout(height=600, title="Signal Detection Analysis")
        fig.update_yaxes(title_text="Probability", row=1, col=1)
        fig.update_yaxes(title_text="Confidence", row=2, col=1)
        st.plotly_chart(fig, use_container_width=True)

        # Stats
        real_time_buys = [s for s in signals if s.signal_type == SignalType.BUY]
        real_time_sells = [s for s in signals if s.signal_type == SignalType.SELL]
        st.markdown(f"""
        **Detection Summary:**
        - Batch analysis found **{len(valleys)}** valleys and **{len(peaks)}** peaks
        - Real-time processor emitted **{len(real_time_buys)}** buy signals and **{len(real_time_sells)}** sell signals
        - Average buy confidence: **{np.mean([s.confidence for s in real_time_buys]):.2f}** (n={len(real_time_buys)})
        - Average sell confidence: **{np.mean([s.confidence for s in real_time_sells]):.2f}** (n={len(real_time_sells)})
        """)

# ═══════════════════════════════════════════════════════════════
# PAGE: Configuration
# ═══════════════════════════════════════════════════════════════
elif page == "Configuration":
    st.title("Configuration")

    tab1, tab2, tab3 = st.tabs(["Signal Processing", "Risk Management", "Kalshi API"])

    with tab1:
        st.subheader("Signal Processing Parameters")
        sp = default_cfg.get("signal_processing", {})
        new_sp = {
            "smoothing_window": st.number_input(
                "Smoothing Window",
                1, 20, sp.get("smoothing_window", 5),
                help="Number of data points for local analysis window",
            ),
            "prominence_threshold": st.number_input(
                "Prominence Threshold",
                0.01, 0.50, sp.get("prominence_threshold", 0.05), 0.01,
                help="Minimum prominence for a peak/valley to be considered a signal",
            ),
            "min_distance_between_extrema": st.number_input(
                "Min Distance Between Extrema",
                1, 20, sp.get("min_distance_between_extrema", 3),
                help="Minimum ticks between consecutive signals",
            ),
            "ema_span": st.number_input(
                "EMA Span",
                2, 50, sp.get("ema_span", 5),
                help="Exponential moving average lookback for smoothing",
            ),
        }

    with tab2:
        st.subheader("Risk Management Parameters")
        rm = default_cfg.get("risk_management", {})
        new_rm = {
            "max_position_size_pct": st.number_input(
                "Max Position Size (%)", 0.01, 1.0,
                rm.get("max_position_size_pct", 0.10), 0.01,
            ),
            "max_portfolio_risk_pct": st.number_input(
                "Max Portfolio Risk (%)", 0.05, 1.0,
                rm.get("max_portfolio_risk_pct", 0.25), 0.05,
            ),
            "stop_loss_pct": st.number_input(
                "Stop Loss (%)", 0.01, 0.50,
                rm.get("stop_loss_pct", 0.15), 0.01,
            ),
            "take_profit_pct": st.number_input(
                "Take Profit (%)", 0.01, 1.0,
                rm.get("take_profit_pct", 0.25), 0.01,
            ),
            "kelly_fraction": st.number_input(
                "Kelly Fraction", 0.05, 1.0,
                rm.get("kelly_fraction", 0.25), 0.05,
                help="Fraction of Kelly criterion to use (0.25 = quarter Kelly)",
            ),
            "max_concurrent_positions": st.number_input(
                "Max Concurrent Positions", 1, 20,
                rm.get("max_concurrent_positions", 5),
            ),
        }

    with tab3:
        st.subheader("Kalshi API Settings")
        st.warning("API credentials are loaded from .env file for security.")
        kl = default_cfg.get("kalshi", {})
        new_kl = {
            "base_url": st.text_input(
                "Base URL", kl.get("base_url", "https://api.elections.kalshi.com/trade-api/v2"),
            ),
            "poll_interval_seconds": st.number_input(
                "Poll Interval (s)", 1, 60,
                kl.get("poll_interval_seconds", 5),
            ),
        }

    if st.button("Save Configuration", type="primary"):
        new_config = {
            "signal_processing": new_sp,
            "risk_management": new_rm,
            "kalshi": new_kl,
            "backtesting": default_cfg.get("backtesting", {}),
        }
        CONFIG_PATH.write_text(json.dumps(new_config, indent=2))
        st.success("Configuration saved!")
        st.rerun()
