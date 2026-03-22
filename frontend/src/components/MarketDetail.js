import React, { useState, useEffect, useCallback } from 'react';
import MultiLineChart from './PriceChart';
import OrderForm from './OrderForm';
import { getEventCandlesticks, formatCents, formatVolume } from '../services/kalshiApi';

// Chart colors for outcomes
const CHART_COLORS = [
  '#3b82f6', // blue
  '#00d4aa', // green/cyan
  '#f59e0b', // orange
  '#a78bfa', // purple
  '#ef4444', // red
  '#22d3ee', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // amber
  '#06b6d4', // teal
];

const PERIOD_OPTIONS = [
  { label: 'LIVE', seconds: 3600, interval: 60 },
  { label: '1D', seconds: 86400, interval: 300 },
  { label: '1W', seconds: 604800, interval: 3600 },
  { label: '1M', seconds: 2592000, interval: 14400 },
  { label: 'ALL', seconds: 7776000, interval: 86400 },
];

/**
 * Detailed view of a Kalshi event — Kalshi app style.
 * Multi-line chart with all outcomes, probability legend, outcome list.
 */
export default function MarketDetail({ event, auth, onPlaceOrder, onSell, onClose }) {
  const markets = event.markets || [];
  const [selectedTicker, setSelectedTicker] = useState(
    markets.length > 0 ? markets[0].ticker : null
  );
  const [candleData, setCandleData] = useState({}); // { ticker: candles[] }
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(0); // default LIVE
  const [showAll, setShowAll] = useState(false);

  const selectedMarket = markets.find((m) => m.ticker === selectedTicker) || markets[0];

  // Sort markets by probability (descending)
  const sortedMarkets = [...markets].sort((a, b) => {
    const probA = parseFloat(a.last_price_dollars || a.yes_bid_dollars || 0);
    const probB = parseFloat(b.last_price_dollars || b.yes_bid_dollars || 0);
    return probB - probA;
  });

  // Assign colors to top outcomes
  const marketColors = {};
  sortedMarkets.forEach((m, i) => {
    marketColors[m.ticker] = CHART_COLORS[i % CHART_COLORS.length];
  });

  const fetchCandles = useCallback(async () => {
    if (markets.length === 0) return;
    const opt = PERIOD_OPTIONS[period];
    try {
      const data = await getEventCandlesticks(markets, opt.seconds, opt.interval);
      setCandleData(data);
    } catch (e) {
      console.error('Failed to fetch candlesticks:', e);
    } finally {
      setLoading(false);
    }
  }, [markets.length, period]); // depends on markets list & period selection

  useEffect(() => {
    setLoading(true);
    fetchCandles();
    const timer = setInterval(fetchCandles, 5000); // 5s refresh for live feel
    return () => clearInterval(timer);
  }, [fetchCandles]);

  if (!event) return null;

  const totalVolume = markets.reduce((s, m) => s + parseFloat(m.volume_fp || 0), 0);

  // Build chart datasets — top outcomes with candle data
  const displayMarkets = showAll ? sortedMarkets : sortedMarkets.slice(0, 3);
  const chartDatasets = sortedMarkets
    .filter(m => candleData[m.ticker] && candleData[m.ticker].length >= 2)
    .slice(0, 5) // max 5 lines on chart
    .map(m => ({
      label: m.yes_sub_title || m.title || m.ticker,
      color: marketColors[m.ticker],
      candles: candleData[m.ticker],
    }));

  return (
    <div className="market-detail">
      <div className="market-detail__header">
        <button className="market-detail__back" onClick={onClose}>&larr;</button>
        <div>
          <div className="market-detail__event-label">{event.category}</div>
          <h2 className="market-detail__title">{event.title}</h2>
          {event.sub_title && (
            <span className="market-detail__subtitle">{event.sub_title}</span>
          )}
        </div>
      </div>

      {/* Probability Legend */}
      <div className="market-detail__legend">
        {sortedMarkets.slice(0, 5).map((m) => {
          const prob = Math.round(parseFloat(m.last_price_dollars || m.yes_bid_dollars || 0) * 100);
          return (
            <div key={m.ticker} className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: marketColors[m.ticker] }} />
              <span>{m.yes_sub_title || m.title}</span>
              <span className="legend-prob">{prob}%</span>
            </div>
          );
        })}
      </div>

      {/* Multi-line Chart */}
      <div className="market-detail__chart-section">
        {loading ? (
          <div className="chart-loading">Loading chart...</div>
        ) : (
          <MultiLineChart datasets={chartDatasets} width={780} height={280} />
        )}

        <div className="market-detail__chart-header">
          <div className="market-detail__volume-bar">
            <span className="market-detail__volume-value">
              ${totalVolume > 0 ? formatVolume(totalVolume) : '0'}
            </span>
            <span>vol</span>
          </div>
          <div className="period-selector">
            {PERIOD_OPTIONS.map((opt, i) => (
              <button
                key={opt.label}
                className={`period-btn ${period === i ? 'period-btn--active' : ''}`}
                onClick={() => setPeriod(i)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search within event */}
      {markets.length > 5 && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#999', fontSize: 13 }}>
          <span>🔍</span>
          <span>Search</span>
        </div>
      )}

      {/* Outcome List — Kalshi style */}
      <div className="market-detail__outcomes">
        {displayMarkets.map((m) => {
          const prob = Math.round(parseFloat(m.last_price_dollars || m.yes_bid_dollars || 0) * 100);
          const yesBid = parseFloat(m.yes_bid_dollars || 0);
          const yesAsk = parseFloat(m.yes_ask_dollars || 0);
          const bidCents = Math.round(yesBid * 100);
          const askCents = Math.round(yesAsk * 100);

          return (
            <div
              key={m.ticker}
              className="outcome-row-kalshi"
              onClick={() => setSelectedTicker(m.ticker)}
              style={{ cursor: 'pointer', background: m.ticker === selectedTicker ? 'rgba(0,212,170,0.05)' : undefined }}
            >
              <div className="outcome-row-kalshi__left">
                <div
                  className="outcome-row-kalshi__color"
                  style={{ backgroundColor: marketColors[m.ticker] }}
                />
                <span className="outcome-row-kalshi__name">
                  {m.yes_sub_title || m.title}
                </span>
              </div>
              <div className="outcome-row-kalshi__right">
                <div className="outcome-row-kalshi__scores">
                  <span className="outcome-row-kalshi__score">
                    {bidCents > 0 ? `-${bidCents}` : '—'}
                  </span>
                  <span className="outcome-row-kalshi__score">
                    {askCents > 0 ? askCents : '—'}
                  </span>
                </div>
                <span className="outcome-row-kalshi__prob">{prob}%</span>
              </div>
            </div>
          );
        })}

        {/* Show more / Show all */}
        {sortedMarkets.length > 3 && (
          <div
            className="outcome-row-kalshi__show-more"
            onClick={() => setShowAll(!showAll)}
          >
            <span>
              {showAll ? '' : `+${sortedMarkets.length - 3} more`}
            </span>
            <span>{showAll ? 'Show less' : 'Show all'}</span>
          </div>
        )}
      </div>

      {/* Order form */}
      {selectedMarket && (
        <OrderForm
          market={selectedMarket}
          auth={auth}
          onPlaceOrder={onPlaceOrder}
          onSell={onSell}
          position={null}
        />
      )}
    </div>
  );
}
