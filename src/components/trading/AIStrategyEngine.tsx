import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTicker, useMultipleTickers } from '@/hooks/useMarketData';
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
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USD');
  const [portfolio, setPortfolio] = useState({ totalValue: 0, cashBalance: 0, openPositions: 0 });

  const symbols = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'ADA/USD'];

  // Real market data
  const { ticker, loading: tickerLoading } = useTicker({ symbol: selectedSymbol, refreshInterval: 5000 });
  const { tickers } = useMultipleTickers(symbols, 15000);

  // Fetch portfolio data
  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get active bot capital
        const { data: bots } = await supabase
          .from('bots')
          .select('current_capital, starting_capital')
          .eq('user_id', user.id);

        // Get open positions
        const { data: positions } = await supabase
          .from('positions')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'open');

        const totalCapital = bots?.reduce((sum, bot) => sum + Number(bot.current_capital || 0), 0) || 10000;
        const startingCapital = bots?.reduce((sum, bot) => sum + Number(bot.starting_capital || 0), 0) || 10000;

        setPortfolio({
          totalValue: totalCapital,
          cashBalance: totalCapital * 0.25, // Assume 25% cash reserve
          openPositions: positions?.length || 0
        });
      } catch (err) {
        console.error('Error fetching portfolio:', err);
      }
    };

    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 30000);
    return () => clearInterval(interval);
  }, []);

  const generateMarketState = (): MarketState => {
    if (!ticker) {
      return {
        symbol: selectedSymbol,
        currentPrice: 0,
        priceChange24h: 0,
        volume24h: 0,
        sentiment: 0,
        volatility: 0,
        trendStrength: 'neutral'
      };
    }

    // Calculate trend strength from price change
    const change = ticker.change24h || 0;
    let trendStrength = 'neutral';
    if (change > 3) trendStrength = 'strong_bullish';
    else if (change > 1) trendStrength = 'bullish';
    else if (change < -3) trendStrength = 'strong_bearish';
    else if (change < -1) trendStrength = 'bearish';

    // Estimate volatility from high/low range
    const range = ticker.high24h && ticker.low24h 
      ? ((ticker.high24h - ticker.low24h) / ticker.price) * 100 
      : 2;

    return {
      symbol: selectedSymbol,
      currentPrice: ticker.price,
      priceChange24h: change,
      volume24h: ticker.volume24h,
      sentiment: change / 10, // Simple sentiment from price change
      volatility: range,
      trendStrength
    };
  };

  const analyzeMarket = async () => {
    if (!ticker) {
      toast({
        title: 'Market Data Loading',
        description: 'Please wait for market data to load',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    setDecision(null);

    try {
      const marketState = generateMarketState();
      
      const { data, error } = await supabase.functions.invoke('ai-strategy-engine', {
        body: {
          marketState,
          riskTolerance,
          portfolio: {
            totalValue: portfolio.totalValue,
            cashBalance: portfolio.cashBalance,
            openPositions: portfolio.openPositions
          }
        }
      });

      if (error) throw error;

      if (data.decision) {
        setDecision(data.decision);
        toast({
          title: `AI Decision: ${data.decision.action}`,
          description: `Confidence: ${data.decision.confidence}% | ${selectedSymbol} @ $${ticker.price.toLocaleString()}`,
        });
      }
    } catch (error: unknown) {
      console.error('Analysis error:', error);
      toast({
        title: 'Analysis Failed',
        description: (error as Error).message || 'Unable to complete market analysis',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'BUY': return <TrendingUp className="h-6 w-6 text-success" />;
      case 'SELL': return <TrendingDown className="h-6 w-6 text-destructive" />;
      default: return <Pause className="h-6 w-6 text-warning" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'bg-success/20 text-success border-success/50';
      case 'SELL': return 'bg-destructive/20 text-destructive border-destructive/50';
      default: return 'bg-warning/20 text-warning border-warning/50';
    }
  };

  const getRiskColor = (score: number) => {
    if (score <= 3) return 'text-success';
    if (score <= 6) return 'text-warning';
    return 'text-destructive';
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
            {ticker && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {selectedSymbol}: ${ticker.price.toLocaleString()} 
                <span className={ticker.change24h >= 0 ? 'text-success ml-1' : 'text-destructive ml-1'}>
                  {ticker.change24h >= 0 ? '+' : ''}{ticker.change24h.toFixed(2)}%
                </span>
              </Badge>
            )}
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
                  {symbols.map(s => {
                    const t = tickers.find(t => t.symbol === s);
                    return (
                      <SelectItem key={s} value={s}>
                        {s} {t ? `($${t.price.toLocaleString()})` : ''}
                      </SelectItem>
                    );
                  })}
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

            {/* Portfolio Info */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Portfolio</label>
              <div className="text-sm p-2 rounded border border-border/50 bg-secondary/30">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Value:</span>
                  <span className="font-mono">${portfolio.totalValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Positions:</span>
                  <span>{portfolio.openPositions}</span>
                </div>
              </div>
            </div>

            {/* Analyze Button */}
            <div className="flex items-end">
              <Button 
                onClick={analyzeMarket} 
                disabled={isAnalyzing || tickerLoading}
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
                  {ticker && (
                    <span className="text-sm text-muted-foreground">
                      @ ${ticker.price.toLocaleString()}
                    </span>
                  )}
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
                  <Target className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">Position Size</p>
                  <p className="text-lg font-bold">{decision.positionSize}%</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <Shield className="h-5 w-5 mx-auto mb-1 text-destructive" />
                  <p className="text-xs text-muted-foreground">Stop Loss</p>
                  <p className="text-lg font-bold">-{decision.stopLoss}%</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <DollarSign className="h-5 w-5 mx-auto mb-1 text-success" />
                  <p className="text-xs text-muted-foreground">Take Profit</p>
                  <p className="text-lg font-bold">+{decision.takeProfit}%</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <Clock className="h-5 w-5 mx-auto mb-1 text-accent" />
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
                  className={`h-3 ${decision.riskScore <= 3 ? '[&>div]:bg-success' : decision.riskScore <= 6 ? '[&>div]:bg-warning' : '[&>div]:bg-destructive'}`}
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
                    <CheckCircle className="h-5 w-5 text-success" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  )}
                </div>
                <p className={`text-3xl font-bold ${decision.expectedReturn >= 0 ? 'text-success' : 'text-destructive'}`}>
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
              Ready for Analysis
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              {ticker ? (
                <>
                  {selectedSymbol} is currently at <strong>${ticker.price.toLocaleString()}</strong> 
                  {' '}({ticker.change24h >= 0 ? '+' : ''}{ticker.change24h.toFixed(2)}%).
                  Click "Analyze Market" for AI-powered trading signals.
                </>
              ) : (
                'Loading market data...'
              )}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
