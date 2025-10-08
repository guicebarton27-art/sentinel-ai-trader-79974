import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, AlertCircle } from "lucide-react";
import { useState } from "react";

interface ArbitrageOpportunity {
  id: string;
  path: string[];
  profitPct: number;
  volume: number;
  expires: number;
  confidence: "high" | "medium" | "low";
}

export const ArbitrageDetector = () => {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([
    {
      id: "1",
      path: ["BTC/USD", "USD/ETH", "ETH/BTC"],
      profitPct: 0.34,
      volume: 5200,
      expires: Date.now() + 45000,
      confidence: "high"
    },
    {
      id: "2",
      path: ["ETH/USD", "USD/SOL", "SOL/ETH"],
      profitPct: 0.18,
      volume: 3100,
      expires: Date.now() + 32000,
      confidence: "medium"
    }
  ]);

  const getConfidenceBadge = (confidence: string): "default" | "secondary" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      high: "default",
      medium: "secondary",
      low: "outline"
    };
    return variants[confidence] || "outline";
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Arbitrage Opportunities</h3>
        </div>
        <Badge variant="outline">
          {opportunities.length} Active
        </Badge>
      </div>

      {opportunities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No arbitrage opportunities detected</p>
        </div>
      ) : (
        <div className="space-y-4">
          {opportunities.map((opp) => (
            <div key={opp.id} className="p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-between mb-3">
                <Badge variant={getConfidenceBadge(opp.confidence)}>
                  {opp.confidence.toUpperCase()}
                </Badge>
                <span className="text-lg font-bold text-emerald-500">
                  +{opp.profitPct.toFixed(2)}%
                </span>
              </div>

              <div className="flex items-center gap-2 mb-3 text-sm">
                {opp.path.map((pair, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="font-medium">{pair}</span>
                    {idx < opp.path.length - 1 && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">
                  Volume: ${opp.volume.toLocaleString()}
                </div>
                <div className="text-muted-foreground">
                  Expires: {Math.floor((opp.expires - Date.now()) / 1000)}s
                </div>
              </div>

              <Button className="w-full mt-3" size="sm">
                Execute Arbitrage
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Scan frequency</span>
          <span className="font-medium">Every 60s</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-muted-foreground">Min profit threshold</span>
          <span className="font-medium">0.2%</span>
        </div>
      </div>
    </Card>
  );
};
