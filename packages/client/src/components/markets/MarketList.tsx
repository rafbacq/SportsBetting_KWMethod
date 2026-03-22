import type { Market } from '@sports-betting/shared';
import { MarketCard } from './MarketCard';
import { Spinner } from '@/components/common/Spinner';

interface MarketListProps {
  markets: Market[];
  isLoading: boolean;
  error?: Error | null;
}

export function MarketList({ markets, isLoading, error }: MarketListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-2">Failed to load markets</p>
        <p className="text-sm text-gray-500">{error.message}</p>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">No markets found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {markets.map((market) => (
        <MarketCard key={`${market.platform}-${market.id}`} market={market} />
      ))}
    </div>
  );
}
