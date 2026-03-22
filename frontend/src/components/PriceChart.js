import React from 'react';

/**
 * Multi-line SVG chart for overlaying multiple outcome probability lines.
 * Mimics the Kalshi app's multi-outcome chart with:
 *   - Multiple colored lines for each outcome
 *   - Y-axis showing percentage (0%-100%)
 *   - X-axis with time labels
 *   - Current price dots at line endings
 *   - Gradient area fill for primary (first) line
 *
 * Props:
 *   datasets — [{ label, color, candles }]
 *   width, height — SVG dimensions
 */
export default function MultiLineChart({ datasets = [], width = 700, height = 280 }) {
  if (!datasets || datasets.length === 0 || datasets.every(d => (d.candles || []).length < 2)) {
    return (
      <div className="price-chart price-chart--empty" style={{ width, height }}>
        <span>No price data available</span>
      </div>
    );
  }

  const pad = { top: 16, right: 16, bottom: 28, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  // Collect all timestamps and determine global time range
  let allTimes = [];
  datasets.forEach(d => {
    (d.candles || []).forEach(c => {
      if (c.end_period_ts) allTimes.push(c.end_period_ts);
    });
  });
  allTimes = [...new Set(allTimes)].sort((a, b) => a - b);

  if (allTimes.length < 2) {
    return (
      <div className="price-chart price-chart--empty" style={{ width, height }}>
        <span>Insufficient data</span>
      </div>
    );
  }

  const minT = allTimes[0];
  const maxT = allTimes[allTimes.length - 1];
  const rangeT = maxT - minT || 1;

  // Fixed Y range: 0% to 100% (Kalshi probabilities)
  const minP = 0;
  const maxP = 1;
  const rangeP = 1;

  const toX = (t) => pad.left + ((t - minT) / rangeT) * plotW;
  const toY = (p) => pad.top + (1 - (p - minP) / rangeP) * plotH;

  // Y-axis ticks: 0%, 25%, 50%, 75%, 100%
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  // X-axis ticks: 4 evenly spaced
  const xTicks = [0, 1, 2, 3].map(i => {
    const t = minT + (rangeT * i) / 3;
    const d = new Date(t * 1000);
    const hours = d.getHours();
    const mins = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return { t, label: `${h12}:${mins} ${ampm}` };
  });

  // Grid lines
  const gridLines = yTicks.map(p => ({
    y: toY(p),
    label: `${Math.round(p * 100)}%`,
  }));

  return (
    <svg className="price-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Background grid — horizontal */}
      {gridLines.map((g, i) => (
        <g key={i}>
          <line
            x1={pad.left} y1={g.y} x2={width - pad.right} y2={g.y}
            stroke="#2a2a2a" strokeWidth="1" strokeDasharray="3,3"
          />
          <text x={pad.left - 8} y={g.y + 4} textAnchor="end" fontSize="11" fill="#666" fontFamily="Inter, sans-serif">
            {g.label}
          </text>
        </g>
      ))}

      {/* Render each dataset as a line */}
      {datasets.map((dataset, di) => {
        const { candles = [], color } = dataset;
        if (candles.length < 2) return null;

        const prices = candles.map(c => {
          const p = c.price || c;
          return parseFloat(p.close_dollars || p.mean_dollars || p.close || 0);
        });
        const times = candles.map(c => c.end_period_ts || 0);

        const points = prices.map((p, i) => ({
          x: toX(times[i]),
          y: toY(Math.max(0, Math.min(1, p))),
        }));

        const linePath = `M${points.map(pt => `${pt.x},${pt.y}`).join('L')}`;
        const lastPt = points[points.length - 1];

        // Area fill for first dataset only
        const areaPath = di === 0
          ? `${linePath}L${lastPt.x},${toY(0)}L${points[0].x},${toY(0)}Z`
          : null;

        const gradId = `grad-${di}`;

        return (
          <g key={di}>
            {/* Gradient definition for area */}
            {di === 0 && (
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.01" />
                </linearGradient>
              </defs>
            )}

            {/* Area fill */}
            {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}

            {/* Line */}
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={di === 0 ? 2.5 : 2}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={di === 0 ? 1 : 0.8}
            />

            {/* Current price dot */}
            <circle cx={lastPt.x} cy={lastPt.y} r="4" fill={color} />
            <circle cx={lastPt.x} cy={lastPt.y} r="7" fill={color} opacity="0.2" />
          </g>
        );
      })}

      {/* X-axis labels */}
      {xTicks.map(({ t, label }, i) => (
        <text key={i} x={toX(t)} y={height - 6} textAnchor="middle" fontSize="10" fill="#666" fontFamily="Inter, sans-serif">
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
  const color = last >= first ? '#00d4aa' : '#ef4444';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline">
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
