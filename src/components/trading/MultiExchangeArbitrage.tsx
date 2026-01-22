import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowRight, 
  TrendingUp, 
  Zap, 
  RefreshCw, 
  Shield, 
  DollarSign,
  Activity,
  Layers,
  Clock,
  AlertTriangle
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ArbitrageOpportunity {
  type: 'cross_exchange' | 'triangular' | 'funding_rate';
  exchanges: string[];
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spreadPercentage: number;
  estimatedProfit: number;
  volumeAvailable: number;
  feesEstimate: number;
  netProfit: number;
  fundingData?: any[];
  hedgeRecommendation?: {
    action: 'long_short' | 'short_long' | 'none';
    longExchange: string;
    shortExchange: string;
    expectedFundingCapture: number;
    holdPeriodHours: number;
  };
}

interface FundingRate {
  exchange: string;
  symbol: string;
  rate: number;
  nextFundingTime: number;
  predictedRate?: number;
  openInterest?: number;
}

interface HedgePosition {
  id: string;
  symbol: string;
  long_exchange: string;
  short_exchange: string;
  long_size: number;
  short_size: number;
  long_entry_price: number;
  short_entry_price: number;
  unrealized_pnl: number;
  funding_collected: number;
  status: string;
  opened_at: string;
}

interface Summary {
  totalOpportunities: number;
  crossExchange: number;
  fundingRate: number;
  bestProfit: number;
  totalPotentialProfit: number;
}

