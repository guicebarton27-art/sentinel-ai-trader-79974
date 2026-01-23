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
  reasoning?: string;
}

// Authenticate user and check role
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

  // Check user role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const role = roleData?.role || 'viewer';
  if (!['admin', 'trader'].includes(role)) {
    throw new Error('Insufficient permissions. Trader or admin role required.');
  }

  return { user, role };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user and verify role
    const { user, role } = await authenticateUser(req);
    console.log(`User ${user.id} (${role}) analyzing sentiment with AI`);

    const { symbol = "BTC/USD" } = await req.json();
    
    console.log('Analyzing sentiment for:', symbol);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("AI service not configured");
    }

    const sources = ["Twitter", "Reddit", "News"];
    const sentiments: SentimentData[] = [];

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      
      // Add delay between API calls (except for the first one)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
      
      const prompt = `Analyze current market sentiment for ${symbol} from ${source} sources. Consider recent trends, community discussions, and news.

Provide your analysis in the following format:
1. Sentiment Score: A number between -1.0 (very bearish) and +1.0 (very bullish)
2. Trend: bullish, bearish, or neutral
3. Discussion Volume: estimated relative activity (low, medium, high)
4. Brief reasoning (2-3 sentences explaining the sentiment)

Be realistic about current crypto market conditions.`;

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a market sentiment analyst expert at gauging social media and news sentiment for cryptocurrency markets." },
              { role: "user", content: prompt }
            ],
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            console.error(`Rate limit hit for ${source}, skipping...`);
            continue; // Skip this source instead of throwing
          }
          if (response.status === 402) {
            throw new Error("AI service payment required");
          }
          const errorText = await response.text();
          console.error("AI gateway error:", response.status, errorText);
          continue; // Skip on other errors
        }

        const aiResponse = await response.json();
        const analysis = aiResponse.choices[0].message.content;
        
        console.log(`AI sentiment analysis for ${source}:`, analysis);

        // Parse the AI response
        const scoreMatch = analysis.match(/sentiment score[:\s]+(-?0?\.\d+|-?1\.0)/i);
        const trendMatch = analysis.match(/trend[:\s]+(bullish|bearish|neutral)/i);
        const volumeMatch = analysis.match(/volume[:\s]+(low|medium|high)/i);

        const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
        const trend = trendMatch ? trendMatch[1].toLowerCase() as "bullish" | "bearish" | "neutral" : "neutral";
        const volumeLevel = volumeMatch ? volumeMatch[1].toLowerCase() : "medium";
        
        // Convert volume level to fixed number (no random component)
        const volumeMap = { low: 500, medium: 1000, high: 2000 };
        const volume = volumeMap[volumeLevel as keyof typeof volumeMap] || 1000;

        sentiments.push({
          source,
          score,
          volume,
          trend,
          timestamp: Date.now(), // Real timestamp, no artificial stagger
          reasoning: analysis
        });
      } catch (apiError: any) {
        console.error(`Error fetching sentiment for ${source}:`, apiError);
        // Continue with next source
      }
    }
    
    if (sentiments.length === 0) {
      throw new Error("Rate limits exceeded. Please wait a few minutes before trying again.");
    }

    // Calculate aggregated sentiment
    const aggregated = sentiments.reduce((sum, s) => sum + s.score * (s.volume / 1000), 0) / sentiments.length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentiments,
        symbol,
        aggregated,
        timestamp: Date.now()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in analyze-sentiment-ai function:', error);
    
    const isAuthError = error.message?.includes('authorization') || 
                        error.message?.includes('token') || 
                        error.message?.includes('permission');
    
    return new Response(
      JSON.stringify({ error: isAuthError ? error.message : 'Failed to analyze sentiment. Please try again.' }),
      { 
        status: isAuthError ? 401 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
