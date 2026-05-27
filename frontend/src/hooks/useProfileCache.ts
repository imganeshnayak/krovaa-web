import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfileFull, ProfileFull } from '@/lib/api';

/**
 * React Query hook for fetching and caching profile data (user + posts + rating eligibility)
 * Automatically deduplicates requests — if 2 components request same user, only 1 HTTP call
 * Cache is manual-invalidate (no auto-expiration) — cleared on logout/profile update
 */
export function useProfileById(userId: number | null | undefined) {
  return useQuery<ProfileFull>({
    queryKey: ['profile', userId],
    queryFn: () => getProfileFull(userId!),
    enabled: !!userId,
    staleTime: Infinity, // Never auto-stale; only manual invalidation
    gcTime: 24 * 60 * 60 * 1000, // Keep in memory for 24 hours before garbage collection
  });
}

/**
 * Hook to invalidate a specific profile's cache
 */
export function useInvalidateProfile() {
  const queryClient = useQueryClient();
  
  return (userId: number) => {
    queryClient.invalidateQueries({ queryKey: ['profile', userId] });
  };
}

/**
 * Hook to clear all profile caches (used on logout)
 */
export function useClearProfileCache() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.removeQueries({ queryKey: ['profile'] });
  };
}

/**
 * Hook to set profile data in cache (e.g., after successful profile update)
 */
export function useSetProfileCache() {
  const queryClient = useQueryClient();
  
  return (userId: number, data: ProfileFull) => {
    queryClient.setQueryData(['profile', userId], data);
  };
}
