import { useQuery } from '@tanstack/react-query';
import { fetchBalance } from '@/api/positions';
import { usePlatformStore } from '@/store/platformStore';

export function useBalance() {
  const platform = usePlatformStore((s) => s.activePlatform);

  return useQuery({
    queryKey: ['balance', platform],
    queryFn: () => fetchBalance(platform),
    staleTime: 15_000,
    retry: false,
  });
}
