import { supabase } from "@/integrations/supabase/client";

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Ticker {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume24h: number;
  change24h: number;
  high24h: number;
  low24h: number;
}

export interface MarketDataState {
  candles: Candle[];
  ticker: Ticker | null;
  loading: boolean;
  error: string | null;
}

// Symbols we track
export const SUPPORTED_SYMBOLS = [
  'BTC/USD',
  'ETH/USD',
  'XRP/USD',
  'SOL/USD',
  'ADA/USD',
] as const;

export type SupportedSymbol = typeof SUPPORTED_SYMBOLS[number];

// Convert symbol to Kraken format
export function toKrakenSymbol(symbol: string): string {
  return symbol.replace('BTC', 'XBT').replace('/', '');
}

// Fetch candles from Supabase historical_candles table
export async function fetchCandlesFromDB(
  symbol: string,
  interval: string,
  limit: number = 100
): Promise<Candle[]> {
  const { data, error } = await supabase
    .from('historical_candles')
    .select('timestamp, open, high, low, close, volume')
    .eq('symbol', symbol)
    .eq('interval', interval)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching candles:', error);
    throw new Error(`Failed to fetch candles: ${error.message}`);
  }

  return (data || []).map(row => ({
    timestamp: Number(row.timestamp),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
  })).reverse(); // Oldest first for charting
}

// Fetch candles via edge function (fetches from Kraken and stores in DB)
export async function fetchAndStoreCandlesViaEdge(
  symbol: string,
  interval: string,
  since?: number
): Promise<{ count: number; last: number }> {
  const { data, error } = await supabase.functions.invoke('fetch-historical-data', {
    body: { symbol, interval, since }
  });

  if (error) {
    console.error('Edge function error:', error);
    throw new Error(`Failed to fetch candles: ${error.message}`);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return { count: data.count || 0, last: data.last || 0 };
}

// Fetch real-time ticker from Kraken public API (client-side, rate-limit friendly)
export async function fetchTickerFromKraken(symbol: string): Promise<Ticker> {
  const krakenSymbol = toKrakenSymbol(symbol);
  
  try {
    const response = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${krakenSymbol}`);
    const data = await response.json();

    if (data.error && data.error.length > 0) {
      throw new Error(data.error[0]);
    }

    const pairKey = Object.keys(data.result)[0];
    const tickerData = data.result[pairKey];

    return {
      symbol,
      price: parseFloat(tickerData.c[0]),
      bid: parseFloat(tickerData.b[0]),
      ask: parseFloat(tickerData.a[0]),
      volume24h: parseFloat(tickerData.v[1]),
      change24h: parseFloat(tickerData.p[1]) - parseFloat(tickerData.p[0]),
      high24h: parseFloat(tickerData.h[1]),
      low24h: parseFloat(tickerData.l[1]),
    };
  } catch (error) {
    console.error('Kraken ticker fetch error:', error);
    throw error;
  }
}

// Fetch multiple tickers at once
export async function fetchMultipleTickersFromKraken(symbols: string[]): Promise<Ticker[]> {
  const krakenSymbols = symbols.map(toKrakenSymbol).join(',');
  
  try {
    const response = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${krakenSymbols}`);
    const data = await response.json();

    if (data.error && data.error.length > 0) {
      throw new Error(data.error[0]);
    }

    const tickers: Ticker[] = [];
    
    for (const symbol of symbols) {
      const krakenSymbol = toKrakenSymbol(symbol);
      // Kraken returns various pair naming conventions
      const pairKey = Object.keys(data.result).find(
        key => key.replace('X', '').replace('Z', '').includes(krakenSymbol.replace('X', '').replace('Z', ''))
      );
      
      if (pairKey && data.result[pairKey]) {
        const tickerData = data.result[pairKey];
        const openPrice = parseFloat(tickerData.o);
        const currentPrice = parseFloat(tickerData.c[0]);
        const change = currentPrice - openPrice;
        const changePercent = openPrice > 0 ? (change / openPrice) * 100 : 0;
        
        tickers.push({
          symbol,
          price: currentPrice,
          bid: parseFloat(tickerData.b[0]),
          ask: parseFloat(tickerData.a[0]),
          volume24h: parseFloat(tickerData.v[1]),
          change24h: changePercent,
          high24h: parseFloat(tickerData.h[1]),
          low24h: parseFloat(tickerData.l[1]),
        });
      }
    }

    return tickers;
  } catch (error) {
    console.error('Kraken multi-ticker fetch error:', error);
    throw error;
  }
}

// Interval mapping
export const INTERVAL_OPTIONS = [
  { label: '1m', value: '1m', krakenMinutes: 1 },
  { label: '5m', value: '5m', krakenMinutes: 5 },
  { label: '15m', value: '15m', krakenMinutes: 15 },
  { label: '1H', value: '1h', krakenMinutes: 60 },
  { label: '4H', value: '4h', krakenMinutes: 240 },
  { label: '1D', value: '1d', krakenMinutes: 1440 },
] as const;
