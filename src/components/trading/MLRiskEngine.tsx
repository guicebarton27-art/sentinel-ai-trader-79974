import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, RefreshCw, TrendingDown, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export const MLRiskEngine = ({ symbol = 'BTC/USD' }) => {
  const [riskData, setRiskData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const analyzeRisk = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ml-risk-engine', {
        body: { 
          symbol,
          position_size: 0.1,
          entry_price: 111500,
          account_balance: 10000
        }
      });

      if (error) throw error;
      setRiskData(data);
      
      toast({
        title: "Risk Analysis Complete",
        description: `Risk Level: ${data.risk_level?.toUpperCase()}`,
      });
    } catch (error: any) {
      console.error('Risk analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    if (level === 'low') return 'bg-success/10 text-success border-success/20';
    if (level === 'extreme') return 'bg-destructive/10 text-destructive border-destructive/20';
    if (level === 'high') return 'bg-warning/10 text-warning border-warning/20';
    return 'bg-info/10 text-info border-info/20';
  };

  const getRiskIcon = (level: string) => {
    if (level === 'low') return <Shield className="h-5 w-5 text-success" />;
    if (level === 'extreme') return <AlertTriangle className="h-5 w-5 text-destructive" />;
    return <Activity className="h-5 w-5 text-warning" />;
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>ML Risk Engine</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={analyzeRisk}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          AI-powered risk management and position sizing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {riskData ? (
          <>
            <div className="p-4 rounded-lg border bg-card/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getRiskIcon(riskData.risk_level)}
                  <span className="font-semibold">Risk Assessment</span>
                </div>
                <Badge variant="outline" className={getRiskColor(riskData.risk_level)}>
                  {riskData.risk_level?.toUpperCase()}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Risk Score</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          riskData.risk_score > 70 ? 'bg-destructive' :
                          riskData.risk_score > 40 ? 'bg-warning' : 'bg-success'
                        }`}
                        style={{ width: `${riskData.risk_score}%` }}
                      />
                    </div>
                    <span className="font-medium">{riskData.risk_score}/100</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border bg-card/30">
                <div className="text-xs text-muted-foreground mb-1">Volatility Forecast</div>
                <div className="text-lg font-semibold">
                  {riskData.volatility_forecast?.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground">24h</div>
              </div>
              
              <div className="p-3 rounded-lg border bg-card/30">
                <div className="text-xs text-muted-foreground mb-1">Drawdown Risk</div>
                <div className="text-lg font-semibold">
                  {(riskData.drawdown_probability * 100)?.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">probability</div>
              </div>
              
              <div className="p-3 rounded-lg border bg-card/30">
                <div className="text-xs text-muted-foreground mb-1">Position Size</div>
                <div className="text-lg font-semibold">
                  {riskData.recommended_position_size?.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">of account</div>
              </div>
              
              <div className="p-3 rounded-lg border bg-card/30">
                <div className="text-xs text-muted-foreground mb-1">Max Leverage</div>
                <div className="text-lg font-semibold">
                  {riskData.max_leverage?.toFixed(1)}x
                </div>
                <div className="text-xs text-muted-foreground">recommended</div>
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-card/30 space-y-3">
              <div className="font-semibold text-sm">Risk Controls</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Stop Loss:</span>
                  <span className="font-medium text-destructive">
                    ${riskData.stop_loss?.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Take Profit:</span>
                  <span className="font-medium text-success">
                    ${riskData.take_profit?.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Portfolio Heat:</span>
                  <span className="font-medium">
                    {riskData.portfolio_heat?.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {riskData.recommendations && (
              <div className="p-4 rounded-lg border bg-card/30">
                <div className="font-semibold text-sm mb-2">AI Recommendations</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {riskData.recommendations}
                </p>
              </div>
            )}

            {riskData.metrics && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded bg-card/50">
                  <div className="text-muted-foreground">VaR 95%</div>
                  <div className="font-medium">{(riskData.metrics.var95 * 100)?.toFixed(2)}%</div>
                </div>
                <div className="p-2 rounded bg-card/50">
                  <div className="text-muted-foreground">Max DD</div>
                  <div className="font-medium">{(riskData.metrics.max_drawdown * 100)?.toFixed(2)}%</div>
                </div>
                <div className="p-2 rounded bg-card/50">
                  <div className="text-muted-foreground">Downside Dev</div>
                  <div className="font-medium">{(riskData.metrics.downside_deviation * 100)?.toFixed(2)}%</div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              {loading ? "Analyzing risk factors..." : "Click to run comprehensive risk analysis"}
            </p>
            <Button onClick={analyzeRisk} disabled={loading}>
              {loading ? "Analyzing..." : "Run Risk Analysis"}
            </Button>
          </div>
        )}

        <div className="pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3" />
            <span>ML-powered volatility forecasting & drawdown prediction</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
