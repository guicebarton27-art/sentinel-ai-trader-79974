import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from "recharts";
import { 
  CandlestickChart, 
  TrendingUp, 
  TrendingDown, 
  Radio, 
  Zap,
  Target,
  ShieldAlert,
  ArrowUpCircle,
  ArrowDownCircle,
  Activity,
  Eye
} from "lucide-react";
import { useTicker, useCandles } from "@/hooks/useMarketData";

interface Candle {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Trade {
  id: string;
  time: number;
  price: number;
  side: "buy" | "sell";
  size: number;
  pnl?: number;
}

interface Position {
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  side: "buy" | "sell";
  size: number;
  unrealizedPnl: number;
}

// Custom candlestick shape for Recharts
const CandlestickShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  
  const { open, close, high, low } = payload;
  const isUp = close >= open;
  const color = isUp ? "#22c55e" : "#ef4444";
  
  const candleWidth = Math.max(width * 0.6, 4);
  const candleX = x + (width - candleWidth) / 2;
  
  // Calculate positions
  const priceRange = high - low;
  if (priceRange === 0) return null;
  
  const scale = height / priceRange;
  const bodyTop = Math.min(open, close);
  const bodyBottom = Math.max(open, close);
  const bodyHeight = Math.max((bodyBottom - bodyTop) * scale, 1);
  const bodyY = y + (high - bodyBottom) * scale;
  
  const wickX = x + width / 2;
  const wickTop = y;
  const wickBottom = y + height;
  
  return (
    <g>
      {/* Wick */}
      <line
        x1={wickX}
        y1={wickTop}
        x2={wickX}
        y2={wickBottom}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body */}
      <rect
        x={candleX}
        y={bodyY}
        width={candleWidth}
        height={bodyHeight}
        fill={isUp ? color : color}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
};

interface LiveCandleChartProps {
  realPositions?: Array<{
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    status: string;
    quantity: number;
    entry_price: number;
    current_price?: number | null;
    stop_loss_price?: number | null;
    take_profit_price?: number | null;
    unrealized_pnl?: number | null;
  }>;
  realOrders?: Array<{
    id: string;
    symbol: string;
    side: string;
    status: string;
    quantity: number;
    average_fill_price?: number | null;
    created_at: string;
  }>;
}

