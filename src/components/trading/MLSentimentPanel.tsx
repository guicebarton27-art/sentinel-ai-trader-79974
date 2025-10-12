import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface SentimentData {
  source: string;
  sentiment_score: number;
  confidence: number;
  trend: string;
  volume: number;
}

export const MLSentimentPanel = () => {
  const [sentiments, setSentiments] = useState<SentimentData[]>([]);
  const [aggregated, setAggregated] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { toast } = useToast();

  const fetchSentiment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ml-sentiment-analysis', {
        body: { symbol: 'BTC/USD', sources: ['twitter', 'reddit', 'news'] }
      });

      if (error) throw error;

      setSentiments(data.sentiment_data || []);
      setAggregated(data.aggregated);
      setLastUpdate(new Date());
      
      toast({
        title: "Sentiment Analysis Complete",
        description: `Analyzed ${data.sentiment_data?.length || 0} sources`,
      });
    } catch (error: any) {
      console.error('Sentiment analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze sentiment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSentiment();
    const interval = setInterval(fetchSentiment, 10 * 60 * 1000); // Every 10 minutes
    return () => clearInterval(interval);
  }, []);

  const getSentimentIcon = (score: number) => {
    if (score > 0.2) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (score < -0.2) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-yellow-500" />;
  };

  const getSentimentColor = (score: number) => {
    if (score > 0.2) return "bg-green-500/10 text-green-600 border-green-500/20";
    if (score < -0.2) return "bg-red-500/10 text-red-600 border-red-500/20";
    return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>ML Sentiment Analysis</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSentiment}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          AI-powered multi-source sentiment analysis
          {lastUpdate && (
            <span className="text-xs ml-2">
              Updated: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {aggregated && (
          <div className="p-4 rounded-lg border bg-card/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Aggregated Sentiment</span>
              <Badge variant="outline" className={getSentimentColor(aggregated.sentiment_score)}>
                {aggregated.trend.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Score</span>
                  <span className="font-mono">{aggregated.sentiment_score.toFixed(2)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      aggregated.sentiment_score > 0 ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{
                      width: `${Math.abs(aggregated.sentiment_score) * 100}%`,
                      marginLeft: aggregated.sentiment_score < 0 ? 'auto' : '0',
                    }}
                  />
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Confidence</div>
                <div className="text-sm font-medium">
                  {(aggregated.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {sentiments.length > 0 ? (
          <div className="space-y-2">
            {sentiments.map((sentiment, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg border bg-card/30"
              >
                <div className="flex items-center gap-3">
                  {getSentimentIcon(sentiment.sentiment_score)}
                  <div>
                    <div className="font-medium capitalize">{sentiment.source}</div>
                    <div className="text-xs text-muted-foreground">
                      Volume: {sentiment.volume} | 
                      Confidence: {(sentiment.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-medium">
                    {sentiment.sentiment_score > 0 ? '+' : ''}
                    {sentiment.sentiment_score.toFixed(2)}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {sentiment.trend}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {loading ? "Analyzing market sentiment..." : "No sentiment data available"}
          </div>
        )}

        <div className="pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Brain className="h-3 w-3" />
            <span>Powered by Gemini 2.5 Flash AI Model</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};