import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StrategyRecommendationProps {
  symbol: string;
}

export const StrategyRecommendation = ({ symbol }: StrategyRecommendationProps) => {
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<any>(null);

  const getRecommendation = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ml-strategy-recommendation', {
        body: { symbol, account_balance: 10000, risk_tolerance: 'moderate' }
      });

      if (error) throw error;
      setRecommendation(data);
      toast.success('Strategy recommendation generated');
    } catch (error: any) {
      console.error('Strategy recommendation error:', error);
      toast.error('Failed to generate recommendation');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'buy': return <ArrowUpRight className="h-4 w-4" />;
      case 'sell': return <ArrowDownRight className="h-4 w-4" />;
      default: return <Minus className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'buy': return 'text-success';
      case 'sell': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">ML Strategy Recommendation</h3>
        </div>
        <Button onClick={getRecommendation} disabled={loading} size="sm">
          {loading ? 'Analyzing...' : 'Get Strategy'}
        </Button>
      </div>

      {recommendation && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Primary Strategy</p>
              <Badge variant="outline" className="mt-1">
                {recommendation.primary_strategy}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Market Regime</p>
              <Badge variant="outline" className="mt-1">
                {recommendation.market_regime}
              </Badge>
            </div>
          </div>

          <div className="bg-accent/50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`font-semibold uppercase ${getActionColor(recommendation.action)}`}>
                  {recommendation.action}
                </span>
                {getActionIcon(recommendation.action)}
              </div>
              <Badge variant={recommendation.confidence > 0.7 ? 'default' : 'secondary'}>
                {(recommendation.confidence * 100).toFixed(0)}% Confidence
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Entry</p>
                <p className="font-semibold">${recommendation.entry_price?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Stop Loss</p>
                <p className="font-semibold text-destructive">${recommendation.stop_loss?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Size</p>
                <p className="font-semibold">{recommendation.position_size?.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <p className="text-sm font-semibold">Key Signals</p>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {recommendation.key_signals}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <p className="text-sm font-semibold">Risk Factors</p>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {recommendation.risk_factors}
            </p>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Time Horizon: {recommendation.time_horizon} | R/R: {recommendation.risk_reward_ratio}:1</p>
          </div>
        </div>
      )}
    </Card>
  );
};
