import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Twitter, MessageCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SentimentData {
  source: string;
  score: number;
  volume: number;
  trend: "bullish" | "bearish" | "neutral";
  timestamp: number;
}

export const SentimentAnalysis = () => {
  const [sentiments, setSentiments] = useState<SentimentData[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchSentiment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-sentiment-ai', {
        body: { symbol: 'BTC/USD' }
      });

      if (error) throw error;
      
      if (data.success) {
        setSentiments(data.sentiments);
      }
    } catch (error: any) {
      toast({
        title: "Error fetching sentiment",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Delay initial fetch to stagger with price predictions
    const timer = setTimeout(fetchSentiment, 2000);
    const interval = setInterval(fetchSentiment, 600000); // Refresh every 10 minutes to reduce API calls
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const getSentimentIcon = (trend: string) => {
    switch (trend) {
      case "bullish": return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case "bearish": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "Twitter": return <Twitter className="h-4 w-4" />;
      case "Reddit": return <MessageCircle className="h-4 w-4" />;
      default: return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getSentimentColor = (score: number) => {
    if (score > 0.3) return "text-emerald-500";
    if (score < -0.3) return "text-red-500";
    return "text-muted-foreground";
  };

  const aggregatedScore = sentiments.reduce((sum, s) => sum + s.score * (s.volume / 1000), 0) / sentiments.length;

  return (
    <Card className="bg-gradient-to-br from-card via-card to-success/5 border-success/20 shadow-performance">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-success" />
            AI Market Sentiment
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={aggregatedScore > 0 ? "default" : "secondary"} className="bg-success/20 text-success border-success/30">
              {aggregatedScore > 0 ? "Bullish" : "Bearish"} {(aggregatedScore * 100).toFixed(1)}%
            </Badge>
            <RefreshCw 
              className={`h-4 w-4 text-muted-foreground cursor-pointer hover:text-success transition-colors ${loading ? 'animate-spin' : ''}`}
              onClick={fetchSentiment}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>

        <div className="space-y-3">
          {loading && sentiments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Loading sentiment data...</div>
          ) : sentiments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No sentiment data available</div>
          ) : (
            sentiments.map((sentiment, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-secondary/60 to-secondary/30 border border-border/50 hover:border-success/30 transition-all">
                <div className="flex items-center gap-3">
                  {getSourceIcon(sentiment.source)}
                  <div>
                    <div className="font-medium">{sentiment.source}</div>
                    <div className="text-sm text-muted-foreground">
                      {sentiment.volume.toLocaleString()} mentions
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-semibold ${getSentimentColor(sentiment.score)}`}>
                    {(sentiment.score * 100).toFixed(0)}%
                  </span>
                  {getSentimentIcon(sentiment.trend)}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
          {sentiments.length > 0 && (
            <span>Last updated: {new Date(sentiments[0]?.timestamp).toLocaleTimeString()}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
