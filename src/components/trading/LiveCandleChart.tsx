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
  const [candles, setCandles] = useState<Candle[]>([]);
  const [currentPrice, setCurrentPrice] = useState(95234.56);
  const [priceChange, setPriceChange] = useState(1.24);
  const [simulatedTrades, setSimulatedTrades] = useState<Trade[]>([]);
  const [simulatedPosition, setSimulatedPosition] = useState<Position | null>(null);
  const [timeframe, setTimeframe] = useState("1m");
  const [isLive, setIsLive] = useState(true);
  const [lastSignal, setLastSignal] = useState<{ action: string; confidence: number } | null>(null);
  
  // Convert real positions to display format
  const openRealPosition = realPositions.find(p => p.status === 'open');
  const position: Position | null = openRealPosition ? {
    entryPrice: openRealPosition.entry_price,
    stopLoss: openRealPosition.stop_loss_price || openRealPosition.entry_price * 0.98,
    takeProfit: openRealPosition.take_profit_price || openRealPosition.entry_price * 1.03,
    side: openRealPosition.side,
    size: openRealPosition.quantity,
    unrealizedPnl: openRealPosition.unrealized_pnl || 0
  } : simulatedPosition;
  
  // Convert real orders to trades format
  const realTrades: Trade[] = realOrders
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
  
  const trades = realTrades.length > 0 ? realTrades : simulatedTrades;
  const hasRealData = realPositions.length > 0 || realOrders.length > 0;

  // Generate initial candle data
  useEffect(() => {
    const generateCandles = (): Candle[] => {
      const data: Candle[] = [];
      let price = 95000;
      const now = Date.now();
      
      for (let i = 60; i >= 0; i--) {
        const volatility = 0.002 + Math.random() * 0.003;
        const trend = Math.sin((60 - i) / 10) * 0.001;
        const change = (Math.random() - 0.5) * 2 * volatility + trend;
        
        const open = price;
        const close = price * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * 0.001);
        const low = Math.min(open, close) * (1 - Math.random() * 0.001);
        
        const timestamp = now - i * 60000;
        data.push({
          time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp,
          open,
          high,
          low,
          close,
          volume: Math.random() * 100 + 50
        });
        
        price = close;
      }
      
      return data;
    };
    
    setCandles(generateCandles());
  }, []);

  // Live updates
  useEffect(() => {
    if (!isLive || candles.length === 0) return;

    const interval = setInterval(() => {
      setCandles(prev => {
        if (prev.length === 0) return prev;
        
        const lastCandle = prev[prev.length - 1];
        const volatility = 0.001 + Math.random() * 0.002;
        const change = (Math.random() - 0.5) * 2 * volatility;
        
        const newClose = lastCandle.close * (1 + change);
        const newHigh = Math.max(lastCandle.high, newClose);
        const newLow = Math.min(lastCandle.low, newClose);
        
        setCurrentPrice(newClose);
        setPriceChange(p => p + (Math.random() - 0.5) * 0.05);
        
        // Create new minute candle every ~10 updates
        if (Math.random() > 0.9) {
          const now = Date.now();
          const newCandle: Candle = {
            time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: now,
            open: newClose,
            high: newClose * 1.001,
            low: newClose * 0.999,
            close: newClose,
            volume: Math.random() * 100 + 50
          };
          return [...prev.slice(1), newCandle];
        }
        
        // Update last candle
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...lastCandle,
          high: newHigh,
          low: newLow,
          close: newClose
        };
        return updated;
      });

      // Simulate AI signals
      if (Math.random() > 0.92) {
        const actions = ["BUY", "SELL", "HOLD"];
        setLastSignal({
          action: actions[Math.floor(Math.random() * actions.length)],
          confidence: 60 + Math.floor(Math.random() * 35)
        });
      }

      // Only simulate trades/positions if we don't have real data
      if (!hasRealData) {
        // Simulate trades
        if (Math.random() > 0.97) {
          const side = Math.random() > 0.5 ? "buy" : "sell";
          setSimulatedTrades(prev => [{
            id: crypto.randomUUID(),
            time: Date.now(),
            price: currentPrice,
            side,
            size: 0.01 + Math.random() * 0.05,
            pnl: (Math.random() - 0.4) * 500
          }, ...prev.slice(0, 9)]);
        }

        // Simulate position updates
        if (Math.random() > 0.96 && !simulatedPosition) {
          const side = Math.random() > 0.5 ? "buy" : "sell";
          setSimulatedPosition({
            entryPrice: currentPrice,
            stopLoss: side === "buy" ? currentPrice * 0.98 : currentPrice * 1.02,
            takeProfit: side === "buy" ? currentPrice * 1.03 : currentPrice * 0.97,
            side,
            size: 0.05,
            unrealizedPnl: 0
          });
        } else if (simulatedPosition) {
          const pnl = simulatedPosition.side === "buy"
            ? (currentPrice - simulatedPosition.entryPrice) * simulatedPosition.size * 1000
            : (simulatedPosition.entryPrice - currentPrice) * simulatedPosition.size * 1000;
          
          setSimulatedPosition(prev => prev ? { ...prev, unrealizedPnl: pnl } : null);

          // Close position randomly
          if (Math.random() > 0.992) {
            setSimulatedTrades(prev => [{
              id: crypto.randomUUID(),
              time: Date.now(),
              price: currentPrice,
              side: simulatedPosition.side === "buy" ? "sell" : "buy",
              size: simulatedPosition.size,
              pnl: simulatedPosition.unrealizedPnl
            }, ...prev.slice(0, 9)]);
            setSimulatedPosition(null);
          }
        }
      }
    }, 800);

    return () => clearInterval(interval);
  }, [isLive, candles.length, simulatedPosition, currentPrice, hasRealData]);

  // Calculate chart data for candlesticks
  const chartData = useMemo(() => {
    return candles.map(c => ({
      ...c,
      // For the bar chart visualization
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
                    DB Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-xs bg-warning/10 text-warning border-warning/30">
                    Demo Mode
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-2xl font-bold font-mono">${currentPrice.toFixed(2)}</span>
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
                onClick={() => setTimeframe(tf)}
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
                  <p className="font-mono font-semibold text-primary">${position.entryPrice.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <ShieldAlert className="h-3 w-3 text-destructive" /> Stop
                  </p>
                  <p className="font-mono font-semibold text-destructive">${position.stopLoss.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Target className="h-3 w-3 text-success" /> Target
                  </p>
                  <p className="font-mono font-semibold text-success">${position.takeProfit.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">P&L</p>
                  <p className={`font-mono font-bold text-lg ${position.unrealizedPnl >= 0 ? "text-success" : "text-destructive"}`}>
                    {position.unrealizedPnl >= 0 ? "+" : ""}${position.unrealizedPnl.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Trades */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">AI Trade Executions</span>
            <Badge variant="secondary" className="text-xs">{trades.length}</Badge>
          </div>
          
          {trades.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {trades.slice(0, 5).map((trade) => (
                <div
                  key={trade.id}
                  className={`p-3 rounded-lg border transition-all animate-in slide-in-from-left-2 ${
                    trade.side === "buy" 
                      ? "bg-success/5 border-success/30" 
                      : "bg-destructive/5 border-destructive/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge className={trade.side === "buy" ? "bg-success text-white" : "bg-destructive text-white"}>
                      {trade.side.toUpperCase()}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(trade.time).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs font-mono">${trade.price.toFixed(2)}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">{trade.size.toFixed(4)} BTC</span>
                    {trade.pnl !== undefined && (
                      <span className={`text-xs font-semibold ${trade.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                        {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Waiting for AI to execute trades...
            </div>
          )}
        </div>

        {/* Live indicator */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-xs">AI: <span className="text-success font-semibold">Active</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-warning" />
              <span className="text-xs">Latency: <span className="font-semibold">12ms</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              <span className="text-xs">Signals: <span className="font-semibold">847</span></span>
            </div>
          </div>
          <Button
            variant={isLive ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setIsLive(!isLive)}
          >
            <Radio className={`h-3 w-3 ${isLive ? "animate-pulse" : ""}`} />
            {isLive ? "LIVE" : "PAUSED"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
