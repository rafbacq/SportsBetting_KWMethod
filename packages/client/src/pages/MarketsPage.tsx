import { useState } from 'react';
import { useMarkets } from '@/hooks/useMarkets';
import { MarketList } from '@/components/markets/MarketList';
import { MarketSearch } from '@/components/markets/MarketSearch';
import { usePlatformStore } from '@/store/platformStore';

export function MarketsPage() {
  const [search, setSearch] = useState('');
  const platform = usePlatformStore((s) => s.activePlatform);
  const { data, isLoading, error } = useMarkets({ search: search || undefined });

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Markets</h1>
          <p className="text-sm text-gray-500 mt-1">
            Browse {platform === 'kalshi' ? 'Kalshi' : 'Polymarket'} prediction markets
          </p>
        </div>
        <div className="w-full sm:w-72">
          <MarketSearch value={search} onChange={setSearch} />
        </div>
      </div>

      <MarketList
        markets={data?.data || []}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}
