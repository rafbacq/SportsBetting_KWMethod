import { usePositions } from '@/hooks/usePositions';
import { useBalance } from '@/hooks/useBalance';
import { PositionCard } from '@/components/portfolio/PositionCard';
import { Spinner } from '@/components/common/Spinner';
import { formatDollars } from '@sports-betting/shared';
import { usePlatformStore } from '@/store/platformStore';

export function PortfolioPage() {
  const platform = usePlatformStore((s) => s.activePlatform);
  const { data: positions, isLoading: positionsLoading, error: positionsError } = usePositions();
  const { data: balance, isLoading: balanceLoading } = useBalance();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Portfolio</h1>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Available Balance</p>
          {balanceLoading ? (
            <Spinner size="sm" />
          ) : (
            <p className="text-2xl font-bold">{balance ? formatDollars(balance.available) : '--'}</p>
          )}
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Portfolio Value</p>
          {balanceLoading ? (
            <Spinner size="sm" />
          ) : (
            <p className="text-2xl font-bold">{balance ? formatDollars(balance.total) : '--'}</p>
          )}
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Platform</p>
          <p className="text-2xl font-bold capitalize">{platform}</p>
        </div>
      </div>

      {/* Positions */}
      <h2 className="text-lg font-semibold mb-4">Open Positions</h2>

      {positionsLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : positionsError ? (
        <div className="card p-6 text-center">
          <p className="text-red-400 mb-1">Failed to load positions</p>
          <p className="text-sm text-gray-500">
            Make sure you're connected to {platform}. Go to Settings to configure API keys.
          </p>
        </div>
      ) : !positions?.data.length ? (
        <div className="card p-10 text-center">
          <p className="text-gray-400 mb-1">No open positions</p>
          <p className="text-sm text-gray-500">Browse markets and place your first bet!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {positions.data.map((pos) => (
            <PositionCard key={pos.id} position={pos} />
          ))}
        </div>
      )}
    </div>
  );
}
