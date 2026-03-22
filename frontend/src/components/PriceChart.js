import React from 'react';

/**
 * SVG line chart for market price history.
 * Renders candlestick close prices as a line with optional area fill.
 *
 * Props:
 *   candles    — array of {end_period_ts, price: {close_dollars}} from Kalshi API
 *   width      — SVG width (default 600)
 *   height     — SVG height (default 200)
 *   showAxes   — show Y-axis labels (default false for sparklines)
 *   color      — line color
 */
export default function PriceChart({
  candles = [],
  width = 600,
  height = 200,
  showAxes = false,
  color = '#2563eb',
}) {
  if (candles.length < 2) {
    return (
      <div className="price-chart price-chart--empty" style={{ width, height }}>
        <span>No price data available</span>
      </div>
    );
  }

  const pad = showAxes ? { top: 10, right: 10, bottom: 24, left: 44 } : { top: 4, right: 4, bottom: 4, left: 4 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const prices = candles.map((c) => {
    const p = c.price || c;
    return parseFloat(p.close_dollars || p.mean_dollars || p.close || 0);
  });
  const times = candles.map((c) => c.end_period_ts || 0);

  const minP = Math.max(0, Math.min(...prices) - 0.02);
  const maxP = Math.min(1, Math.max(...prices) + 0.02);
  const rangeP = maxP - minP || 0.01;
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const rangeT = maxT - minT || 1;

  const toX = (t) => pad.left + ((t - minT) / rangeT) * plotW;
  const toY = (p) => pad.top + (1 - (p - minP) / rangeP) * plotH;

  const points = prices.map((p, i) => `${toX(times[i])},${toY(p)}`);
  const linePath = `M${points.join('L')}`;
  const areaPath = `${linePath}L${toX(times[times.length - 1])},${toY(minP)}L${toX(times[0])},${toY(minP)}Z`;

  const lastPrice = prices[prices.length - 1];
  const firstPrice = prices[0];
  const trending = lastPrice >= firstPrice;
  const lineColor = color || (trending ? '#16a34a' : '#dc2626');

  // Y-axis ticks
  const yTicks = showAxes ? [minP, minP + rangeP * 0.25, minP + rangeP * 0.5, minP + rangeP * 0.75, maxP] : [];

  // X-axis ticks (4 evenly spaced)
  const xTicks = showAxes
    ? [0, 1, 2, 3].map((i) => {
        const t = minT + (rangeT * i) / 3;
        const d = new Date(t * 1000);
        return { t, label: `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` };
      })
    : [];

  return (
    <svg className="price-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Area fill */}
      <path d={areaPath} fill={lineColor} opacity="0.08" />

      {/* Line */}
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* Current price dot */}
      <circle cx={toX(times[times.length - 1])} cy={toY(lastPrice)} r="3" fill={lineColor} />

      {/* Y-axis labels */}
      {yTicks.map((p, i) => (
        <text key={i} x={pad.left - 6} y={toY(p) + 4} textAnchor="end" fontSize="11" fill="#888">
          {(p * 100).toFixed(0)}¢
        </text>
      ))}

      {/* X-axis labels */}
      {xTicks.map(({ t, label }, i) => (
        <text key={i} x={toX(t)} y={height - 4} textAnchor="middle" fontSize="10" fill="#888">
          {label}
        </text>
      ))}
    </svg>
  );
}

/**
 * Compact sparkline version for market cards.
 */
export function Sparkline({ candles = [], width = 100, height = 32 }) {
  if (candles.length < 2) return null;

  const prices = candles.map((c) => {
    const p = c.price || c;
    return parseFloat(p.close_dollars || p.mean_dollars || p.close || 0);
  });
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 0.01;

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width;
    const y = (1 - (p - min) / range) * height;
    return `${x},${y}`;
  });

  const last = prices[prices.length - 1];
  const first = prices[0];
  const color = last >= first ? '#16a34a' : '#dc2626';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline">
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
