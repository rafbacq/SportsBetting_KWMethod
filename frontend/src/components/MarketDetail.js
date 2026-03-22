import React, { useState, useEffect, useCallback } from 'react';
import PriceChart from './PriceChart';
import OrderForm from './OrderForm';
import { getCandlesticks } from '../services/kalshiApi';

const PERIOD_OPTIONS = [
  { label: '1H', seconds: 3600, interval: 60 },
  { label: '6H', seconds: 21600, interval: 300 },
  { label: '24H', seconds: 86400, interval: 900 },
  { label: '7D', seconds: 604800, interval: 3600 },
];

export default function MarketDetail({ market, auth, onPlaceOrder, onSell, onClose, position }) {
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(2); // default 24H

  const fetchCandles = useCallback(async () => {
    if (!market) return;
    const opt = PERIOD_OPTIONS[period];
    const now = Math.floor(Date.now() / 1000);
    try {
      const data = await getCandlesticks(market.ticker, {
        startTs: now - opt.seconds,
        endTs: now,
        periodInterval: opt.interval,
      });
      setCandles(data);
    } catch (e) {
      console.error('Failed to fetch candlesticks:', e);
    } finally {
      setLoading(false);
    }
  }, [market, period]);

  useEffect(() => {
    setLoading(true);
    fetchCandles();
    const timer = setInterval(fetchCandles, 10000);
    return () => clearInterval(timer);
  }, [fetchCandles]);

  if (!market) return null;

  const lastPrice = parseFloat(market.last_price_dollars || 0);
  const volume = parseFloat(market.volume_fp || 0);
  const openInterest = parseFloat(market.open_interest_fp || 0);

  return (
    <div className="market-detail">
      <div className="market-detail__header">
        <button className="market-detail__back" onClick={onClose}>&larr; Back</button>
        <h2 className="market-detail__title">{market.title}</h2>
      </div>

      {market.rules_primary && (
        <p className="market-detail__rules">{market.rules_primary}</p>
      )}

      <div className="market-detail__stats">
        <div className="detail-stat">
          <span className="detail-stat__value">{(lastPrice * 100).toFixed(0)}¢</span>
          <span className="detail-stat__label">Last Price</span>
        </div>
        <div className="detail-stat">
          <span className="detail-stat__value">{volume.toLocaleString()}</span>
          <span className="detail-stat__label">Volume</span>
        </div>
        <div className="detail-stat">
          <span className="detail-stat__value">{openInterest.toLocaleString()}</span>
          <span className="detail-stat__label">Open Interest</span>
        </div>
        <div className="detail-stat">
          <span className="detail-stat__value">{(lastPrice * 100).toFixed(0)}%</span>
          <span className="detail-stat__label">Implied Prob</span>
        </div>
      </div>

      <div className="market-detail__chart-section">
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

        {loading ? (
          <div className="chart-loading">Loading chart...</div>
        ) : (
          <PriceChart candles={candles} width={700} height={260} showAxes />
        )}
      </div>

      <OrderForm
        market={market}
        auth={auth}
        onPlaceOrder={onPlaceOrder}
        onSell={onSell}
        position={position}
      />
    </div>
  );
}
