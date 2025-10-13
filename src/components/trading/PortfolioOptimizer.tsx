import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PieChart, RefreshCw, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export const PortfolioOptimizer = () => {
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const optimize = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('portfolio-optimizer', {
        body: { 
          assets: ['BTC/USD', 'ETH/USD', 'SOL/USD'],
          total_capital: 10000,
          risk_tolerance: 'moderate'
        }
      });

      if (error) throw error;
      setPortfolio(data);
      
      toast({
        title: "Portfolio Optimized",
        description: `Expected Sharpe: ${data.portfolio_metrics?.sharpe_ratio?.toFixed(2)}`,
      });
    } catch (error: any) {
      console.error('Optimization error:', error);
      toast({
        title: "Optimization Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            <CardTitle>Portfolio Optimizer</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={optimize}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          Mean-variance optimization with ML insights
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {portfolio ? (
          <>
            <div className="p-4 rounded-lg border bg-card/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Portfolio Metrics</span>
                <Badge variant="outline">
                  {portfolio.risk_tolerance}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Expected Return</div>
                  <div className="text-lg font-semibold text-success">
                    {portfolio.portfolio_metrics.expected_return?.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Volatility</div>
                  <div className="text-lg font-semibold">
                    {portfolio.portfolio_metrics.expected_volatility?.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Sharpe Ratio</div>
                  <div className="text-lg font-semibold">
                    {portfolio.portfolio_metrics.sharpe_ratio?.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Diversification</div>
                  <div className="text-lg font-semibold">
                    {portfolio.portfolio_metrics.diversification_score}/100
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-sm">Asset Allocation</div>
              {portfolio.allocations?.map((asset: any, idx: number) => (
                <div key={idx} className="p-3 rounded-lg border bg-card/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{asset.symbol}</span>
                    <Badge variant="outline">{asset.weight.toFixed(1)}%</Badge>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Allocation:</span>
                      <span className="font-medium">${asset.allocation?.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Expected Return:</span>
                      <span className="font-medium text-success">
                        {asset.expected_return?.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Volatility:</span>
                      <span className="font-medium">
                        {(asset.volatility * 100)?.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${asset.weight}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-lg border bg-card/30">
              <div className="font-semibold text-sm mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Strategy Insights
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {portfolio.insights}
              </p>
              <div className="mt-3 text-xs">
                <span className="text-muted-foreground">Rebalance:</span>
                <Badge variant="outline" className="ml-2">
                  {portfolio.rebalancing_frequency}
                </Badge>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              {loading ? "Optimizing portfolio allocation..." : "Click to optimize your portfolio"}
            </p>
            <Button onClick={optimize} disabled={loading}>
              {loading ? "Optimizing..." : "Optimize Portfolio"}
            </Button>
          </div>
        )}

        <div className="pt-2 border-t text-xs text-muted-foreground">
          Modern Portfolio Theory + Machine Learning
        </div>
      </CardContent>
    </Card>
  );
};
