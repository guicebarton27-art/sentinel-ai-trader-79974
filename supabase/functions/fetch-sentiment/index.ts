import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  confidence: number;
}

// Authenticate user
async function authenticateUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing authorization header');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  return { user, supabase };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const { user, supabase } = await authenticateUser(req);
    console.log(`User ${user.id} fetching sentiment data`);

    const { symbol = "BTC/USD" } = await req.json();
    
    console.log('Fetching sentiment data for:', symbol);

    // First, try to get real sentiment data from the database
    const { data: dbSentiment, error: dbError } = await supabase
      .from('sentiment_data')
      .select('*')
      .eq('symbol', symbol.replace('/', ''))
      .order('timestamp', { ascending: false })
      .limit(10);

    let sentiments: SentimentData[] = [];

    if (dbSentiment && dbSentiment.length > 0) {
      // Use real data from database
      console.log(`Found ${dbSentiment.length} sentiment records in database`);
      
      // Aggregate by source
      const sourceMap = new Map<string, { scores: number[], volumes: number[], confidence: number[], latest: number }>();
      
      for (const record of dbSentiment) {
        const source = record.source || 'aggregate';
        if (!sourceMap.has(source)) {
          sourceMap.set(source, { scores: [], volumes: [], confidence: [], latest: record.timestamp });
        }
        const entry = sourceMap.get(source)!;
        entry.scores.push(record.sentiment_score);
        entry.volumes.push(record.volume || 0);
        entry.confidence.push(record.confidence || 0.5);
      }
      
      for (const [source, data] of sourceMap) {
        const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        const totalVolume = data.volumes.reduce((a, b) => a + b, 0);
        const avgConfidence = data.confidence.reduce((a, b) => a + b, 0) / data.confidence.length;
        
        let trend: "bullish" | "bearish" | "neutral" = "neutral";
        if (avgScore > 0.2) trend = "bullish";
        else if (avgScore < -0.2) trend = "bearish";
        
        sentiments.push({
          source: source.charAt(0).toUpperCase() + source.slice(1),
          score: Math.round(avgScore * 100) / 100,
          volume: totalVolume,
          trend,
          timestamp: data.latest * 1000,
          confidence: Math.round(avgConfidence * 100) / 100
        });
      }
    } else {
      // No DB data - invoke ML sentiment analysis to get fresh data
      console.log('No sentiment data in DB, invoking ML sentiment analysis...');
      
      try {
        const { data: mlData, error: mlError } = await supabase.functions.invoke('ml-sentiment-analysis', {
          body: { symbol, sources: ['twitter', 'reddit', 'news'] }
        });
        
        if (mlError) throw mlError;
        
        if (mlData?.sentiment) {
          sentiments = mlData.sentiment.sources?.map((s: any) => ({
            source: s.name || 'Unknown',
            score: s.score || 0,
            volume: s.volume || 0,
            trend: s.score > 0.2 ? 'bullish' : s.score < -0.2 ? 'bearish' : 'neutral',
            timestamp: Date.now(),
            confidence: s.confidence || 0.5
          })) || [];
        }
      } catch (mlErr) {
        console.error('ML sentiment failed, using market-derived sentiment:', mlErr);
        
        // Fallback: derive sentiment from market data
        const krakenUrl = `https://api.kraken.com/0/public/Ticker?pair=${symbol.replace('/', '')}`;
        const marketRes = await fetch(krakenUrl);
        const marketData = await marketRes.json();
        
        if (marketData.result) {
          const ticker = Object.values(marketData.result)[0] as any;
          const price = parseFloat(ticker.c?.[0] || 0);
          const open = parseFloat(ticker.o || price);
          const volume = parseFloat(ticker.v?.[1] || 0);
          
          const change = (price - open) / open;
          const trend = change > 0.01 ? 'bullish' : change < -0.01 ? 'bearish' : 'neutral';
          
          sentiments = [
            {
              source: 'Market',
              score: Math.round(change * 10 * 100) / 100, // Scale change to -1 to 1
              volume: Math.round(volume),
              trend: trend as "bullish" | "bearish" | "neutral",
              timestamp: Date.now(),
              confidence: 0.85
            }
          ];
        }
      }
    }

    // Calculate aggregated sentiment score
    const aggregated = sentiments.length > 0
      ? sentiments.reduce((sum, s) => sum + s.score * (s.confidence || 0.5), 0) / sentiments.length
      : 0;

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentiments,
        symbol,
        aggregated: Math.round(aggregated * 100) / 100,
        source: dbSentiment && dbSentiment.length > 0 ? 'database' : 'live',
        recordCount: sentiments.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error fetching sentiment data:', error);
    
    const isAuthError = error.message?.includes('authorization') || 
                        error.message?.includes('token');
    
    return new Response(
      JSON.stringify({ error: isAuthError ? error.message : 'Failed to fetch sentiment data. Please try again.' }),
      { 
        status: isAuthError ? 401 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
