import React from 'react';

function formatPrice(dollars) {
  if (!dollars) return '—';
  const cents = Math.round(parseFloat(dollars) * 100);
  return `${cents}¢`;
}

function formatVolume(vol) {
  const n = parseFloat(vol || 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

export default function MarketCard({ market, isSelected, onClick }) {
  const yesPrice = formatPrice(market.yes_bid_dollars || market.last_price_dollars);
  const noPrice = formatPrice(market.no_bid_dollars);
  const volume = formatVolume(market.volume_fp);
  const lastPrice = parseFloat(market.last_price_dollars || 0);
  const prevPrice = parseFloat(market.previous_price_dollars || lastPrice);
  const diff = lastPrice - prevPrice;

  return (
    <div className={`market-card ${isSelected ? 'market-card--selected' : ''}`} onClick={onClick}>
      <div className="market-card__title">{market.title}</div>
      {market.subtitle && <div className="market-card__subtitle">{market.subtitle}</div>}

      <div className="market-card__prices">
        <div className="market-card__price market-card__price--yes">
          <span className="price-label">Yes</span>
          <span className="price-value">{yesPrice}</span>
        </div>
        <div className="market-card__price market-card__price--no">
          <span className="price-label">No</span>
          <span className="price-value">{noPrice}</span>
        </div>
        <div className="market-card__meta">
          {diff !== 0 && (
            <span className={`price-change ${diff > 0 ? 'price-change--up' : 'price-change--down'}`}>
              {diff > 0 ? '+' : ''}{(diff * 100).toFixed(0)}¢
            </span>
          )}
          <span className="volume-label">Vol {volume}</span>
        </div>
      </div>
    </div>
  );
}
