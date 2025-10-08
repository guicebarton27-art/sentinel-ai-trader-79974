import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SentimentData {
  source: string;
  score: number;
  volume: number;
  trend: "bullish" | "bearish" | "neutral";
  timestamp: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol = "BTC/USD" } = await req.json();
    
    console.log('Fetching sentiment data for:', symbol);

    // Simulated sentiment analysis (in production, would call Twitter API, Reddit API, etc.)
    // For now, we'll generate realistic data based on recent market volatility
    
    const sentiments: SentimentData[] = [
      {
        source: "Twitter",
        score: Math.random() * 0.8 - 0.2, // -0.2 to 0.6 range
        volume: Math.floor(Math.random() * 2000) + 500,
        trend: Math.random() > 0.5 ? "bullish" : "bearish",
        timestamp: Date.now()
      },
      {
        source: "Reddit",
        score: Math.random() * 0.6 - 0.3, // -0.3 to 0.3 range
        volume: Math.floor(Math.random() * 1500) + 300,
        trend: Math.random() > 0.6 ? "neutral" : (Math.random() > 0.5 ? "bullish" : "bearish"),
        timestamp: Date.now() - 300000
      },
      {
        source: "News",
        score: Math.random() * 0.4 - 0.1, // -0.1 to 0.3 range
        volume: Math.floor(Math.random() * 300) + 50,
        trend: Math.random() > 0.7 ? "neutral" : (Math.random() > 0.5 ? "bullish" : "bearish"),
        timestamp: Date.now() - 600000
      }
    ];

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentiments,
        symbol,
        aggregated: sentiments.reduce((sum, s) => sum + s.score * (s.volume / 1000), 0) / sentiments.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error fetching sentiment data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
