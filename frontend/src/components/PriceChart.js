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

  const pad = { top: 16, right: 0, bottom: 0, left: 0 };
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

  // No axes or grid lines are rendered in this Kalshi clone


  return (
    <svg className="price-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>

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

        let linePath = `M${points[0].x},${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          linePath += ` L${points[i].x},${points[i - 1].y} L${points[i].x},${points[i].y}`;
        }
        
        const lastPt = points[points.length - 1];

        // Area fill for first dataset only
        const areaPath = di === 0
          ? `${linePath} L${lastPt.x},${toY(0)}L${points[0].x},${toY(0)}Z`
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
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Current price dot */}
            <circle cx={lastPt.x} cy={lastPt.y} r="5" fill={color} />
          </g>
        );
      })}

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
