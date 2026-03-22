import type { Position } from '@sports-betting/shared';
import { centsToDollars, formatDollars } from '@sports-betting/shared';
import { useOrderStore } from '@/store/orderStore';

interface PositionCardProps {
  position: Position;
}

export function PositionCard({ position }: PositionCardProps) {
  const openBetSlip = useOrderStore((s) => s.openBetSlip);

  const pnlColor = position.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  const pnlSign = position.unrealizedPnl >= 0 ? '+' : '';

  const handleSell = () => {
    openBetSlip({
      marketId: position.marketId,
      marketTicker: position.marketTicker,
      marketTitle: position.marketTitle,
      side: position.side,
      action: 'sell',
      price: position.currentPrice,
      quantity: position.quantity,
    });
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate">{position.marketTitle}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                position.side === 'yes'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {position.side.toUpperCase()}
            </span>
            <span className="text-xs text-gray-500">
              {position.quantity} contracts @ {centsToDollars(position.avgPrice)}
            </span>
          </div>
        </div>

        <button onClick={handleSell} className="btn-secondary text-xs py-1 px-3 ml-3 shrink-0">
          Sell
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-gray-500 uppercase">Current</p>
          <p className="text-sm font-medium">{centsToDollars(position.currentPrice)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase">Value</p>
          <p className="text-sm font-medium">{formatDollars(position.marketValue / 100)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase">P&L</p>
          <p className={`text-sm font-medium ${pnlColor}`}>
            {pnlSign}{formatDollars(position.unrealizedPnl / 100)}
          </p>
        </div>
      </div>
    </div>
  );
}
