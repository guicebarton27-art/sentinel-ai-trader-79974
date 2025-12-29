import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  RefreshCw,
  Zap,
  Target
} from 'lucide-react';

interface StrategyDecision {
  strategy_id: string;
  strategy_name: string;
  status: string;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_pnl: number;
  allocation_weight: number;
  performance_score: number;
  rank: number;
}

export const MetaLearnerPanel = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    decisions: StrategyDecision[];
    portfolio_health: number;
    diversification_score: number;
    rebalancing_needed: boolean;
  } | null>(null);
  const { toast } = useToast();

  const runMetaLearner = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-learner', {
        body: { strategies: [] }
      });

      if (error) throw error;

      setResult(data);
      toast({
        title: 'Meta-Learner Complete',
        description: `Evaluated ${data.decisions?.length || 0} strategies`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'promoted': return <TrendingUp className="h-4 w-4 text-success" />;
      case 'demoted': return <TrendingDown className="h-4 w-4 text-destructive" />;
      case 'paused': return <Minus className="h-4 w-4 text-warning" />;
      default: return <Target className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      promoted: 'bg-success/20 text-success',
      demoted: 'bg-destructive/20 text-destructive',
      paused: 'bg-warning/20 text-warning',
      active: 'bg-primary/20 text-primary',
      killed: 'bg-destructive text-destructive-foreground',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Meta-Learner
          </CardTitle>
          <Button 
            onClick={runMetaLearner} 
            disabled={loading}
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Evaluate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {result ? (
          <>
            {/* Portfolio Health */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Portfolio Health</div>
                <div className="flex items-center gap-2">
                  <Progress value={result.portfolio_health} className="h-2" />
                  <span className="text-sm font-medium">{result.portfolio_health}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Diversification</div>
                <div className="flex items-center gap-2">
                  <Progress value={result.diversification_score} className="h-2" />
                  <span className="text-sm font-medium">{result.diversification_score}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Rebalance</div>
                <Badge variant={result.rebalancing_needed ? 'destructive' : 'outline'}>
                  {result.rebalancing_needed ? 'Needed' : 'OK'}
                </Badge>
              </div>
            </div>

            {/* Strategy Decisions */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Strategy Rankings</div>
              {result.decisions?.map((s, i) => (
                <div 
                  key={s.strategy_id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                      {s.rank}
                    </div>
                    {getStatusIcon(s.status)}
                    <div>
                      <div className="font-medium text-sm">{s.strategy_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Sharpe: {s.sharpe_ratio?.toFixed(2)} | DD: {s.max_drawdown?.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusBadge(s.status)}>
                      {s.status}
                    </Badge>
                    <div className="text-right">
                      <div className="text-sm font-medium">{(s.allocation_weight * 100).toFixed(0)}%</div>
                      <div className="text-xs text-muted-foreground">allocation</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Run Meta-Learner to evaluate and rank strategies</p>
            <p className="text-xs mt-1">Promotes high performers, demotes underperformers</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
