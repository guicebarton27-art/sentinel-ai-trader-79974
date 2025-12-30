import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dna, 
  Play, 
  Square, 
  TrendingUp, 
  Zap, 
  Target, 
  Brain,
  RefreshCw,
  ChevronRight,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EvolutionHistory {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  bestReturn: number;
}

interface StrategyResult {
  rank: number;
  id: string;
  generation: number;
  fitness: number;
  config: {
    trendWeight: number;
    meanRevWeight: number;
    carryWeight: number;
    signalThreshold: number;
    stopLoss: number;
    takeProfit: number;
    maxPositionSize: number;
  };
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
  };
}

interface AutoMLResult {
  evolution: {
    totalGenerations: number;
    populationSize: number;
    mutationRate: number;
    history: EvolutionHistory[];
  };
  topStrategies: StrategyResult[];
  aiInsights: string;
  population: any[];
}

export const AutoMLAgent = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentGen, setCurrentGen] = useState(0);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [generations, setGenerations] = useState(5);
  const [populationSize, setPopulationSize] = useState(20);
  const [result, setResult] = useState<AutoMLResult | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyResult | null>(null);
  const { toast } = useToast();

  const runEvolution = async () => {
    setIsRunning(true);
    setProgress(0);
    setCurrentGen(0);
    setResult(null);
    setSelectedStrategy(null);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const next = prev + (100 / generations) * 0.8;
          return Math.min(next, 95);
        });
        setCurrentGen(prev => Math.min(prev + 1, generations));
      }, 1000);

      const { data, error } = await supabase.functions.invoke('automl-agent', {
        body: {
          symbol,
          interval: '1h',
          populationSize,
          generations,
          eliteCount: 4,
          mutationRate: 0.15,
          initialCapital: 10000,
        }
      });

      clearInterval(progressInterval);

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);
      setProgress(100);
      setCurrentGen(generations);

      toast({
        title: 'Evolution Complete',
        description: `Found ${data.topStrategies.length} optimized strategies over ${generations} generations`,
      });
    } catch (error: any) {
      console.error('AutoML error:', error);
      toast({
        title: 'Evolution Failed',
        description: error.message || 'Failed to run AutoML agent',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const continueEvolution = async () => {
    if (!result) return;
    
    setIsRunning(true);
    setProgress(0);

    try {
      const { data, error } = await supabase.functions.invoke('automl-agent', {
        body: {
          symbol,
          interval: '1h',
          populationSize,
          generations: 3,
          eliteCount: 4,
          mutationRate: 0.12,
          initialCapital: 10000,
          existingPopulation: result.population,
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(prev => ({
        ...data,
        evolution: {
          ...data.evolution,
          history: [...(prev?.evolution.history || []), ...data.evolution.history],
        }
      }));
      setProgress(100);

      toast({
        title: 'Continued Evolution',
        description: 'Added 3 more generations to the population',
      });
    } catch (error: any) {
      toast({
        title: 'Evolution Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card className="glass-panel border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                <Dna className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">AutoML Strategy Evolution</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Genetic algorithm-powered strategy optimization
                </p>
              </div>
            </div>
            <Badge variant={isRunning ? 'default' : 'secondary'} className="animate-pulse">
              {isRunning ? 'Evolving...' : 'Ready'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Symbol</label>
              <Select value={symbol} onValueChange={setSymbol} disabled={isRunning}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BTCUSDT">BTC/USDT</SelectItem>
                  <SelectItem value="ETHUSDT">ETH/USDT</SelectItem>
                  <SelectItem value="SOLUSDT">SOL/USDT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Generations: {generations}</label>
              <Slider
                value={[generations]}
                onValueChange={([v]) => setGenerations(v)}
                min={3}
                max={20}
                step={1}
                disabled={isRunning}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Population: {populationSize}</label>
              <Slider
                value={[populationSize]}
                onValueChange={([v]) => setPopulationSize(v)}
                min={10}
                max={50}
                step={5}
                disabled={isRunning}
              />
            </div>
          </div>

          {isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Generation {currentGen}/{generations}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={runEvolution}
              disabled={isRunning}
              className="flex-1 gap-2"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Evolving...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Evolution
                </>
              )}
            </Button>
            
            {result && !isRunning && (
              <Button
                onClick={continueEvolution}
                variant="outline"
                className="gap-2"
              >
                <ChevronRight className="h-4 w-4" />
                Continue (+3 Gen)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Evolution Chart */}
          <Card className="glass-panel lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Evolution Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-end gap-1">
                {result.evolution.history.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-full bg-gradient-to-t from-primary/60 to-primary rounded-t transition-all"
                      style={{
                        height: `${Math.max(10, (h.bestFitness / Math.max(...result.evolution.history.map(x => x.bestFitness))) * 100)}%`
                      }}
                    />
                    <span className="text-[10px] text-muted-foreground">{h.generation}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-primary">
                    {result.evolution.history[result.evolution.history.length - 1]?.bestFitness.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">Best Fitness</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-success">
                    {result.topStrategies[0]?.performance.totalReturn.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Best Return</div>
                </div>
                <div>
                  <div className="text-lg font-bold">
                    {result.evolution.history.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Generations</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card className="glass-panel border-accent/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {result.aiInsights}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Strategies */}
      {result && (
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-success" />
              Top Evolved Strategies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {result.topStrategies.map((strategy) => (
                  <div
                    key={strategy.id}
                    className={`p-4 rounded-lg border transition-all cursor-pointer ${
                      selectedStrategy?.id === strategy.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border/50 hover:border-primary/50 hover:bg-secondary/30'
                    }`}
                    onClick={() => setSelectedStrategy(strategy)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          strategy.rank === 1 ? 'bg-warning/20 text-warning' :
                          strategy.rank === 2 ? 'bg-muted text-foreground' :
                          strategy.rank === 3 ? 'bg-orange-500/20 text-orange-500' :
                          'bg-secondary text-muted-foreground'
                        }`}>
                          #{strategy.rank}
                        </div>
                        <div>
                          <div className="font-medium text-sm">Strategy {strategy.id.slice(0, 8)}</div>
                          <div className="text-xs text-muted-foreground">Generation {strategy.generation}</div>
                        </div>
                      </div>
                      <Badge variant={strategy.performance.totalReturn >= 0 ? 'default' : 'destructive'}>
                        {strategy.performance.totalReturn >= 0 ? '+' : ''}{strategy.performance.totalReturn.toFixed(2)}%
                      </Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div>
                        <div className="text-sm font-medium">{strategy.fitness.toFixed(1)}</div>
                        <div className="text-[10px] text-muted-foreground">Fitness</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">{strategy.performance.sharpeRatio.toFixed(2)}</div>
                        <div className="text-[10px] text-muted-foreground">Sharpe</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">{strategy.performance.winRate.toFixed(1)}%</div>
                        <div className="text-[10px] text-muted-foreground">Win Rate</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">{strategy.performance.totalTrades}</div>
                        <div className="text-[10px] text-muted-foreground">Trades</div>
                      </div>
                    </div>

                    {selectedStrategy?.id === strategy.id && (
                      <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Weights</div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span>Trend</span>
                              <span className="font-mono">{strategy.config.trendWeight.toFixed(3)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Mean Rev</span>
                              <span className="font-mono">{strategy.config.meanRevWeight.toFixed(3)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Momentum</span>
                              <span className="font-mono">{strategy.config.carryWeight.toFixed(3)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Risk Params</div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span>Stop Loss</span>
                              <span className="font-mono">{(strategy.config.stopLoss * 100).toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Take Profit</span>
                              <span className="font-mono">{(strategy.config.takeProfit * 100).toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Max Size</span>
                              <span className="font-mono">{(strategy.config.maxPositionSize * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
