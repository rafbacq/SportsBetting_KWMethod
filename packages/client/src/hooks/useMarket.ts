import { useQuery } from '@tanstack/react-query';
import { fetchMarket, fetchOrderbook, fetchMarketHistory } from '@/api/markets';
import { usePlatformStore } from '@/store/platformStore';

export function useMarket(id: string) {
  const platform = usePlatformStore((s) => s.activePlatform);

  const market = useQuery({
    queryKey: ['market', platform, id],
    queryFn: () => fetchMarket(id, platform),
    enabled: !!id,
    staleTime: 10_000,
  });

  const orderbook = useQuery({
    queryKey: ['orderbook', platform, id],
    queryFn: () => fetchOrderbook(id, platform),
    enabled: !!id,
    refetchInterval: 5_000,
  });

  const history = useQuery({
    queryKey: ['history', platform, id],
    queryFn: () => fetchMarketHistory(id, platform),
    enabled: !!id,
    staleTime: 60_000,
  });

  return { market, orderbook, history };
}
