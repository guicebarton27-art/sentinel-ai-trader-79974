import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Candle,
  Ticker,
  fetchCandlesFromDB,
  fetchAndStoreCandlesViaEdge,
  fetchTickerFromKraken,
  fetchMultipleTickersFromKraken,
  SUPPORTED_SYMBOLS,
} from '@/services/marketDataService';

export interface UseCandlesOptions {
  symbol: string;
  interval: string;
  autoFetch?: boolean; // Whether to auto-fetch from Kraken if DB is empty
  limit?: number;
}

export function useCandles({ symbol, interval, autoFetch = true, limit = 100 }: UseCandlesOptions) {
  const queryClient = useQueryClient();
  const [isFetching, setIsFetching] = useState(false);

  const query = useQuery({
    queryKey: ['candles', symbol, interval, limit],
    queryFn: () => fetchCandlesFromDB(symbol, interval, limit),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Refetch every minute
  });

  // Fetch from Kraken if no data in DB
  useEffect(() => {
    if (autoFetch && query.isSuccess && query.data.length === 0 && !isFetching) {
      setIsFetching(true);
      fetchAndStoreCandlesViaEdge(symbol, interval)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['candles', symbol, interval] });
        })
        .catch(console.error)
        .finally(() => setIsFetching(false));
    }
  }, [autoFetch, query.isSuccess, query.data?.length, isFetching, symbol, interval, queryClient]);

  const refetchFromExchange = useCallback(async () => {
    setIsFetching(true);
    try {
      await fetchAndStoreCandlesViaEdge(symbol, interval);
      await queryClient.invalidateQueries({ queryKey: ['candles', symbol, interval] });
    } finally {
      setIsFetching(false);
    }
  }, [symbol, interval, queryClient]);

  return {
    candles: query.data || [],
    loading: query.isLoading || isFetching,
    error: query.error?.message || null,
    refetch: query.refetch,
    refetchFromExchange,
  };
}

export interface UseTickerOptions {
  symbol: string;
  refreshInterval?: number; // ms, default 10s
}

export function useTicker({ symbol, refreshInterval = 10000 }: UseTickerOptions) {
  const query = useQuery({
    queryKey: ['ticker', symbol],
    queryFn: () => fetchTickerFromKraken(symbol),
    staleTime: 5000,
    refetchInterval: refreshInterval,
    retry: 2,
  });

  return {
    ticker: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

export function useMultipleTickers(symbols: string[] = [...SUPPORTED_SYMBOLS], refreshInterval = 15000) {
  const query = useQuery({
    queryKey: ['tickers', symbols.join(',')],
    queryFn: () => fetchMultipleTickersFromKraken(symbols),
    staleTime: 5000,
    refetchInterval: refreshInterval,
    retry: 2,
  });

  return {
    tickers: query.data || [],
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

// Hook for combined candle + ticker data (for charts)
export function useChartData(symbol: string, interval: string = '1h') {
  const { candles, loading: candlesLoading, error: candlesError, refetchFromExchange } = useCandles({
    symbol,
    interval,
    autoFetch: true,
  });

  const { ticker, loading: tickerLoading, error: tickerError } = useTicker({
    symbol,
    refreshInterval: 10000,
  });

  // Append latest tick to candles if it's newer
  const candlesWithLive = useRef<Candle[]>([]);
  
  useEffect(() => {
    if (candles.length > 0 && ticker) {
      const lastCandle = candles[candles.length - 1];
      const now = Math.floor(Date.now() / 1000);
      
      // If the ticker price is different from last candle close, update it
      if (ticker.price !== lastCandle.close) {
        candlesWithLive.current = [
          ...candles.slice(0, -1),
          {
            ...lastCandle,
            close: ticker.price,
            high: Math.max(lastCandle.high, ticker.price),
            low: Math.min(lastCandle.low, ticker.price),
          },
        ];
      } else {
        candlesWithLive.current = candles;
      }
    } else {
      candlesWithLive.current = candles;
    }
  }, [candles, ticker]);

  return {
    candles: candlesWithLive.current.length > 0 ? candlesWithLive.current : candles,
    ticker,
    loading: candlesLoading || tickerLoading,
    error: candlesError || tickerError,
    refetchFromExchange,
    hasData: candles.length > 0,
  };
}
