import { Link } from 'react-router-dom';
import type { Market } from '@sports-betting/shared';
import { formatVolume } from '@sports-betting/shared';

interface MarketCardProps {
  market: Market;
}

export function MarketCard({ market }: MarketCardProps) {
  const yesColor = market.yesPrice >= 50 ? 'text-emerald-400' : 'text-gray-300';
  const noColor = market.noPrice >= 50 ? 'text-red-400' : 'text-gray-300';

  return (
    <Link
      to={`/market/${encodeURIComponent(market.id)}?platform=${market.platform}`}
      className="card group hover:border-white/10 transition-all duration-200 hover:shadow-lg hover:shadow-brand-900/10"
    >
      <div className="p-4">
        {/* Category badge */}
        {market.category && (
          <span className="inline-block text-[10px] font-medium uppercase tracking-wider text-brand-400 bg-brand-600/10 px-2 py-0.5 rounded-full mb-2">
            {market.category}
          </span>
        )}

        {/* Title */}
        <h3 className="text-sm font-medium text-gray-100 line-clamp-2 mb-3 group-hover:text-white transition-colors leading-snug">
          {market.title}
        </h3>

        {/* Prices */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 bg-emerald-500/10 rounded-lg px-3 py-2 text-center">
            <div className="text-[10px] text-gray-400 mb-0.5">Yes</div>
            <div className={`text-lg font-bold ${yesColor}`}>{market.yesPrice}¢</div>
          </div>
          <div className="flex-1 bg-red-500/10 rounded-lg px-3 py-2 text-center">
            <div className="text-[10px] text-gray-400 mb-0.5">No</div>
            <div className={`text-lg font-bold ${noColor}`}>{market.noPrice}¢</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{formatVolume(market.volume || 0)} vol</span>
          <span className="capitalize">{market.platform}</span>
        </div>
      </div>
    </Link>
  );
}
