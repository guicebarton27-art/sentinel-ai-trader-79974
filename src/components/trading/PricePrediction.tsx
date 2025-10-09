import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, Brain, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Prediction {
  timeframe: string;
  currentPrice: number;
  predictedPrice: number;
  confidence: number;
  direction: "up" | "down";
  change: number;
  reasoning?: string;
}

export const PricePrediction = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { toast } = useToast();

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('predict-price', {
        body: { symbol: 'BTC/USD', timeframes: ['1H', '4H', '24H'] }
      });

      if (error) throw error;

      if (data?.predictions) {
        setPredictions(data.predictions);
        setLastUpdate(new Date());
      }
    } catch (error: any) {
      console.error('Error fetching predictions:', error);
      toast({
        title: "Prediction Error",
        description: error.message || "Failed to fetch predictions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
    const interval = setInterval(fetchPredictions, 300000); // Update every 5 minutes
    return () => clearInterval(interval);
  }, []);

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
            <CardTitle className="text-lg">AI Price Predictions</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 border-algo-primary/30 text-algo-primary">
              <Activity className="h-3 w-3" />
              Live AI
            </Badge>
            <button
              onClick={fetchPredictions}
              disabled={loading}
              className="p-1 hover:bg-secondary/50 rounded transition-colors"
              title="Refresh predictions"
            >
              <RefreshCw className={`h-4 w-4 text-algo-primary ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading && predictions.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Generating AI predictions...
          </div>
        ) : predictions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No predictions available. Please fetch historical data first.
          </div>
        ) : (
          predictions.map((pred, idx) => (
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
          ))
        )}

        {lastUpdate && (
          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Model: Gemini 2.5 Flash (Google AI)</span>
            <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
