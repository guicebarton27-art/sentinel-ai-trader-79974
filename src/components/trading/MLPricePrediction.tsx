import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, RefreshCw, Brain, Target, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface Prediction {
  horizon: string;
  prediction_value: {
    price: number;
    direction: string;
    change_percent: number;
    support: number;
    resistance: number;
    volatility: string;
    factors: string;
  };
  confidence: number;
}

export const MLPricePrediction = ({ symbol = 'BTC/USD' }) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [marketData, setMarketData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { toast } = useToast();

  const fetchPredictions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ml-price-prediction', {
        body: { symbol, horizons: ['1H', '4H', '24H', '7D'] }
      });

      if (error) throw error;

      setPredictions(data.predictions || []);
      setMarketData(data.market_data);
      setLastUpdate(new Date());
      
      toast({
        title: "ML Predictions Updated",
        description: `Generated ${data.predictions?.length || 0} multi-horizon predictions`,
      });
    } catch (error: any) {
      console.error('Prediction error:', error);
      toast({
        title: "Prediction Failed",
        description: error.message || "Failed to generate predictions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
    const interval = setInterval(fetchPredictions, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [symbol]);

  const getDirectionIcon = (direction: string) => {
    if (direction === 'up') return <TrendingUp className="h-4 w-4 text-success" />;
    if (direction === 'down') return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <span className="h-4 w-4">→</span>;
  };

  const getVolatilityColor = (vol: string) => {
    if (vol === 'high') return 'bg-destructive/10 text-destructive border-destructive/20';
    if (vol === 'low') return 'bg-success/10 text-success border-success/20';
    return 'bg-warning/10 text-warning border-warning/20';
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>ML Price Predictions</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPredictions}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          Multi-model ensemble predictions (TFT + N-BEATS + LSTM)
          {lastUpdate && (
            <span className="text-xs ml-2">
              Updated: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {marketData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg border bg-card/50">
            <div>
              <div className="text-xs text-muted-foreground">Current Price</div>
              <div className="text-sm font-semibold">${marketData.current_price?.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Volatility</div>
              <div className="text-sm font-semibold">{(marketData.volatility * 100)?.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">RSI(14)</div>
              <div className="text-sm font-semibold">{marketData.rsi?.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Sentiment</div>
              <div className="text-sm font-semibold">{marketData.sentiment?.toFixed(2)}</div>
            </div>
          </div>
        )}

        {predictions.length > 0 ? (
          <div className="space-y-3">
            {predictions.map((pred, idx) => (
              <div
                key={idx}
                className="p-4 rounded-lg border bg-card/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {pred.horizon}
                    </Badge>
                    {getDirectionIcon(pred.prediction_value.direction)}
                    <span className="font-semibold">
                      ${pred.prediction_value.price?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${
                      pred.prediction_value.change_percent > 0 ? 'text-success' : 'text-destructive'
                    }`}>
                      {pred.prediction_value.change_percent > 0 ? '+' : ''}
                      {pred.prediction_value.change_percent?.toFixed(2)}%
                    </span>
                    <Badge variant="outline" className={getVolatilityColor(pred.prediction_value.volatility)}>
                      {pred.prediction_value.volatility} vol
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3 w-3 text-success" />
                    <span className="text-muted-foreground">Support:</span>
                    <span className="font-medium">${pred.prediction_value.support?.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-3 w-3 text-destructive" />
                    <span className="text-muted-foreground">Resistance:</span>
                    <span className="font-medium">${pred.prediction_value.resistance?.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Confidence</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pred.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium">
                      {(pred.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {pred.prediction_value.factors && (
                  <p className="text-xs text-muted-foreground pt-2 border-t">
                    {pred.prediction_value.factors.substring(0, 150)}...
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {loading ? "Generating ML predictions..." : "No predictions available"}
          </div>
        )}

        <div className="pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Brain className="h-3 w-3" />
            <span>Ensemble: Temporal Fusion Transformer + N-BEATS + LSTM</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
