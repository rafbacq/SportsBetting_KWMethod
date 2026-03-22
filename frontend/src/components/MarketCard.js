import React from 'react';
import { formatCents, formatVolume } from '../services/kalshiApi';

/**
 * Displays a Kalshi event with its nested market outcomes.
 * Shows event title, subtitle, category badge, and outcome prices.
 */
export default function MarketCard({ event, onClick }) {
  const markets = event.markets || [];
  const totalVolume = markets.reduce((s, m) => s + parseFloat(m.volume_fp || 0), 0);

  return (
    <div className="market-card" onClick={onClick}>
      <div className="market-card__header">
        <span className="market-card__category">{event.category}</span>
        {totalVolume > 0 && (
          <span className="market-card__volume">Vol {formatVolume(totalVolume)}</span>
        )}
      </div>

      <div className="market-card__title">{event.title}</div>
      {event.sub_title && <div className="market-card__subtitle">{event.sub_title}</div>}

      <div className="market-card__outcomes">
        {markets.slice(0, 4).map((m) => (
          <MarketOutcome key={m.ticker} market={m} />
        ))}
        {markets.length > 4 && (
          <div className="market-card__more">+{markets.length - 4} more</div>
        )}
      </div>
    </div>
  );
}

function MarketOutcome({ market }) {
  const label = market.yes_sub_title || market.title || market.ticker;
  const yesBid = formatCents(market.yes_bid_dollars);
  const yesAsk = formatCents(market.yes_ask_dollars);
  const lastPrice = parseFloat(market.last_price_dollars || 0);
  const prevPrice = parseFloat(market.previous_price_dollars || lastPrice);
  const diff = lastPrice - prevPrice;
  const vol = parseFloat(market.volume_fp || 0);

  return (
    <div className="outcome">
      <span className="outcome__label">{label}</span>
      <div className="outcome__prices">
        <span className="outcome__price">{yesBid}</span>
        {diff !== 0 && (
          <span className={`outcome__change ${diff > 0 ? 'outcome__change--up' : 'outcome__change--down'}`}>
            {diff > 0 ? '+' : ''}{(diff * 100).toFixed(0)}¢
          </span>
        )}
        {vol > 0 && <span className="outcome__vol">{formatVolume(vol)}</span>}
      </div>
    </div>
  );
}
