import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, Brain } from "lucide-react";
import { useEffect, useState } from "react";

interface Prediction {
  timeframe: string;
  currentPrice: number;
  predictedPrice: number;
  confidence: number;
  direction: "up" | "down";
  change: number;
}

export const PricePrediction = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([
    { timeframe: "1H", currentPrice: 42350.25, predictedPrice: 42580.50, confidence: 0.82, direction: "up", change: 0.54 },
    { timeframe: "4H", currentPrice: 42350.25, predictedPrice: 43120.75, confidence: 0.76, direction: "up", change: 1.82 },
    { timeframe: "24H", currentPrice: 42350.25, predictedPrice: 41890.00, confidence: 0.68, direction: "down", change: -1.09 }
  ]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.75) return "text-success";
    if (confidence >= 0.6) return "text-warning";
    return "text-muted-foreground";
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.75) return "default";
    if (confidence >= 0.6) return "secondary";
    return "outline";
  };

  return (
    <Card className="bg-gradient-to-br from-card via-card to-card/50 border-algo-primary/20 shadow-quant">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-algo-primary" />
            <CardTitle className="text-lg">LSTM Price Predictions</CardTitle>
          </div>
          <Badge variant="outline" className="gap-1 border-algo-primary/30 text-algo-primary">
            <Activity className="h-3 w-3" />
            Live
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {predictions.map((pred, idx) => (
          <div 
            key={idx} 
            className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-secondary/50 to-secondary/30 border border-border/50 hover:border-algo-primary/30 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-algo-primary/10 border border-algo-primary/20">
                <span className="text-xs font-bold text-algo-primary">{pred.timeframe}</span>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Predicted Price</div>
                <div className="text-lg font-bold flex items-center gap-2">
                  ${pred.predictedPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  {pred.direction === "up" ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-error" />
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <Badge 
                variant={getConfidenceBadge(pred.confidence)}
                className={getConfidenceColor(pred.confidence)}
              >
                {(pred.confidence * 100).toFixed(0)}% confidence
              </Badge>
              <span className={`text-sm font-semibold ${pred.direction === "up" ? "text-success" : "text-error"}`}>
                {pred.change > 0 ? "+" : ""}{pred.change.toFixed(2)}%
              </span>
            </div>
          </div>
        ))}

        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
          <span>Model: LSTM Neural Network</span>
          <span>Last trained: 2h ago</span>
        </div>
      </CardContent>
    </Card>
  );
};