export const LiveCandleChart = ({ realPositions = [], realOrders = [] }: LiveCandleChartProps) => {
  const [timeframe, setTimeframe] = useState("1h");
  const [isLive, setIsLive] = useState(true);
  const [lastSignal, setLastSignal] = useState<{ action: string; confidence: number } | null>(null);
  
  // Use real market data hooks
  const { ticker, loading: tickerLoading } = useTicker({ symbol: 'BTC/USD', refreshInterval: 5000 });
  const { candles: dbCandles, loading: candlesLoading, refetchFromExchange } = useCandles({
    symbol: 'BTC/USD',
    interval: timeframe,
    autoFetch: true,
    limit: 60
  });
  
  // Transform DB candles to chart format
  const candles: Candle[] = useMemo(() => {
    if (dbCandles.length === 0) return [];
    return dbCandles.map(c => ({
      time: new Date(c.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: c.timestamp * 1000,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    }));
  }, [dbCandles]);
  
  // Use real ticker price
  const currentPrice = ticker?.price || (candles.length > 0 ? candles[candles.length - 1]?.close : 0);
  const priceChange = ticker?.change24h || 0;
  
  // Convert real positions to display format
  const openRealPosition = realPositions.find(p => p.status === 'open');
  const position: Position | null = openRealPosition ? {
    entryPrice: openRealPosition.entry_price,
    stopLoss: openRealPosition.stop_loss_price || openRealPosition.entry_price * 0.98,
    takeProfit: openRealPosition.take_profit_price || openRealPosition.entry_price * 1.03,
    side: openRealPosition.side,
    size: openRealPosition.quantity,
    unrealizedPnl: openRealPosition.unrealized_pnl || 0
  } : null;
  
  // Convert real orders to trades format
  const trades: Trade[] = realOrders
    .filter(o => o.status === 'filled' && o.average_fill_price)
    .slice(0, 10)
    .map(o => ({
      id: o.id,
      time: new Date(o.created_at).getTime(),
      price: o.average_fill_price!,
      side: o.side as 'buy' | 'sell',
      size: o.quantity,
      pnl: undefined
    }));
  
  const hasRealData = realPositions.length > 0 || realOrders.length > 0 || candles.length > 0;

  // Generate AI signals based on real price movement (no Math.random simulation)
  useEffect(() => {
    if (!ticker || candles.length < 10) return;
    
    // Calculate signal based on real data
    const recentCandles = candles.slice(-10);
    const avgPrice = recentCandles.reduce((sum, c) => sum + c.close, 0) / recentCandles.length;
    const priceTrend = (currentPrice - avgPrice) / avgPrice * 100;
    
    // Only generate signal if there's meaningful movement
    if (Math.abs(priceTrend) > 0.3) {
      const action = priceTrend > 0.5 ? "BUY" : priceTrend < -0.5 ? "SELL" : "HOLD";
      const confidence = Math.min(90, 50 + Math.abs(priceTrend) * 10);
      setLastSignal({ action, confidence: Math.round(confidence) });
    }
  }, [ticker, candles, currentPrice]);

  // Calculate chart data for candlesticks
  const chartData = useMemo(() => {
    return candles.map(c => ({
      ...c,
      range: [c.low, c.high],
      body: [Math.min(c.open, c.close), Math.max(c.open, c.close)]
    }));
  }, [candles]);

  const priceRange = useMemo(() => {
    if (candles.length === 0) return { min: 94000, max: 96000 };
    const prices = candles.flatMap(c => [c.high, c.low]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1;
    return { min: min - padding, max: max + padding };
  }, [candles]);

  const loading = tickerLoading || candlesLoading;

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <CardHeader className="relative pb-2">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent">
              <CandlestickChart className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                BTC/USD
                <Badge variant="outline" className="gap-1 text-xs bg-success/10 text-success border-success/30">
                  <Radio className="h-3 w-3 animate-pulse" />
                  LIVE
                </Badge>
                {hasRealData ? (
                  <Badge variant="outline" className="gap-1 text-xs bg-primary/10 text-primary border-primary/30">
                    Kraken API
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-xs bg-warning/10 text-warning border-warning/30">
                    Loading...
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-2xl font-bold font-mono">
                  {loading ? '...' : `$${currentPrice.toFixed(2)}`}
                </span>
                <Badge className={priceChange >= 0 ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}>
                  {priceChange >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                  {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                </Badge>
              </div>
            </div>
          </div>

          {/* AI Signal Indicator */}
          {lastSignal && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all animate-in fade-in-50 ${
              lastSignal.action === "BUY" ? "bg-success/10 border-success/50 text-success" :
              lastSignal.action === "SELL" ? "bg-destructive/10 border-destructive/50 text-destructive" :
              "bg-muted/10 border-muted/50 text-muted-foreground"
            }`}>
              <Zap className="h-4 w-4 animate-pulse" />
              <span className="font-bold">{lastSignal.action}</span>
              <Badge variant="outline" className="text-xs">{lastSignal.confidence}%</Badge>
            </div>
          )}

          {/* Timeframe buttons */}
          <div className="flex gap-1">
            {["1m", "5m", "15m", "1h", "4h", "1d"].map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? "default" : "outline"}
                size="sm"
                className="text-xs px-3"
                onClick={() => setTimeframe(tf === "1m" ? "1" : tf === "5m" ? "5" : tf === "15m" ? "15" : tf === "1h" ? "60" : tf === "4h" ? "240" : "1440")}
              >
                {tf.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        {/* Candlestick Chart */}
        <div className="h-[350px] w-full rounded-xl overflow-hidden border border-border/50 bg-secondary/10 p-2">
          {loading && candles.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Activity className="h-5 w-5 animate-spin mr-2" />
              Loading market data...
            </div>
          ) : candles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <p>No candle data available</p>
              <Button size="sm" onClick={refetchFromExchange}>
                Fetch from Kraken
              </Button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={{ stroke: 'rgba(139, 92, 246, 0.2)' }}
                  tickLine={{ stroke: 'rgba(139, 92, 246, 0.2)' }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  domain={[priceRange.min, priceRange.max]}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={{ stroke: 'rgba(139, 92, 246, 0.2)' }}
                  tickLine={{ stroke: 'rgba(139, 92, 246, 0.2)' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'range') return null;
                    return [`$${value.toFixed(2)}`, name.charAt(0).toUpperCase() + name.slice(1)];
                  }}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                
                {/* Position lines */}
                {position && (
                  <>
                    <ReferenceLine 
                      y={position.entryPrice} 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={{ value: 'Entry', fill: '#3b82f6', fontSize: 10 }}
                    />
                    <ReferenceLine 
                      y={position.stopLoss} 
                      stroke="#ef4444" 
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      label={{ value: 'SL', fill: '#ef4444', fontSize: 10 }}
                    />
                    <ReferenceLine 
                      y={position.takeProfit} 
                      stroke="#22c55e" 
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      label={{ value: 'TP', fill: '#22c55e', fontSize: 10 }}
                    />
                  </>
                )}
                
                {/* Candlesticks as bars */}
                <Bar dataKey="high" shape={<CandlestickShape />} isAnimationActive={false}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.close >= entry.open ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Position Panel */}
        {position && (
          <div className={`p-4 rounded-xl border-2 animate-in slide-in-from-top-2 ${
            position.side === "buy" ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                {position.side === "buy" ? (
                  <ArrowUpCircle className="h-8 w-8 text-success animate-pulse" />
                ) : (
                  <ArrowDownCircle className="h-8 w-8 text-destructive animate-pulse" />
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Active Position</p>
                  <p className="text-lg font-bold">{position.side.toUpperCase()} {position.size.toFixed(4)} BTC</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Entry</p>
                  <p className="font-mono font-bold">${position.entryPrice.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <ShieldAlert className="h-3 w-3 text-destructive" /> SL
                  </p>
                  <p className="font-mono font-bold text-destructive">${position.stopLoss.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Target className="h-3 w-3 text-success" /> TP
                  </p>
                  <p className="font-mono font-bold text-success">${position.takeProfit.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">P&L</p>
                  <p className={`font-mono font-bold ${position.unrealizedPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {position.unrealizedPnl >= 0 ? '+' : ''}${position.unrealizedPnl.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Trades from DB */}
        {trades.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4 text-primary" />
              Recent AI Trades
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {trades.slice(0, 4).map((trade) => (
                <div 
                  key={trade.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    trade.side === 'buy' 
                      ? 'bg-success/5 border-success/20' 
                      : 'bg-destructive/5 border-destructive/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {trade.side === 'buy' ? (
                      <ArrowUpCircle className="h-4 w-4 text-success" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 text-destructive" />
                    )}
                    <div>
                      <span className="font-medium text-sm">{trade.side.toUpperCase()}</span>
                      <span className="text-xs text-muted-foreground ml-2">{trade.size.toFixed(4)} BTC</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">${trade.price.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(trade.time).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Status */}
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${isLive ? 'bg-success/10' : 'bg-muted'}`}>
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
              <span className="text-xs font-medium">{isLive ? 'Live Data' : 'Paused'}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" />
              Kraken API • {timeframe}
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsLive(!isLive)}
            className="gap-2"
          >
            {isLive ? (
              <>
                <div className="w-2 h-2 rounded-full bg-success" />
                Streaming
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                Paused
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
