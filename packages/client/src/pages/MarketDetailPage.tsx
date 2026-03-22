import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useMarket } from '@/hooks/useMarket';
import { useOrderStore } from '@/store/orderStore';
import { PriceChart } from '@/components/charts/PriceChart';
import { OrderbookChart } from '@/components/charts/OrderbookChart';
import { Spinner } from '@/components/common/Spinner';
import { formatVolume, formatDate } from '@sports-betting/shared';

export function MarketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const openBetSlip = useOrderStore((s) => s.openBetSlip);

  // Read platform from URL if available
  const urlPlatform = searchParams.get('platform');
  if (urlPlatform) {
    // Handled by the store/hook
  }

  const { market, orderbook, history } = useMarket(id || '');

  if (market.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (market.error || !market.data) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-2">Failed to load market</p>
        <Link to="/" className="text-brand-400 text-sm hover:underline">
          Back to markets
        </Link>
      </div>
    );
  }

  const m = market.data;

  const handleTrade = (side: 'yes' | 'no') => {
    openBetSlip({
      marketId: m.id,
      marketTicker: m.ticker,
      marketTitle: m.title,
      side,
      price: side === 'yes' ? m.yesPrice : m.noPrice,
    });
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          Markets
        </Link>
        <span className="text-gray-600 mx-2">/</span>
        <span className="text-sm text-gray-300">{m.ticker}</span>
      </div>

      {/* Market Header */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {m.category && (
                <span className="text-[10px] font-medium uppercase tracking-wider text-brand-400 bg-brand-600/10 px-2 py-0.5 rounded-full">
                  {m.category}
                </span>
              )}
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 bg-surface-2 px-2 py-0.5 rounded-full">
                {m.platform}
              </span>
            </div>
            <h1 className="text-xl font-bold mb-2">{m.title}</h1>
            <p className="text-sm text-gray-400 mb-4">{m.description}</p>

            <div className="flex items-center gap-6 text-sm text-gray-400">
              <span>{formatVolume(m.volume)} volume</span>
              <span>Closes {formatDate(m.closesAt)}</span>
            </div>
          </div>

          {/* Trade buttons */}
          <div className="flex gap-3 lg:flex-col lg:w-48">
            <button onClick={() => handleTrade('yes')} className="btn-yes flex-1 text-center">
              <div className="text-[10px] opacity-70 mb-0.5">Yes</div>
              <div className="text-xl font-bold">{m.yesPrice}¢</div>
            </button>
            <button onClick={() => handleTrade('no')} className="btn-no flex-1 text-center">
              <div className="text-[10px] opacity-70 mb-0.5">No</div>
              <div className="text-xl font-bold">{m.noPrice}¢</div>
            </button>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Price chart */}
        <div className="lg:col-span-2 card p-4">
          <h2 className="text-sm font-semibold mb-3 text-gray-300">Price History</h2>
          <PriceChart data={history.data?.points || []} height={350} />
        </div>

        {/* Orderbook */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 text-gray-300">Order Book</h2>
          {orderbook.isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : orderbook.data ? (
            <OrderbookChart orderbook={orderbook.data} />
          ) : (
            <p className="text-gray-500 text-sm text-center py-10">No data</p>
          )}
        </div>
      </div>
    </div>
  );
}
