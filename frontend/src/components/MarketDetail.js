import React, { useState, useEffect, useCallback } from 'react';
import PriceChart from './PriceChart';
import OrderForm from './OrderForm';
import { getCandlesticks, formatCents, formatVolume } from '../services/kalshiApi';

const PERIOD_OPTIONS = [
  { label: '1H', seconds: 3600, interval: 60 },
  { label: '6H', seconds: 21600, interval: 300 },
  { label: '24H', seconds: 86400, interval: 900 },
  { label: '7D', seconds: 604800, interval: 3600 },
];

/**
 * Detailed view of a Kalshi event.
 * Shows all market outcomes with selectable charts and order placement.
 */
export default function MarketDetail({ event, auth, onPlaceOrder, onSell, onClose }) {
  const markets = event.markets || [];
  const [selectedTicker, setSelectedTicker] = useState(
    markets.length > 0 ? markets[0].ticker : null
  );
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(2); // default 24H

  const selectedMarket = markets.find((m) => m.ticker === selectedTicker) || markets[0];

  const fetchCandles = useCallback(async () => {
    if (!selectedTicker) return;
    const opt = PERIOD_OPTIONS[period];
    const now = Math.floor(Date.now() / 1000);
    try {
      const data = await getCandlesticks(selectedTicker, {
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
  }, [selectedTicker, period]);

  useEffect(() => {
    setLoading(true);
    fetchCandles();
    const timer = setInterval(fetchCandles, 10000);
    return () => clearInterval(timer);
  }, [fetchCandles]);

  if (!event) return null;

  const totalVolume = markets.reduce((s, m) => s + parseFloat(m.volume_fp || 0), 0);

  return (
    <div className="market-detail">
      <div className="market-detail__header">
        <button className="market-detail__back" onClick={onClose}>&larr; Back</button>
        <div>
          <h2 className="market-detail__title">{event.title}</h2>
          {event.sub_title && (
            <span className="market-detail__subtitle">{event.sub_title}</span>
          )}
        </div>
      </div>

      {selectedMarket && selectedMarket.rules_primary && (
        <p className="market-detail__rules">{selectedMarket.rules_primary}</p>
      )}

      {/* Market outcomes table */}
      <div className="market-detail__outcomes">
        <table className="outcomes-table">
          <thead>
            <tr>
              <th>Outcome</th>
              <th>Yes Bid</th>
              <th>Yes Ask</th>
              <th>Last</th>
              <th>Volume</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((m) => {
              const isSelected = m.ticker === selectedTicker;
              return (
                <tr
                  key={m.ticker}
                  className={`outcomes-table__row ${isSelected ? 'outcomes-table__row--selected' : ''}`}
                  onClick={() => setSelectedTicker(m.ticker)}
                >
                  <td className="outcomes-table__label">{m.yes_sub_title || m.title}</td>
                  <td className="outcomes-table__yes">{formatCents(m.yes_bid_dollars)}</td>
                  <td>{formatCents(m.yes_ask_dollars)}</td>
                  <td>{formatCents(m.last_price_dollars)}</td>
                  <td>{formatVolume(m.volume_fp)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stats for selected market */}
      {selectedMarket && (
        <div className="market-detail__stats">
          <div className="detail-stat">
            <span className="detail-stat__value">{formatCents(selectedMarket.last_price_dollars)}</span>
            <span className="detail-stat__label">Last Price</span>
          </div>
          <div className="detail-stat">
            <span className="detail-stat__value">{formatVolume(selectedMarket.volume_fp)}</span>
            <span className="detail-stat__label">Volume</span>
          </div>
          <div className="detail-stat">
            <span className="detail-stat__value">{formatVolume(selectedMarket.open_interest_fp)}</span>
            <span className="detail-stat__label">Open Interest</span>
          </div>
          <div className="detail-stat">
            <span className="detail-stat__value">{totalVolume > 0 ? formatVolume(totalVolume) : '0'}</span>
            <span className="detail-stat__label">Event Volume</span>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="market-detail__chart-section">
        <div className="market-detail__chart-header">
          <span className="market-detail__chart-title">
            {selectedMarket ? (selectedMarket.yes_sub_title || selectedMarket.title) : 'Select outcome'}
          </span>
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

        {loading ? (
          <div className="chart-loading">Loading chart...</div>
        ) : (
          <PriceChart candles={candles} width={700} height={260} showAxes />
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
