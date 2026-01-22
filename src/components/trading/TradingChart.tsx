import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Calendar, BarChart3, RefreshCw, AlertCircle } from 'lucide-react';
import { useChartData } from '@/hooks/useMarketData';
import { INTERVAL_OPTIONS } from '@/services/marketDataService';

interface TradingChartProps {
  symbol?: string;
}

export const TradingChart = ({ symbol = 'BTC/USD' }: TradingChartProps) => {
  const [interval, setInterval] = useState('1h');
  
  const { candles, ticker, loading, error, refetchFromExchange, hasData } = useChartData(symbol, interval);

  // Format candles for chart display
  const chartData = useMemo(() => {
    return candles.map(candle => ({
      time: new Date(candle.timestamp * 1000).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      price: candle.close,
      volume: candle.volume,
      timestamp: candle.timestamp,
    }));
  }, [candles]);

  // Calculate price change
  const priceChange = useMemo(() => {
    if (candles.length < 2) return { value: 0, percent: 0 };
    const firstPrice = candles[0].open;
    const lastPrice = candles[candles.length - 1].close;
    const change = lastPrice - firstPrice;
    const percent = firstPrice > 0 ? (change / firstPrice) * 100 : 0;
    return { value: change, percent };
  }, [candles]);

  // Current price from ticker or last candle
  const currentPrice = ticker?.price ?? candles[candles.length - 1]?.close ?? 0;
  const isPositive = priceChange.value >= 0;

  if (loading && !hasData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {symbol}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-80 w-full" />
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-8 w-12" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {symbol}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-80 gap-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground text-center">
              Failed to load market data
              <br />
              <span className="text-sm">{error}</span>
            </p>
            <Button onClick={() => refetchFromExchange()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If no data, show fetch prompt
  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {symbol}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-80 gap-4">
            <BarChart3 className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground text-center">
              No historical data available
              <br />
              <span className="text-sm">Fetch data from exchange to view chart</span>
            </p>
            <Button onClick={() => refetchFromExchange()} disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Fetch Historical Data
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {symbol}
            {ticker && (
              <Badge variant="outline" className="ml-2 text-xs">
                Live
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant={isPositive ? 'default' : 'destructive'} 
              className="flex items-center gap-1"
            >
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {isPositive ? '+' : ''}{priceChange.percent.toFixed(2)}%
            </Badge>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetchFromExchange()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Price Info */}
          <div className="flex items-baseline gap-4">
            <span className="text-3xl font-bold font-mono">
              ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`font-medium ${isPositive ? 'text-success' : 'text-destructive'}`}>
              {isPositive ? '+' : ''}${Math.abs(priceChange.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Chart */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="time" 
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  className="text-xs fill-muted-foreground"
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                  tick={{ fontSize: 10 }}
                  width={80}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))'
                  }}
                  formatter={(value: number, name: string) => [
                    name === 'price' ? `$${value.toLocaleString()}` : value.toLocaleString(),
                    name === 'price' ? 'Price' : 'Volume'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Time Frame Buttons */}
          <div className="flex gap-2">
            {INTERVAL_OPTIONS.map((opt) => (
              <Button 
                key={opt.value} 
                variant={interval === opt.value ? 'default' : 'outline'} 
                size="sm"
                className="text-xs"
                onClick={() => setInterval(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
