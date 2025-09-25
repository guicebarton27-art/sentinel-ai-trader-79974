import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Zap, 
  Activity, 
  Globe, 
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface Venue {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'degraded';
  latency: number;
  liquidity: number;
  fees: {
    maker: number;
    taker: number;
  };
  volume24h: number;
  orderbook: {
    bid: number;
    ask: number;
    spread: number;
  };
  allocated: number;
  trades: number;
}

const venues: Venue[] = [
  {
    id: 'kraken',
    name: 'Kraken Pro',
    status: 'online',
    latency: 12,
    liquidity: 95,
    fees: { maker: 0.16, taker: 0.26 },
    volume24h: 125840000,
    orderbook: { bid: 43256.50, ask: 43258.75, spread: 2.25 },
    allocated: 45,
    trades: 156
  },
  {
    id: 'binance',
    name: 'Binance',
    status: 'online',
    latency: 8,
    liquidity: 98,
    fees: { maker: 0.10, taker: 0.10 },
    volume24h: 289450000,
    orderbook: { bid: 43257.25, ask: 43259.10, spread: 1.85 },
    allocated: 35,
    trades: 89
  },
  {
    id: 'coinbase',
    name: 'Coinbase Pro',
    status: 'degraded',
    latency: 25,
    liquidity: 78,
    fees: { maker: 0.50, taker: 0.50 },
    volume24h: 98760000,
    orderbook: { bid: 43255.10, ask: 43260.50, spread: 5.40 },
    allocated: 20,
    trades: 34
  }
];

interface ExecutionMetrics {
  totalOrders: number;
  fillRate: number;
  avgSlippage: number;
  avgLatency: number;
  smartRouting: boolean;
  liquidityAggregation: boolean;
}

const executionMetrics: ExecutionMetrics = {
  totalOrders: 279,
  fillRate: 98.2,
  avgSlippage: 0.08,
  avgLatency: 11.3,
  smartRouting: true,
  liquidityAggregation: true
};

const getStatusIcon = (status: Venue['status']) => {
  switch (status) {
    case 'online': return <Wifi className="h-4 w-4 text-success" />;
    case 'offline': return <WifiOff className="h-4 w-4 text-error" />;
    case 'degraded': return <AlertCircle className="h-4 w-4 text-warning" />;
  }
};

const getStatusColor = (status: Venue['status']) => {
  switch (status) {
    case 'online': return 'bg-success text-success-foreground';
    case 'offline': return 'bg-error text-error-foreground';
    case 'degraded': return 'bg-warning text-warning-foreground';
  }
};

const getLatencyColor = (latency: number) => {
  if (latency < 15) return 'text-success';
  if (latency < 30) return 'text-warning';
  return 'text-error';
};

export const ExecutionRouter = () => {
  const onlineVenues = venues.filter(v => v.status === 'online').length;
  const totalAllocation = venues.reduce((sum, v) => sum + v.allocated, 0);
  const avgLatency = venues.reduce((sum, v) => sum + v.latency, 0) / venues.length;

  return (
    <div className="space-y-6">
      {/* Execution Overview */}
      <Card className="shadow-quant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-execution" />
            Execution Router
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold text-execution">{onlineVenues}/{venues.length}</p>
              <p className="text-sm text-muted-foreground">Venues Online</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold">{executionMetrics.fillRate}%</p>
              <p className="text-sm text-muted-foreground">Fill Rate</p>
            </div>
            <div className="text-center space-y-1">
              <p className={`text-2xl font-bold ${getLatencyColor(avgLatency)}`}>{avgLatency.toFixed(1)}ms</p>
              <p className="text-sm text-muted-foreground">Avg Latency</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold text-success">{executionMetrics.avgSlippage.toFixed(3)}%</p>
              <p className="text-sm text-muted-foreground">Avg Slippage</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Venue Status */}
      <div className="grid gap-4">
        {venues.map((venue) => (
          <Card key={venue.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-algo-primary/10">
                    <Globe className="h-5 w-5 text-algo-primary" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{venue.name}</h3>
                      <Badge className={getStatusColor(venue.status)}>
                        {getStatusIcon(venue.status)}
                        {venue.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Exchange ID: {venue.id}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch checked={venue.status !== 'offline'} />
                  <Button size="sm" variant="outline">Configure</Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {/* Latency */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Latency</span>
                  </div>
                  <p className={`text-xl font-bold ${getLatencyColor(venue.latency)}`}>
                    {venue.latency}ms
                  </p>
                </div>

                {/* Liquidity */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Liquidity</span>
                  <div className="space-y-1">
                    <p className="text-xl font-bold">{venue.liquidity}%</p>
                    <Progress value={venue.liquidity} className="h-2" />
                  </div>
                </div>

                {/* Fees */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Fees</span>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Maker:</span>
                      <span className="font-medium">{venue.fees.maker}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Taker:</span>
                      <span className="font-medium">{venue.fees.taker}%</span>
                    </div>
                  </div>
                </div>

                {/* Order Book */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Order Book</span>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Bid:</span>
                      <span className="font-medium text-success">${venue.orderbook.bid.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ask:</span>
                      <span className="font-medium text-error">${venue.orderbook.ask.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Spread:</span>
                      <span className="font-medium">${venue.orderbook.spread}</span>
                    </div>
                  </div>
                </div>

                {/* Allocation & Performance */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Performance</span>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Allocation:</span>
                      <span className="font-medium">{venue.allocated}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Trades:</span>
                      <span className="font-medium">{venue.trades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Volume:</span>
                      <span className="font-medium">${(venue.volume24h / 1000000).toFixed(0)}M</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Execution Settings */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Smart Routing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">Smart Order Routing</p>
                <p className="text-sm text-muted-foreground">Automatically route to best venue</p>
              </div>
              <Switch checked={executionMetrics.smartRouting} />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">Liquidity Aggregation</p>
                <p className="text-sm text-muted-foreground">Combine order books for better fills</p>
              </div>
              <Switch checked={executionMetrics.liquidityAggregation} />
            </div>
            
            <Separator />
            
            <div className="space-y-3">
              <p className="font-medium">Routing Preferences</p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>Minimize fees</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span>Optimize latency</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span>Maximize liquidity</span>
                  <Switch />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Execution Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Orders</span>
                <span className="font-bold">{executionMetrics.totalOrders}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Fill Rate</span>
                <span className="font-bold text-success">{executionMetrics.fillRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Avg Slippage</span>
                <span className="font-bold">{executionMetrics.avgSlippage}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Avg Latency</span>
                <span className={`font-bold ${getLatencyColor(executionMetrics.avgLatency)}`}>
                  {executionMetrics.avgLatency}ms
                </span>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-3">
              <p className="font-medium">Recent Performance</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Last Hour</span>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-success" />
                    <span className="text-success">+2.3%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Last 24h</span>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-success" />
                    <span className="text-success">+8.7%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Last Week</span>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-error" />
                    <span className="text-error">-1.2%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};