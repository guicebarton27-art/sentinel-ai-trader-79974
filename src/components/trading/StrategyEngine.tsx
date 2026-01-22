import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Brain,
  TrendingUp,
  BarChart3,
  Zap,
  Target,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Play,
  Pause
} from 'lucide-react';

interface Strategy {
  id: string;
  name: string;
  type: 'trend' | 'breakout' | 'mean-revert' | 'automl' | 'rl';
  status: 'active' | 'paused' | 'training' | 'disabled';
  allocation: number;
  performance: {
    sharpe: number;
    sortino: number;
    drawdown: number;
    alpha: number;
  };
  metrics: {
    trades: number;
    winRate: number;
    avgReturn: number;
  };
  profitability: {
    edgeScore: number;
    feeDragBps: number;
    turnover: number;
  };
}

const strategies: Strategy[] = [
  {
    id: 'trend-001',
    name: 'Momentum Alpha',
    type: 'trend',
    status: 'active',
    allocation: 35,
    performance: { sharpe: 1.85, sortino: 2.12, drawdown: -8.5, alpha: 12.3 },
    metrics: { trades: 156, winRate: 68.2, avgReturn: 2.4 },
    profitability: { edgeScore: 82, feeDragBps: 12, turnover: 1.8 },
  },
  {
    id: 'breakout-002',
    name: 'Volatility Breakout',
    type: 'breakout',
    status: 'active',
    allocation: 25,
    performance: { sharpe: 1.62, sortino: 1.89, drawdown: -12.1, alpha: 8.7 },
    metrics: { trades: 89, winRate: 72.1, avgReturn: 3.1 },
    profitability: { edgeScore: 74, feeDragBps: 16, turnover: 2.4 },
  },
  {
    id: 'mean-003',
    name: 'Mean Reversion Pro',
    type: 'mean-revert',
    status: 'paused',
    allocation: 20,
    performance: { sharpe: 1.23, sortino: 1.45, drawdown: -15.3, alpha: 4.2 },
    metrics: { trades: 234, winRate: 64.5, avgReturn: 1.8 },
    profitability: { edgeScore: 61, feeDragBps: 18, turnover: 3.1 },
  },
  {
    id: 'automl-004',
    name: 'AutoML Genesis',
    type: 'automl',
    status: 'training',
    allocation: 15,
    performance: { sharpe: 0.95, sortino: 1.12, drawdown: -22.1, alpha: 2.1 },
    metrics: { trades: 45, winRate: 58.9, avgReturn: 1.2 },
    profitability: { edgeScore: 55, feeDragBps: 21, turnover: 1.2 },
  },
  {
    id: 'rl-005',
    name: 'RL Adaptive',
    type: 'rl',
    status: 'active',
    allocation: 5,
    performance: { sharpe: 2.45, sortino: 2.89, drawdown: -5.2, alpha: 18.9 },
    metrics: { trades: 67, winRate: 79.1, avgReturn: 4.2 },
    profitability: { edgeScore: 91, feeDragBps: 9, turnover: 1.4 },
  }
];

const getStrategyIcon = (type: Strategy['type']) => {
  switch (type) {
    case 'trend': return TrendingUp;
    case 'breakout': return BarChart3;
    case 'mean-revert': return Target;
    case 'automl': return Brain;
    case 'rl': return Zap;
    default: return Activity;
  }
};

