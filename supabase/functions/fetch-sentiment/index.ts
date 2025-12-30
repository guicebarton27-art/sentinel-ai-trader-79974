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

  return { user };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const { user } = await authenticateUser(req);
    console.log(`User ${user.id} fetching sentiment data`);

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
