import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Pause, 
  Target, 
  Shield, 
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign
} from 'lucide-react';

interface StrategyDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  positionSize: number;
  stopLoss: number;
  takeProfit: number;
  riskScore: number;
  expectedReturn: number;
  timeHorizon: string;
}

interface MarketState {
  symbol: string;
  currentPrice: number;
  priceChange24h: number;
  volume24h: number;
  sentiment: number;
  volatility: number;
  trendStrength: string;
}

export const AIStrategyEngine = () => {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [decision, setDecision] = useState<StrategyDecision | null>(null);
  const [riskTolerance, setRiskTolerance] = useState('moderate');
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [simulatedPrice, setSimulatedPrice] = useState([65000]);

  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

  const generateMarketState = (): MarketState => {
    const basePrice = simulatedPrice[0];
    return {
      symbol: selectedSymbol,
      currentPrice: basePrice,
      priceChange24h: (Math.random() - 0.5) * 10,
      volume24h: Math.random() * 5000000000,
      sentiment: (Math.random() - 0.5) * 2,
      volatility: Math.random() * 5 + 1,
      trendStrength: ['strong_bullish', 'bullish', 'neutral', 'bearish', 'strong_bearish'][Math.floor(Math.random() * 5)]
    };
  };

  const analyzeMarket = async () => {
    setIsAnalyzing(true);
    setDecision(null);

    try {
      const marketState = generateMarketState();
      
      const { data, error } = await supabase.functions.invoke('ai-strategy-engine', {
        body: {
          marketState,
          riskTolerance,
          portfolio: {
            totalValue: 100000,
            cashBalance: 25000,
            openPositions: 3
          }
        }
      });

      if (error) throw error;

      if (data.decision) {
        setDecision(data.decision);
        toast({
          title: `AI Decision: ${data.decision.action}`,
          description: `Confidence: ${data.decision.confidence}%`,
        });
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Unable to complete market analysis',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'BUY': return <TrendingUp className="h-6 w-6 text-green-500" />;
      case 'SELL': return <TrendingDown className="h-6 w-6 text-red-500" />;
      default: return <Pause className="h-6 w-6 text-yellow-500" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'SELL': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    }
  };

  const getRiskColor = (score: number) => {
    if (score <= 3) return 'text-green-400';
    if (score <= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getTimeHorizonLabel = (horizon: string) => {
    const labels: Record<string, string> = {
      scalp: '< 1 hour',
      intraday: '1-24 hours',
      swing: '1-7 days',
      position: '1+ weeks'
    };
    return labels[horizon] || horizon;
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            AI Strategy Engine
            <Badge variant="outline" className="ml-2 text-xs">
              Powered by Gemini
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Symbol Selection */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Trading Pair</label>
              <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {symbols.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Risk Tolerance */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Risk Tolerance</label>
              <Select value={riskTolerance} onValueChange={setRiskTolerance}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">Conservative</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="aggressive">Aggressive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Simulation */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Simulated Price: ${simulatedPrice[0].toLocaleString()}
              </label>
              <Slider
                value={simulatedPrice}
                onValueChange={setSimulatedPrice}
                min={20000}
                max={150000}
                step={1000}
              />
            </div>

            {/* Analyze Button */}
            <div className="flex items-end">
              <Button 
                onClick={analyzeMarket} 
                disabled={isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Analyze Market
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Decision Display */}
      {decision && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Decision Card */}
          <Card className={`lg:col-span-2 border-2 ${getActionColor(decision.action)}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getActionIcon(decision.action)}
                  <span className="text-2xl font-bold">{decision.action}</span>
                </div>
                <Badge variant="outline" className="text-lg px-4 py-1">
                  {decision.confidence}% Confidence
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Reasoning */}
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">AI Reasoning</h4>
                <p className="text-sm">{decision.reasoning}</p>
              </div>

              {/* Confidence Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Signal Strength</span>
                  <span>{decision.confidence}%</span>
                </div>
                <Progress value={decision.confidence} className="h-2" />
              </div>

              {/* Trade Parameters Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <Target className="h-5 w-5 mx-auto mb-1 text-blue-400" />
                  <p className="text-xs text-muted-foreground">Position Size</p>
                  <p className="text-lg font-bold">{decision.positionSize}%</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <Shield className="h-5 w-5 mx-auto mb-1 text-red-400" />
                  <p className="text-xs text-muted-foreground">Stop Loss</p>
                  <p className="text-lg font-bold">-{decision.stopLoss}%</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <DollarSign className="h-5 w-5 mx-auto mb-1 text-green-400" />
                  <p className="text-xs text-muted-foreground">Take Profit</p>
                  <p className="text-lg font-bold">+{decision.takeProfit}%</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <Clock className="h-5 w-5 mx-auto mb-1 text-purple-400" />
                  <p className="text-xs text-muted-foreground">Time Horizon</p>
                  <p className="text-lg font-bold capitalize">{decision.timeHorizon}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risk & Return Card */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Risk Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Risk Score */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Risk Score</span>
                  <span className={`text-2xl font-bold ${getRiskColor(decision.riskScore)}`}>
                    {decision.riskScore}/10
                  </span>
                </div>
                <Progress 
                  value={decision.riskScore * 10} 
                  className={`h-3 ${decision.riskScore <= 3 ? '[&>div]:bg-green-500' : decision.riskScore <= 6 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'}`}
                />
                <p className="text-xs text-muted-foreground">
                  {decision.riskScore <= 3 ? 'Low risk trade' : decision.riskScore <= 6 ? 'Moderate risk' : 'High risk - caution advised'}
                </p>
              </div>

              {/* Expected Return */}
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Expected Return</span>
                  {decision.expectedReturn >= 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  )}
                </div>
                <p className={`text-3xl font-bold ${decision.expectedReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {decision.expectedReturn >= 0 ? '+' : ''}{decision.expectedReturn}%
                </p>
              </div>

              {/* Risk/Reward Ratio */}
              <div className="p-4 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">Risk/Reward Ratio</span>
                <p className="text-2xl font-bold text-primary">
                  1:{(decision.takeProfit / decision.stopLoss).toFixed(1)}
                </p>
              </div>

              {/* Time Horizon */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium capitalize">{decision.timeHorizon}</p>
                  <p className="text-xs text-muted-foreground">{getTimeHorizonLabel(decision.timeHorizon)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!decision && !isAnalyzing && (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Brain className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No Analysis Yet
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Configure your parameters above and click "Analyze Market" to get AI-powered trading signals
              based on reinforcement learning principles.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