const getStatusColor = (status: Strategy['status']) => {
  switch (status) {
    case 'active': return 'bg-execution text-white';
    case 'paused': return 'bg-warning text-warning-foreground';
    case 'training': return 'bg-algo-primary text-white';
    case 'disabled': return 'bg-neutral text-white';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getPerformanceIcon = (value: number) => {
  if (value > 0) return <ArrowUpRight className="h-3 w-3 text-success" />;
  if (value < 0) return <ArrowDownRight className="h-3 w-3 text-error" />;
  return <Minus className="h-3 w-3 text-neutral" />;
};

export const StrategyEngine = () => {
  const totalAllocation = strategies.reduce((sum, s) => sum + s.allocation, 0);
  const activeStrategies = strategies.filter(s => s.status === 'active').length;
  const avgEdgeScore = strategies.reduce((sum, s) => sum + s.profitability.edgeScore, 0) / strategies.length;
  const avgFeeDrag = strategies.reduce((sum, s) => sum + s.profitability.feeDragBps, 0) / strategies.length;

  return (
    <div className="space-y-6">
      {/* Engine Overview */}
      <Card className="shadow-quant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-algo-primary" />
            Strategy Engine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold text-algo-primary">{activeStrategies}</p>
              <p className="text-sm text-muted-foreground">Active Strategies</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold">{totalAllocation}%</p>
              <p className="text-sm text-muted-foreground">Capital Allocated</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold text-success">1.68</p>
              <p className="text-sm text-muted-foreground">Avg Sharpe</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold text-execution">{avgEdgeScore.toFixed(0)}</p>
              <p className="text-sm text-muted-foreground">Edge Score</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2">
              <span>Avg fee drag</span>
              <span className="font-medium text-foreground">{avgFeeDrag.toFixed(1)} bps</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2">
              <span>Execution mix</span>
              <span className="font-medium text-foreground">68% maker</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2">
              <span>Capacity utilization</span>
              <span className="font-medium text-foreground">84%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategy List */}
      <div className="grid gap-4">
        {strategies.map((strategy) => {
          const Icon = getStrategyIcon(strategy.type);
          return (
            <Card key={strategy.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-algo-primary/10">
                      <Icon className="h-5 w-5 text-algo-primary" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{strategy.name}</h3>
                        <Badge className={getStatusColor(strategy.status)}>
                          {strategy.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground capitalize">{strategy.type.replace('-', ' ')}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost">
                      {strategy.status === 'active' ? 
                        <Pause className="h-4 w-4" /> : 
                        <Play className="h-4 w-4" />
                      }
                    </Button>
                    <Switch checked={strategy.status === 'active'} />
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  {/* Allocation */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Allocation</span>
                      <span className="font-medium">{strategy.allocation}%</span>
                    </div>
                    <Progress value={strategy.allocation} className="h-2" />
                  </div>

                  {/* Performance Metrics */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Performance</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span>Sharpe:</span>
                        <span className="flex items-center gap-1 font-medium">
                          {getPerformanceIcon(strategy.performance.sharpe)}
                          {strategy.performance.sharpe.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Sortino:</span>
                        <span className="flex items-center gap-1 font-medium">
                          {getPerformanceIcon(strategy.performance.sortino)}
                          {strategy.performance.sortino.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>DD:</span>
                        <span className="flex items-center gap-1 font-medium text-error">
                          {strategy.performance.drawdown.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Alpha:</span>
                        <span className="flex items-center gap-1 font-medium">
                          {getPerformanceIcon(strategy.performance.alpha)}
                          {strategy.performance.alpha.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Trading Metrics */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Trading</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Trades:</span>
                        <span className="font-medium">{strategy.metrics.trades}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Win Rate:</span>
                        <span className="font-medium text-success">{strategy.metrics.winRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Return:</span>
                        <span className="font-medium">{strategy.metrics.avgReturn}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Profitability Metrics */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Profitability</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Edge Score:</span>
                        <span className="font-medium">{strategy.profitability.edgeScore}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fee Drag:</span>
                        <span className="font-medium">{strategy.profitability.feeDragBps} bps</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Turnover:</span>
                        <span className="font-medium">{strategy.profitability.turnover}x</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Actions</p>
                    <div className="space-y-1">
                      <Button size="sm" variant="outline" className="w-full text-xs">
                        <Activity className="h-3 w-3 mr-1" />
                        Details
                      </Button>
                      <Button size="sm" variant="outline" className="w-full text-xs">
                        Optimize
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
