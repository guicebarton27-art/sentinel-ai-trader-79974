import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
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
  Pause,
  RefreshCw
} from 'lucide-react';

interface Strategy {
  id: string;
  name: string;
  type: 'trend' | 'breakout' | 'mean-revert' | 'automl' | 'rl';
  status: 'active' | 'paused' | 'training' | 'disabled' | 'stopped';
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
}

// Map deployed_strategies status to UI status
function mapStatus(status: string): Strategy['status'] {
  switch (status) {
    case 'active':
    case 'paper':
      return 'active';
    case 'paused':
      return 'paused';
    case 'training':
      return 'training';
    case 'stopped':
    case 'disabled':
    default:
      return 'disabled';
  }
}

// Infer strategy type from name or config
function inferType(name: string, config: Record<string, unknown>): Strategy['type'] {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('automl')) return 'automl';
  if (nameLower.includes('rl') || nameLower.includes('reinforcement')) return 'rl';
  if (nameLower.includes('breakout') || config.breakoutThreshold) return 'breakout';
  if (nameLower.includes('mean') || config.meanRevWeight) return 'mean-revert';
  return 'trend';
}

const getStrategyIcon = (type: Strategy['type']) => {
  switch (type) {
    case 'trend': return TrendingUp;
    case 'breakout': return BarChart3;
    case 'mean-revert': return Target;
    case 'automl': return Brain;
    case 'rl': return Zap;
  }
};

const getStatusColor = (status: Strategy['status']) => {
  switch (status) {
    case 'active': return 'bg-execution text-white';
    case 'paused': return 'bg-warning text-warning-foreground';
    case 'training': return 'bg-algo-primary text-white';
    case 'disabled':
    case 'stopped':
    default: return 'bg-neutral text-white';
  }
};

const getPerformanceIcon = (value: number) => {
  if (value > 0) return <ArrowUpRight className="h-3 w-3 text-success" />;
  if (value < 0) return <ArrowDownRight className="h-3 w-3 text-error" />;
  return <Minus className="h-3 w-3 text-neutral" />;
};

export const StrategyEngine = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategies = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStrategies([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('deployed_strategies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Transform database records to UI format
      const transformedStrategies: Strategy[] = (data || []).map((s, index) => {
        const config = (s.strategy_config || {}) as Record<string, unknown>;
        const metrics = (s.performance_metrics || {}) as Record<string, number>;
        
        return {
          id: s.id,
          name: s.name,
          type: inferType(s.name, config),
          status: mapStatus(s.status),
          allocation: Math.max(5, 100 / Math.max(1, (data?.length || 1)) - index * 5),
          performance: {
            sharpe: metrics.sharpeRatio || 0,
            sortino: (metrics.sharpeRatio || 0) * 1.1, // Estimate if not available
            drawdown: -(metrics.maxDrawdown || 0),
            alpha: metrics.totalReturn || 0,
          },
          metrics: {
            trades: metrics.totalTrades || s.total_signals || 0,
            winRate: metrics.winRate || 0,
            avgReturn: (metrics.totalReturn || 0) / Math.max(1, metrics.totalTrades || 1),
          },
        };
      });

      setStrategies(transformedStrategies);
    } catch (err) {
      console.error('Error fetching strategies:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategies();
  }, []);

  const totalAllocation = strategies.reduce((sum, s) => sum + s.allocation, 0);
  const activeStrategies = strategies.filter(s => s.status === 'active').length;
  const avgSharpe = strategies.length > 0 
    ? strategies.reduce((sum, s) => sum + s.performance.sharpe, 0) / strategies.length 
    : 0;
  const avgWinRate = strategies.length > 0
    ? strategies.reduce((sum, s) => sum + s.metrics.winRate, 0) / strategies.length
    : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="shadow-quant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-algo-primary" />
              Strategy Engine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          </CardContent>
        </Card>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Engine Overview */}
      <Card className="shadow-quant">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-algo-primary" />
              Strategy Engine
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchStrategies}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
              {error}
            </div>
          )}
          
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold text-algo-primary">{activeStrategies}</p>
              <p className="text-sm text-muted-foreground">Active Strategies</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold">{Math.min(100, totalAllocation).toFixed(0)}%</p>
              <p className="text-sm text-muted-foreground">Capital Allocated</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold text-success">{avgSharpe.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Avg Sharpe</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold text-execution">{avgWinRate.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground">Win Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {strategies.length === 0 && !error && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Deployed Strategies</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Run AutoML optimization or deploy a strategy to see it here.
            </p>
          </CardContent>
        </Card>
      )}

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

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {/* Allocation */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Allocation</span>
                      <span className="font-medium">{strategy.allocation.toFixed(0)}%</span>
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
                        <span className="font-medium text-success">{strategy.metrics.winRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Return:</span>
                        <span className="font-medium">{strategy.metrics.avgReturn.toFixed(2)}%</span>
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
