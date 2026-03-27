'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseAutoRefreshReturn<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  lastFetchedAt: string | null;
  refresh: () => void;
}

export function useAutoRefresh<T>(
  apiPath: string,
  intervalMs: number = 60000
): UseAutoRefreshReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(apiPath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      setData(result);
      setError(null);
      setLastFetchedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [apiPath]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, intervalMs);
    return () => clearInterval(interval);
  }, [fetchData, intervalMs]);

  return { data, error, isLoading, lastFetchedAt, refresh };
}
