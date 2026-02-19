import { useState, useCallback, useRef, useEffect } from 'react';
import { PlatformCustomer } from '../services/customer/CustomerServiceInterface';
import { customerServiceFactory } from '../services/customer/customerServiceFactory';
import { ECommercePlatform } from '../utils/platforms';

interface UseCustomerSearchResult {
  /** Current search results */
  customers: PlatformCustomer[];
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Error message if the last search failed */
  error: string | null;
  /** Whether more results are available */
  hasMore: boolean;
  /** Trigger a search with the given query */
  search: (query: string) => void;
  /** Load the next page of results */
  loadMore: () => void;
  /** Clear results */
  clear: () => void;
  /** Whether the customer service is available for the current platform */
  isAvailable: boolean;
}

/**
 * Debounced customer search hook.
 * Calls the platform's customer API with a 300ms debounce.
 *
 * @param platform The current e-commerce platform
 * @param debounceMs Debounce delay in milliseconds (default 300)
 */
export function useCustomerSearch(platform: ECommercePlatform | undefined, debounceMs = 300): UseCustomerSearchResult {
  const [customers, setCustomers] = useState<PlatformCustomer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [lastQuery, setLastQuery] = useState('');

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef(0); // simple counter to ignore stale responses

  const service = platform ? customerServiceFactory.getService(platform) : null;
  const isAvailable = !!service;

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const performSearch = useCallback(
    async (query: string, cursor?: string) => {
      if (!service) return;

      const callId = ++abortRef.current;
      setIsSearching(true);
      setError(null);

      try {
        const result = await service.searchCustomers({
          query,
          limit: 10,
          cursor,
        });

        // Ignore stale responses
        if (callId !== abortRef.current) return;

        if (cursor) {
          // Appending to existing results
          setCustomers(prev => [...prev, ...result.customers]);
        } else {
          setCustomers(result.customers);
        }
        setHasMore(result.hasMore);
        setNextCursor(result.nextCursor);
      } catch {
        if (callId !== abortRef.current) return;
        setError('Failed to search customers. Please try again.');
      } finally {
        if (callId === abortRef.current) {
          setIsSearching(false);
        }
      }
    },
    [service]
  );

  const search = useCallback(
    (query: string) => {
      setLastQuery(query);

      if (!query.trim()) {
        setCustomers([]);
        setHasMore(false);
        setNextCursor(undefined);
        setError(null);
        return;
      }

      // Debounce
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        performSearch(query);
      }, debounceMs);
    },
    [performSearch, debounceMs]
  );

  const loadMore = useCallback(() => {
    if (!hasMore || !nextCursor || isSearching) return;
    performSearch(lastQuery, nextCursor);
  }, [hasMore, nextCursor, isSearching, lastQuery, performSearch]);

  const clear = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    abortRef.current++;
    setCustomers([]);
    setHasMore(false);
    setNextCursor(undefined);
    setError(null);
    setLastQuery('');
    setIsSearching(false);
  }, []);

  return { customers, isSearching, error, hasMore, search, loadMore, clear, isAvailable };
}
