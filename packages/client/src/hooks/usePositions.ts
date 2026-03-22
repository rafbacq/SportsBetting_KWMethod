import { useQuery } from '@tanstack/react-query';
import { fetchPositions } from '@/api/positions';
import { usePlatformStore } from '@/store/platformStore';

export function usePositions() {
  const platform = usePlatformStore((s) => s.activePlatform);

  return useQuery({
    queryKey: ['positions', platform],
    queryFn: () => fetchPositions(platform),
    staleTime: 10_000,
  });
}