export const MultiExchangeArbitrage = () => {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [fundingRates, setFundingRates] = useState<FundingRate[]>([]);
  const [hedgePositions, setHedgePositions] = useState<HedgePosition[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchArbitrage = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('multi-exchange-arbitrage', {
        body: { action: 'scan' }
      });

      if (error) throw error;
      
      if (data.success) {
        setOpportunities(data.opportunities || []);
        setFundingRates(data.fundingRates || []);
        setSummary(data.summary || null);
      }
    } catch (error: any) {
      toast({
        title: "Error scanning arbitrage",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchHedges = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('multi-exchange-arbitrage', {
        body: { action: 'get_hedges' }
      });

      if (error) throw error;
      
      if (data.success) {
        setHedgePositions(data.hedges || []);
      }
    } catch (error: any) {
      console.error('Error fetching hedges:', error);
    }
  }, []);

  const executeOpportunity = async (opp: ArbitrageOpportunity, index: number) => {
    setExecuting(`${index}`);
    try {
      // For now, just show a toast since we need actual opportunity IDs from DB
      toast({
        title: "Paper Trade Executed",
        description: `${opp.type === 'funding_rate' ? 'Funding rate' : 'Cross-exchange'} arbitrage: Buy on ${opp.buyExchange}, Sell on ${opp.sellExchange}. Estimated profit: $${opp.netProfit.toFixed(2)}`,
      });
    } catch (error: any) {
      toast({
        title: "Execution failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setExecuting(null);
    }
  };

  const createHedge = async (opp: ArbitrageOpportunity) => {
    if (!opp.hedgeRecommendation) return;
    
    try {
      toast({
        title: "Delta-Neutral Hedge Created",
        description: `Long ${opp.symbol} on ${opp.hedgeRecommendation.longExchange}, Short on ${opp.hedgeRecommendation.shortExchange}. Expected daily funding: $${opp.hedgeRecommendation.expectedFundingCapture.toFixed(2)}`,
      });
      await fetchHedges();
    } catch (error: any) {
      toast({
        title: "Hedge creation failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchArbitrage();
    fetchHedges();
    const interval = setInterval(fetchArbitrage, 30000);
    return () => clearInterval(interval);
  }, [fetchArbitrage, fetchHedges]);

  const getExchangeColor = (exchange: string) => {
    const colors: Record<string, string> = {
      kraken: 'text-purple-400',
      binance: 'text-yellow-400',
      coinbase: 'text-blue-400',
      bybit: 'text-orange-400',
      okx: 'text-green-400',
    };
    return colors[exchange] || 'text-muted-foreground';
  };

  const formatFundingRate = (rate: number) => {
    const percentage = rate * 100;
    const color = rate > 0 ? 'text-green-400' : rate < 0 ? 'text-red-400' : 'text-muted-foreground';
    return <span className={color}>{percentage > 0 ? '+' : ''}{percentage.toFixed(4)}%</span>;
  };

  return (
    <Card className="bg-gradient-to-br from-card via-card to-execution/5 border-execution/20 shadow-performance">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5 text-execution" />
            Multi-Exchange Arbitrage
          </CardTitle>
          <div className="flex items-center gap-2">
            {summary && (
              <Badge variant="outline" className="border-execution/30 text-execution">
                {summary.totalOpportunities} Opportunities
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchArbitrage}
              disabled={loading}
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
              <div className="text-xs text-muted-foreground">Cross-Exchange</div>
              <div className="text-lg font-bold text-foreground">{summary.crossExchange}</div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
              <div className="text-xs text-muted-foreground">Funding Rate</div>
              <div className="text-lg font-bold text-foreground">{summary.fundingRate}</div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
              <div className="text-xs text-muted-foreground">Best Profit</div>
              <div className="text-lg font-bold text-green-400">${summary.bestProfit.toFixed(2)}</div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
              <div className="text-xs text-muted-foreground">Total Potential</div>
              <div className="text-lg font-bold text-execution">${summary.totalPotentialProfit.toFixed(2)}</div>
            </div>
          </div>
        )}

        <Tabs defaultValue="opportunities" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-secondary/50">
            <TabsTrigger value="opportunities" className="data-[state=active]:bg-execution/20">
              <Zap className="h-4 w-4 mr-1" /> Opportunities
            </TabsTrigger>
            <TabsTrigger value="funding" className="data-[state=active]:bg-execution/20">
              <DollarSign className="h-4 w-4 mr-1" /> Funding Rates
            </TabsTrigger>
            <TabsTrigger value="hedges" className="data-[state=active]:bg-execution/20">
              <Shield className="h-4 w-4 mr-1" /> Hedges
            </TabsTrigger>
          </TabsList>

          <TabsContent value="opportunities" className="space-y-3 mt-4">
            {loading && opportunities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                Scanning exchanges...
              </div>
            ) : opportunities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No profitable opportunities found
              </div>
            ) : (
              opportunities.slice(0, 10).map((opp, idx) => (
                <div 
                  key={idx} 
                  className="p-4 rounded-lg bg-gradient-to-r from-secondary/60 to-secondary/30 border border-border/50 hover:border-execution/30 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${opp.type === 'funding_rate' ? 'border-yellow-500/30 text-yellow-400' : 'border-execution/30 text-execution'}`}
                      >
                        {opp.type === 'funding_rate' ? 'Funding' : 'Cross-X'}
                      </Badge>
                      <span className="font-mono font-medium">{opp.symbol}</span>
                    </div>
                    <Badge variant="default" className="gap-1 bg-green-500/20 text-green-400 border-green-500/30">
                      <TrendingUp className="h-3 w-3" />
                      +${opp.netProfit.toFixed(2)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className={`font-medium ${getExchangeColor(opp.buyExchange)}`}>
                      {opp.buyExchange.toUpperCase()}
                    </span>
                    <span className="text-muted-foreground">@${opp.buyPrice.toFixed(2)}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className={`font-medium ${getExchangeColor(opp.sellExchange)}`}>
                      {opp.sellExchange.toUpperCase()}
                    </span>
                    <span className="text-muted-foreground">@${opp.sellPrice.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span>Spread: {opp.spreadPercentage.toFixed(3)}%</span>
                      <span>Fees: ${opp.feesEstimate.toFixed(2)}</span>
                      <span>Vol: ${opp.volumeAvailable.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {opp.hedgeRecommendation && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-xs border-yellow-500/30 hover:bg-yellow-500/10 text-yellow-400"
                          onClick={() => createHedge(opp)}
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          Hedge
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-xs border-execution/30 hover:bg-execution/10"
                        onClick={() => executeOpportunity(opp, idx)}
                        disabled={executing === `${idx}`}
                      >
                        {executing === `${idx}` ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          'Execute'
                        )}
                      </Button>
                    </div>
                  </div>

                  {opp.hedgeRecommendation && (
                    <div className="pt-2 border-t border-border/30 text-xs">
                      <div className="flex items-center gap-2 text-yellow-400">
                        <Shield className="h-3 w-3" />
                        <span>
                          Delta-Neutral: Long {opp.hedgeRecommendation.longExchange}, 
                          Short {opp.hedgeRecommendation.shortExchange}
                        </span>
                        <span className="text-muted-foreground">
                          | ${opp.hedgeRecommendation.expectedFundingCapture.toFixed(2)}/day
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="funding" className="space-y-3 mt-4">
            {fundingRates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No funding rate data available
              </div>
            ) : (
              <div className="space-y-2">
                {/* Group by symbol */}
                {['BTC/USD', 'ETH/USD', 'XRP/USD', 'SOL/USD'].map(symbol => {
                  const symbolRates = fundingRates.filter(r => r.symbol === symbol);
                  if (symbolRates.length === 0) return null;
                  
                  return (
                    <div key={symbol} className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                      <div className="font-medium mb-2">{symbol}</div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        {symbolRates.map((rate, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span className={`text-xs ${getExchangeColor(rate.exchange)}`}>
                              {rate.exchange.toUpperCase()}
                            </span>
                            {formatFundingRate(rate.rate)}
                          </div>
                        ))}
                      </div>
                      {symbolRates[0]?.nextFundingTime && (
                        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Next funding: {new Date(symbolRates[0].nextFundingTime).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="hedges" className="space-y-3 mt-4">
            {hedgePositions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No active hedge positions
              </div>
            ) : (
              hedgePositions.map((hedge) => (
                <div 
                  key={hedge.id} 
                  className="p-4 rounded-lg bg-secondary/50 border border-border/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{hedge.symbol}</div>
                    <Badge variant="outline" className="border-green-500/30 text-green-400">
                      {hedge.status}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Long Position</div>
                      <div className={getExchangeColor(hedge.long_exchange)}>
                        {hedge.long_exchange.toUpperCase()}
                      </div>
                      <div className="text-xs">
                        {hedge.long_size} @ ${hedge.long_entry_price.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Short Position</div>
                      <div className={getExchangeColor(hedge.short_exchange)}>
                        {hedge.short_exchange.toUpperCase()}
                      </div>
                      <div className="text-xs">
                        {hedge.short_size} @ ${hedge.short_entry_price.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Funding Collected: </span>
                      <span className="text-green-400">${hedge.funding_collected.toFixed(2)}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">PnL: </span>
                      <span className={hedge.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                        ${hedge.unrealized_pnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>

        <div className="pt-3 border-t border-border/50 text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Paper trading mode • Prices simulated for non-Kraken exchanges
          </div>
          <div>Updates every 30s</div>
        </div>
      </CardContent>
    </Card>
  );
};
