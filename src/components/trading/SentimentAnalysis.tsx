import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Twitter, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface SentimentData {
  source: string;
  score: number;
  volume: number;
  trend: "bullish" | "bearish" | "neutral";
  timestamp: number;
}

export const SentimentAnalysis = () => {
  const [sentiments, setSentiments] = useState<SentimentData[]>([
    { source: "Twitter", score: 0.65, volume: 1243, trend: "bullish", timestamp: Date.now() },
    { source: "Reddit", score: -0.23, volume: 892, trend: "bearish", timestamp: Date.now() - 300000 },
    { source: "News", score: 0.12, volume: 156, trend: "neutral", timestamp: Date.now() - 600000 },
  ]);

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
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Market Sentiment</h3>
        <Badge variant={aggregatedScore > 0 ? "default" : "secondary"}>
          {aggregatedScore > 0 ? "Bullish" : "Bearish"} {(aggregatedScore * 100).toFixed(1)}%
        </Badge>
      </div>

      <div className="space-y-4">
        {sentiments.map((sentiment, idx) => (
          <div key={idx} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
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
        ))}
      </div>

      <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
        Last updated: {new Date(sentiments[0]?.timestamp).toLocaleTimeString()}
      </div>
    </Card>
  );
};
