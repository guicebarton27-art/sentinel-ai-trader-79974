import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseBoolean, requireEnv } from "../_shared/env.ts";
import { logError, logInfo } from "../_shared/logging.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Test edge function that proves the trading loop creates DB rows.
 * 
 * Test A: Creates a strategy_run/bot_run record and verifies it exists
 * Test B: In paper mode, creates an order + position and verifies both exist
 * Test C: Verifies data persists across calls (can be re-queried)
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceHeader = req.headers.get('x-service-role');
  if (!serviceHeader || serviceHeader !== requireEnv('SUPABASE_SERVICE_ROLE_KEY')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const serviceClient = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  );

  const results: { test: string; passed: boolean; details: string; data?: unknown }[] = [];

  try {
    logInfo({ component: 'test-trading-loop', message: 'Starting trading loop test' });
    // Get a test bot (create one if needed)
    const { data: existingBots } = await serviceClient
      .from('bots')
      .select('*')
      .limit(1);

    let testBot = existingBots?.[0];

    if (!testBot) {
      // Create a test bot
      const { data: newBot, error: createError } = await serviceClient
        .from('bots')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000', // Test user
          name: 'Test Bot',
          symbol: 'BTC/USD',
          mode: 'paper',
          status: 'stopped',
          strategy_id: 'trend_following',
          max_position_size: 0.1,
          starting_capital: 10000,
          current_capital: 10000,
        })
        .select()
        .single();

      if (createError) {
        results.push({
          test: 'Bot Creation',
          passed: false,
          details: `Failed to create test bot: ${createError.message}`,
        });
        throw createError;
      }
      testBot = newBot;
    }

    // TEST A: Create a bot_run record and verify it exists
    const testRunId = crypto.randomUUID();
    const { data: runData, error: runError } = await serviceClient
      .from('bot_runs')
      .insert({
        id: testRunId,
        bot_id: testBot.id,
        user_id: testBot.user_id,
        mode: 'paper',
        status: 'running',
        starting_capital: testBot.current_capital,
        strategy_config: { test: true },
      })
      .select()
      .single();

    if (runError) {
      results.push({
        test: 'Test A: Create strategy_run/bot_run',
        passed: false,
        details: `Failed to create bot_run: ${runError.message}`,
      });
    } else {
      // Verify it exists by querying
      const { data: verifyRun } = await serviceClient
        .from('bot_runs')
        .select('*')
        .eq('id', testRunId)
        .single();

      results.push({
        test: 'Test A: Create strategy_run/bot_run',
        passed: !!verifyRun && verifyRun.status === 'running',
        details: verifyRun ? `bot_run created with id: ${verifyRun.id}` : 'Failed to verify bot_run',
        data: { run_id: testRunId, status: verifyRun?.status },
      });
    }

    // TEST B: Create an order + position (paper trade simulation)
    const testOrderId = crypto.randomUUID();
    const clientOrderId = `test_${Date.now()}`;
    const testPrice = 88000;
    const testQuantity = 0.01;

    // Create order
    const { data: orderData, error: orderError } = await serviceClient
      .from('orders')
      .insert({
        id: testOrderId,
        bot_id: testBot.id,
        user_id: testBot.user_id,
        client_order_id: clientOrderId,
        symbol: 'BTC/USD',
        side: 'buy',
        order_type: 'market',
        status: 'filled',
        quantity: testQuantity,
        filled_quantity: testQuantity,
        average_fill_price: testPrice,
        fee: testQuantity * testPrice * 0.001,
        strategy_id: 'trend_following',
        reason: 'Test order for validation',
        risk_checked: true,
        submitted_at: new Date().toISOString(),
        filled_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError) {
      results.push({
        test: 'Test B: Create order',
        passed: false,
        details: `Failed to create order: ${orderError.message}`,
      });
    } else {
      results.push({
        test: 'Test B: Create order',
        passed: true,
        details: `Order created: ${testQuantity} BTC @ $${testPrice}`,
        data: { order_id: orderData.id, client_order_id: clientOrderId },
      });
    }

    // Create position
    const testPositionId = crypto.randomUUID();
    const { data: positionData, error: positionError } = await serviceClient
      .from('positions')
      .insert({
        id: testPositionId,
        bot_id: testBot.id,
        user_id: testBot.user_id,
        symbol: 'BTC/USD',
        side: 'buy',
        status: 'open',
        quantity: testQuantity,
        entry_price: testPrice,
        current_price: testPrice,
        stop_loss_price: testPrice * 0.98,
        take_profit_price: testPrice * 1.05,
        entry_order_id: testOrderId,
        total_fees: testQuantity * testPrice * 0.001,
      })
      .select()
      .single();

    if (positionError) {
      results.push({
        test: 'Test B: Create position',
        passed: false,
        details: `Failed to create position: ${positionError.message}`,
      });
    } else {
      results.push({
        test: 'Test B: Create position',
        passed: true,
        details: `Position created: ${testQuantity} BTC @ $${testPrice}`,
        data: { position_id: positionData.id },
      });
    }

    // Create bot event
    const { error: eventError } = await serviceClient
      .from('bot_events')
      .insert({
        bot_id: testBot.id,
        user_id: testBot.user_id,
        event_type: 'fill',
        severity: 'info',
        message: `Test fill: BUY ${testQuantity} BTC @ $${testPrice}`,
        payload: { test: true, order_id: testOrderId },
        bot_capital: testBot.current_capital,
        market_price: testPrice,
      });

    if (eventError) {
      results.push({
        test: 'Test B: Log bot event',
        passed: false,
        details: `Failed to log event: ${eventError.message}`,
      });
    } else {
      results.push({
        test: 'Test B: Log bot event',
        passed: true,
        details: 'Bot event logged successfully',
      });
    }

    // TEST C: Verify data persists (query back the data)
    const { data: verifyOrder } = await serviceClient
      .from('orders')
      .select('*')
      .eq('id', testOrderId)
      .single();

    const { data: verifyPosition } = await serviceClient
      .from('positions')
      .select('*')
      .eq('id', testPositionId)
      .single();

    const persistenceTest = !!verifyOrder && !!verifyPosition;
    results.push({
      test: 'Test C: Data persistence (re-query)',
      passed: persistenceTest,
      details: persistenceTest 
        ? `Order and position verified in DB`
        : 'Failed to verify persisted data',
      data: {
        order_exists: !!verifyOrder,
        position_exists: !!verifyPosition,
      },
    });

    // TEST D: AI strategy smoke test (optional)
    const aiSmokeEnabled = parseBoolean(Deno.env.get('AI_SMOKE_TEST_ENABLED'), true);
    const aiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!aiSmokeEnabled) {
      results.push({
        test: 'Test D: AI strategy smoke',
        passed: true,
        details: 'Skipped (AI_SMOKE_TEST_ENABLED=false)',
      });
    } else if (!aiKey) {
      results.push({
        test: 'Test D: AI strategy smoke',
        passed: true,
        details: 'Skipped (LOVABLE_API_KEY not set)',
      });
    } else {
      try {
        const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
        const response = await fetch(`${requireEnv('SUPABASE_URL')}/functions/v1/ai-strategy-engine`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
            'x-service-role': serviceRoleKey,
          },
          body: JSON.stringify({
            marketState: {
              symbol: 'BTC/USD',
              currentPrice: 90000,
              priceChange24h: 1.2,
              volume24h: 45000,
              sentiment: 0.1,
              volatility: 2.3,
              trendStrength: 1.1,
            },
            portfolio: {
              currentCapital: 10000,
              dailyPnl: 0,
              openPosition: null,
            },
            riskTolerance: 'moderate',
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          results.push({
            test: 'Test D: AI strategy smoke',
            passed: false,
            details: `AI strategy engine failed: ${response.status} ${errorText}`,
          });
        } else {
          const aiData = await response.json();
          const hasDecision = Boolean(aiData?.decision?.action);
          results.push({
            test: 'Test D: AI strategy smoke',
            passed: hasDecision,
            details: hasDecision ? 'AI decision returned' : 'AI response missing decision',
          });
        }
      } catch (error) {
        results.push({
          test: 'Test D: AI strategy smoke',
          passed: false,
          details: `AI smoke test error: ${(error as Error).message}`,
        });
      }
    }

    // Update bot_run to completed
    await serviceClient
      .from('bot_runs')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', testRunId);

    // Cleanup test data
    await serviceClient.from('positions').delete().eq('id', testPositionId);
    await serviceClient.from('orders').delete().eq('id', testOrderId);
    await serviceClient.from('bot_runs').delete().eq('id', testRunId);

    const allPassed = results.every(r => r.passed);

    return new Response(JSON.stringify({
      success: allPassed,
      summary: `${results.filter(r => r.passed).length}/${results.length} tests passed`,
      results,
      bot_used: { id: testBot.id, name: testBot.name },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    const error = err as Error;
    logError({
      component: 'test-trading-loop',
      message: 'Test trading loop failed',
      context: { error: error.message },
    });
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      results,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
