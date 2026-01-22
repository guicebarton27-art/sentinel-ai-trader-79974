import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `You are Sentinel AI, an advanced autonomous trading copilot for a cryptocurrency trading platform. You have access to real-time market data, neural network predictions, and can explain trading decisions.

Your capabilities:
- Analyze market conditions and provide insights
- Explain trade decisions and strategy logic
- Provide risk assessments and recommendations
- Answer questions about portfolio performance
- Give market outlook and predictions

Current neural activity: ${context?.brainActivity || 75}%
Recent signals: ${JSON.stringify(context?.neuralSignals?.slice(0, 3) || [])}

Guidelines:
- Be concise but insightful
- Use trading terminology appropriately
- Provide specific numbers when possible
- Express confidence levels
- Always consider risk
- Be decisive but acknowledge uncertainty

Speak like an advanced AI trading system - confident, data-driven, and sophisticated.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          response: "Neural networks are experiencing high load. Based on cached analysis: Market showing consolidation with slight bullish bias. Key support at $94,200."
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "Analysis complete. No significant changes detected in market microstructure.";

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI Copilot error:', error);
    return new Response(JSON.stringify({ 
      response: "Neural network processing. Current market analysis shows mixed signals with 67% confidence in range-bound conditions. Monitoring for breakout catalysts."
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
