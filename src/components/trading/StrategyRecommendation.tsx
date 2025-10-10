import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, BarChart3, Activity, Sparkles, ArrowUpRight } from "lucide-react";
import { useState } from "react";

interface StrategyRec {
  name: string;
  type: "momentum" | "mean-reversion" | "breakout";
  confidence: number;
  expectedReturn: number;
  riskScore: number;
  reason: string;
}

export const StrategyRecommendation = () => {
  const [recommendations] = useState<StrategyRec[]>([
    {
      name: "Momentum Alpha v2",
      type: "momentum",
      confidence: 0.87,
      expectedReturn: 2.4,
      riskScore: 65,
      reason: "High volatility detected with strong directional bias"
    },
    {
      name: "Volatility Breakout",
      type: "breakout",
      confidence: 0.72,
      expectedReturn: 3.1,
      riskScore: 78,
      reason: "Consolidation pattern near resistance levels"
    }
  ]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "momentum": return "text-algo-primary";
      case "breakout": return "text-alpha";
      case "mean-reversion": return "text-sortino";
      default: return "text-muted-foreground";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "momentum": return <TrendingUp className="h-4 w-4" />;
      case "breakout": return <ArrowUpRight className="h-4 w-4" />;
      case "mean-reversion": return <Activity className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 75) return "text-error";
    if (score >= 50) return "text-warning";
    return "text-success";
  };

  return (
    <Card className="bg-gradient-to-br from-card via-card to-alpha/5 border-alpha/20 shadow-performance">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-alpha" />
            <CardTitle className="text-lg">AI Strategy Recommendations</CardTitle>
          </div>
          <Badge variant="outline" className="gap-1 border-alpha/30 text-alpha">
            DQL Optimized
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {recommendations.map((rec, idx) => (
          <div 
            key={idx}
            className="p-4 rounded-lg bg-gradient-to-br from-secondary/60 to-secondary/30 border border-border/50 hover:border-alpha/30 transition-all space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`${getTypeColor(rec.type)}`}>
                    {getTypeIcon(rec.type)}
                  </span>
                  <h4 className="font-semibold">{rec.name}</h4>
                </div>
                <p className="text-sm text-muted-foreground">{rec.reason}</p>
              </div>
              <Badge variant="default" className="bg-alpha/20 text-alpha border-alpha/30">
                {(rec.confidence * 100).toFixed(0)}%
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/30">
              <div>
                <div className="text-xs text-muted-foreground">Expected Return</div>
                <div className="text-sm font-bold text-success">+{rec.expectedReturn}%</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Risk Score</div>
                <div className={`text-sm font-bold ${getRiskColor(rec.riskScore)}`}>
                  {rec.riskScore}/100
                </div>
              </div>
              <div className="flex items-end justify-end">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 text-xs border-alpha/30 hover:bg-alpha/10"
                  onClick={() => {
                    console.log('Deploying strategy:', rec.name);
                  }}
                >
                  Deploy
                </Button>
              </div>
            </div>
          </div>
        ))}

        <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Trained on 10,000+ market conditions</span>
            <span>Sharpe Ratio: 1.85</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
