import type { Orderbook } from '@sports-betting/shared';

interface OrderbookChartProps {
  orderbook: Orderbook;
}

export function OrderbookChart({ orderbook }: OrderbookChartProps) {
  const maxYesQty = Math.max(...orderbook.yes.map((l) => l.quantity), 1);
  const maxNoQty = Math.max(...orderbook.no.map((l) => l.quantity), 1);
  const maxQty = Math.max(maxYesQty, maxNoQty);

  // Sort yes bids descending, no asks ascending
  const yesSorted = [...orderbook.yes].sort((a, b) => b.price - a.price).slice(0, 10);
  const noSorted = [...orderbook.no].sort((a, b) => a.price - b.price).slice(0, 10);

  if (yesSorted.length === 0 && noSorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-surface-2/50 rounded-lg">
        <p className="text-gray-500 text-sm">No orderbook data</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-xs">
        {/* Yes side (bids) */}
        <div>
          <div className="flex justify-between text-gray-500 mb-2 px-1">
            <span>Price</span>
            <span>Qty</span>
          </div>
          {yesSorted.map((level, i) => (
            <div key={i} className="relative flex justify-between items-center px-1 py-0.5">
              <div
                className="absolute inset-0 bg-emerald-500/10 rounded-sm"
                style={{ width: `${(level.quantity / maxQty) * 100}%` }}
              />
              <span className="relative text-emerald-400 font-medium">{level.price}¢</span>
              <span className="relative text-gray-400">{level.quantity}</span>
            </div>
          ))}
        </div>

        {/* No side (asks) */}
        <div>
          <div className="flex justify-between text-gray-500 mb-2 px-1">
            <span>Price</span>
            <span>Qty</span>
          </div>
          {noSorted.map((level, i) => (
            <div key={i} className="relative flex justify-between items-center px-1 py-0.5">
              <div
                className="absolute right-0 inset-y-0 bg-red-500/10 rounded-sm"
                style={{ width: `${(level.quantity / maxQty) * 100}%` }}
              />
              <span className="relative text-red-400 font-medium">{level.price}¢</span>
              <span className="relative text-gray-400">{level.quantity}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
