import { useQuery } from '@tanstack/react-query';
import { fetchMarkets } from '@/api/markets';
import { usePlatformStore } from '@/store/platformStore';

export function useMarkets(params?: { search?: string; category?: string; status?: string }) {
  const platform = usePlatformStore((s) => s.activePlatform);

  return useQuery({
    queryKey: ['markets', platform, params],
    queryFn: () =>
      fetchMarkets({
        platform,
        status: params?.status || 'open',
        search: params?.search,
        category: params?.category,
        limit: 40,
      }),
    staleTime: 30_000,
  });
}
