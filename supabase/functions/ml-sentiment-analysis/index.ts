import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    console.log(`User ${user.id} (${role}) requesting ML sentiment analysis`);

    const { symbol = 'BTC/USD', sources = ['twitter', 'reddit', 'news'] } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!LOVABLE_API_KEY) {
      throw new Error('AI service not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log(`Analyzing sentiment for ${symbol} across ${sources.length} sources`);
    
    const sentimentResults = [];
    const timestamp = Date.now();

    // Analyze sentiment for each source using Lovable AI
    for (const source of sources) {
      try {
        const prompt = `Analyze current market sentiment for ${symbol} from ${source} sources.
        
Consider recent trends, community discussions, news headlines, and overall market mood.
Provide your analysis in this exact format:

1. Sentiment Score: [number between -1 (very bearish) and +1 (very bullish)]
2. Trend: [bullish/bearish/neutral]
3. Discussion Volume: [low/medium/high]
4. Confidence: [0.0 to 1.0]
5. Brief Reasoning: [2-3 sentences explaining the sentiment]

Be realistic and data-driven in your assessment.`;

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a crypto market sentiment analyst providing accurate, data-driven sentiment analysis.' },
              { role: 'user', content: prompt }
            ],
          }),
        });

        let analysis = '';
        let usedFallback = false;

        if (!response.ok) {
          if (response.status === 429) {
            console.log(`Rate limited for ${source}, skipping - no fake data generated`);
            // Skip this source entirely - don't generate fake sentiment
            continue;
          } else if (response.status === 402) {
            console.error(`Payment required for ${source}, skipping...`);
            continue;
          } else {
            console.error(`AI API error for ${source}: ${response.status} - skipping`);
            continue;
          }
        } else {
          const data = await response.json();
          analysis = data.choices[0].message.content;
        }
        
        console.log(`AI sentiment analysis for ${source}:`, usedFallback ? '(fallback)' : '(AI)', analysis.slice(0, 100));

        // Parse the AI response
        const scoreMatch = analysis.match(/Sentiment Score[:\s]+(-?[0-9.]+)/i);
        const trendMatch = analysis.match(/Trend[:\s]+(bullish|bearish|neutral)/i);
        const volumeMatch = analysis.match(/Discussion Volume[:\s]+(low|medium|high)/i);
        const confidenceMatch = analysis.match(/Confidence[:\s]+([0-9.]+)/i);
        const reasoningMatch = analysis.match(/Brief Reasoning[:\s]+(.+)/is);

        const sentimentScore = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
        const trend = trendMatch ? trendMatch[1].toLowerCase() : 'neutral';
        const volume = volumeMatch ? volumeMatch[1].toLowerCase() : 'medium';
        const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.7;
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : analysis;

        const volumeMap = { low: 100, medium: 500, high: 1000 };

        const sentimentData = {
          symbol,
          source,
          model_used: 'gemini-2.5-flash',
          sentiment_score: sentimentScore,
          confidence,
          volume: volumeMap[volume as keyof typeof volumeMap],
          trend,
          raw_data: { analysis, reasoning },
          timestamp: Math.floor(timestamp / 1000),
        };

        sentimentResults.push(sentimentData);

        // Store in database
        const { error: insertError } = await supabase
          .from('sentiment_data')
          .insert(sentimentData);

        if (insertError) {
          console.error(`Error storing ${source} sentiment:`, insertError);
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error analyzing ${source}:`, error);
        continue;
      }
    }

    // Calculate aggregated sentiment
    const avgSentiment = sentimentResults.length > 0
      ? sentimentResults.reduce((sum, s) => sum + s.sentiment_score, 0) / sentimentResults.length
      : 0;

    const avgConfidence = sentimentResults.length > 0
      ? sentimentResults.reduce((sum, s) => sum + s.confidence, 0) / sentimentResults.length
      : 0;

    return new Response(
      JSON.stringify({
        symbol,
        sentiment_data: sentimentResults,
        aggregated: {
          sentiment_score: avgSentiment,
          confidence: avgConfidence,
          trend: avgSentiment > 0.2 ? 'bullish' : avgSentiment < -0.2 ? 'bearish' : 'neutral',
          sources_analyzed: sentimentResults.length,
        },
        timestamp,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Error in ML sentiment analysis:', error);
    
    const isAuthError = error.message?.includes('authorization') || 
                        error.message?.includes('token') || 
                        error.message?.includes('permission');
    
    return new Response(
      JSON.stringify({ error: isAuthError ? error.message : 'Failed to analyze sentiment. Please try again.' }),
      { status: isAuthError ? 401 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
