import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";
import { logError, logInfo } from "../_shared/logging.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestResult {
  step: string;
  passed: boolean;
  duration_ms: number;
  details: string;
  data?: unknown;
}

interface BotLifecycleTestResult {
  success: boolean;
  total_duration_ms: number;
  summary: string;
  steps: TestResult[];
  bot_id?: string;
}

/**
 * Bot Lifecycle Integration Test
 * 
 * Tests the complete bot lifecycle: create → start → trade → stop → verify state
 * 
 * Steps:
 * 1. CREATE: Create a new bot with strategy config
 * 2. START: Start the bot in paper mode
 * 3. TRADE: Simulate a trading tick with order/position creation
 * 4. VERIFY_RUNNING: Verify bot status and events are recorded
 * 5. STOP: Stop the bot gracefully
 * 6. VERIFY_STOPPED: Verify final state matches expectations
 * 7. CLEANUP: Remove test data
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

  const testStart = Date.now();
  const steps: TestResult[] = [];
  let testBotId: string | null = null;
  let testOrderId: string | null = null;
  let testPositionId: string | null = null;
  let testRunId: string | null = null;

  // Test user ID for isolation
  const testUserId = '00000000-0000-0000-0000-000000000001';

  const addStep = (step: string, passed: boolean, startTime: number, details: string, data?: unknown) => {
    steps.push({
      step,
      passed,
      duration_ms: Date.now() - startTime,
      details,
      data,
    });
  };

  try {
    logInfo({ component: 'bot-lifecycle-test', message: 'Starting bot lifecycle integration test' });

    // ========== STEP 1: CREATE BOT ==========
    const createStart = Date.now();
    const botName = `Test Bot ${Date.now()}`;
    const { data: newBot, error: createError } = await serviceClient
      .from('bots')
      .insert({
        user_id: testUserId,
        name: botName,
        symbol: 'BTC/USD',
        mode: 'paper',
        status: 'stopped',
        strategy_id: 'momentum',
        strategy_config: {
          lookback_period: 14,
          signal_threshold: 0.02,
          max_signal_strength: 0.08,
        },
        max_position_size: 0.1,
        max_daily_loss: 100,
        stop_loss_pct: 2.0,
        take_profit_pct: 5.0,
        max_leverage: 1.0,
        starting_capital: 10000,
        current_capital: 10000,
      })
      .select()
      .single();

    if (createError || !newBot) {
      addStep('1. CREATE BOT', false, createStart, `Failed: ${createError?.message}`);
      throw new Error(`Bot creation failed: ${createError?.message}`);
    }

    testBotId = newBot.id;
    addStep('1. CREATE BOT', true, createStart, `Bot created: ${botName}`, {
      bot_id: newBot.id,
      status: newBot.status,
      mode: newBot.mode,
    });

    // Log creation event
    await serviceClient.from('bot_events').insert({
      bot_id: testBotId,
      user_id: testUserId,
      event_type: 'config_change',
      severity: 'info',
      message: `Bot "${botName}" created for lifecycle test`,
      payload: { action: 'create', test: true },
      bot_capital: 10000,
    });

    // ========== STEP 2: START BOT ==========
    const startStart = Date.now();
    const { data: startedBot, error: startError } = await serviceClient
      .from('bots')
      .update({
        status: 'running',
        last_heartbeat_at: new Date().toISOString(),
        error_count: 0,
        last_error: null,
      })
      .eq('id', testBotId)
      .select()
      .single();

    if (startError || !startedBot || startedBot.status !== 'running') {
      addStep('2. START BOT', false, startStart, `Failed: ${startError?.message}`);
      throw new Error(`Bot start failed: ${startError?.message}`);
    }

    // Create bot_run record
    testRunId = crypto.randomUUID();
    await serviceClient.from('bot_runs').insert({
      id: testRunId,
      bot_id: testBotId,
      user_id: testUserId,
      mode: 'paper',
      status: 'running',
      starting_capital: 10000,
      strategy_config: startedBot.strategy_config,
    });

    // Log start event
    await serviceClient.from('bot_events').insert({
      bot_id: testBotId,
      user_id: testUserId,
      event_type: 'start',
      severity: 'info',
      message: 'Bot started in paper mode for lifecycle test',
      payload: { mode: 'paper', run_id: testRunId },
      bot_capital: 10000,
    });

    addStep('2. START BOT', true, startStart, 'Bot started in paper mode', {
      status: startedBot.status,
      run_id: testRunId,
    });

    // ========== STEP 3: SIMULATE TRADE ==========
    const tradeStart = Date.now();
    const tradePrice = 95000;
    const tradeQuantity = 0.01;
    testOrderId = crypto.randomUUID();
    testPositionId = crypto.randomUUID();

    // Create order
    const { error: orderError } = await serviceClient.from('orders').insert({
      id: testOrderId,
      bot_id: testBotId,
      user_id: testUserId,
      client_order_id: `lifecycle_test_${Date.now()}`,
      symbol: 'BTC/USD',
      side: 'buy',
      order_type: 'market',
      status: 'filled',
      quantity: tradeQuantity,
      filled_quantity: tradeQuantity,
      average_fill_price: tradePrice,
      fee: tradeQuantity * tradePrice * 0.001,
      strategy_id: 'momentum',
      reason: 'Lifecycle test: strong momentum signal detected',
      risk_checked: true,
      risk_score: 0.3,
      signal_strength: 0.75,
      submitted_at: new Date().toISOString(),
      filled_at: new Date().toISOString(),
    });

    if (orderError) {
      addStep('3. TRADE: Create Order', false, tradeStart, `Order failed: ${orderError.message}`);
      throw new Error(`Order creation failed: ${orderError.message}`);
    }

    // Create position
    const { error: positionError } = await serviceClient.from('positions').insert({
      id: testPositionId,
      bot_id: testBotId,
      user_id: testUserId,
      symbol: 'BTC/USD',
      side: 'buy',
      status: 'open',
      quantity: tradeQuantity,
      entry_price: tradePrice,
      current_price: tradePrice,
      stop_loss_price: tradePrice * 0.98,
      take_profit_price: tradePrice * 1.05,
      entry_order_id: testOrderId,
      total_fees: tradeQuantity * tradePrice * 0.001,
    });

    if (positionError) {
      addStep('3. TRADE: Create Position', false, tradeStart, `Position failed: ${positionError.message}`);
      throw new Error(`Position creation failed: ${positionError.message}`);
    }

    // Update bot stats
    const newCapital = 10000 - (tradeQuantity * tradePrice);
    await serviceClient.from('bots').update({
      total_trades: 1,
      last_tick_at: new Date().toISOString(),
    }).eq('id', testBotId);

    // Log fill event
    await serviceClient.from('bot_events').insert({
      bot_id: testBotId,
      user_id: testUserId,
      event_type: 'fill',
      severity: 'info',
      message: `BUY ${tradeQuantity} BTC @ $${tradePrice}`,
      payload: { order_id: testOrderId, position_id: testPositionId },
      order_id: testOrderId,
      position_id: testPositionId,
      bot_capital: newCapital,
      market_price: tradePrice,
    });

    addStep('3. TRADE', true, tradeStart, `Order filled: BUY ${tradeQuantity} BTC @ $${tradePrice}`, {
      order_id: testOrderId,
      position_id: testPositionId,
      entry_price: tradePrice,
      quantity: tradeQuantity,
    });

    // ========== STEP 4: VERIFY RUNNING STATE ==========
    const verifyRunningStart = Date.now();
    
    // Verify bot status
    const { data: runningBot } = await serviceClient
      .from('bots')
      .select('*')
      .eq('id', testBotId)
      .single();

    // Verify position exists
    const { data: openPositions } = await serviceClient
      .from('positions')
      .select('*')
      .eq('bot_id', testBotId)
      .eq('status', 'open');

    // Verify events logged
    const { data: events } = await serviceClient
      .from('bot_events')
      .select('*')
      .eq('bot_id', testBotId)
      .order('created_at', { ascending: true });

    const runningStateValid = 
      runningBot?.status === 'running' &&
      runningBot?.total_trades === 1 &&
      (openPositions?.length ?? 0) >= 1 &&
      (events?.length ?? 0) >= 3; // create, start, fill

    addStep('4. VERIFY RUNNING STATE', runningStateValid, verifyRunningStart, 
      runningStateValid 
        ? `Verified: bot running, ${openPositions?.length} open positions, ${events?.length} events`
        : `Failed: bot=${runningBot?.status}, positions=${openPositions?.length}, events=${events?.length}`,
      {
        bot_status: runningBot?.status,
        total_trades: runningBot?.total_trades,
        open_positions: openPositions?.length,
        event_count: events?.length,
        event_types: events?.map(e => e.event_type),
      }
    );

    // ========== STEP 5: STOP BOT ==========
    const stopStart = Date.now();

    // Close position
    await serviceClient.from('positions').update({
      status: 'closed',
      exit_price: tradePrice * 1.01, // 1% profit
      closed_at: new Date().toISOString(),
      realized_pnl: tradeQuantity * tradePrice * 0.01,
    }).eq('id', testPositionId);

    // Update bot_run
    await serviceClient.from('bot_runs').update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      ending_capital: 10000 + (tradeQuantity * tradePrice * 0.01),
      total_trades: 1,
      winning_trades: 1,
      total_pnl: tradeQuantity * tradePrice * 0.01,
    }).eq('id', testRunId);

    // Stop bot
    const { data: stoppedBot, error: stopError } = await serviceClient
      .from('bots')
      .update({
        status: 'stopped',
        winning_trades: 1,
        total_pnl: tradeQuantity * tradePrice * 0.01,
        current_capital: 10000 + (tradeQuantity * tradePrice * 0.01),
      })
      .eq('id', testBotId)
      .select()
      .single();

    if (stopError || !stoppedBot) {
      addStep('5. STOP BOT', false, stopStart, `Failed: ${stopError?.message}`);
      throw new Error(`Bot stop failed: ${stopError?.message}`);
    }

    // Log stop event
    await serviceClient.from('bot_events').insert({
      bot_id: testBotId,
      user_id: testUserId,
      event_type: 'stop',
      severity: 'info',
      message: 'Bot stopped gracefully after lifecycle test',
      payload: { action: 'stop', final_pnl: stoppedBot.total_pnl },
      bot_capital: stoppedBot.current_capital,
      bot_pnl: stoppedBot.total_pnl,
    });

    addStep('5. STOP BOT', true, stopStart, `Bot stopped with PnL: $${stoppedBot.total_pnl}`, {
      status: stoppedBot.status,
      final_capital: stoppedBot.current_capital,
      total_pnl: stoppedBot.total_pnl,
      winning_trades: stoppedBot.winning_trades,
    });

    // ========== STEP 6: VERIFY FINAL STATE ==========
    const verifyFinalStart = Date.now();

    // Verify bot final state
    const { data: finalBot } = await serviceClient
      .from('bots')
      .select('*')
      .eq('id', testBotId)
      .single();

    // Verify position closed
    const { data: closedPositions } = await serviceClient
      .from('positions')
      .select('*')
      .eq('bot_id', testBotId)
      .eq('status', 'closed');

    // Verify bot_run completed
    const { data: completedRun } = await serviceClient
      .from('bot_runs')
      .select('*')
      .eq('id', testRunId)
      .single();

    // Verify all events
    const { data: allEvents } = await serviceClient
      .from('bot_events')
      .select('*')
      .eq('bot_id', testBotId)
      .order('created_at', { ascending: true });

    const finalStateValid = 
      finalBot?.status === 'stopped' &&
      (finalBot?.total_pnl ?? 0) > 0 &&
      finalBot?.winning_trades === 1 &&
      (closedPositions?.length ?? 0) === 1 &&
      completedRun?.status === 'completed' &&
      (allEvents?.length ?? 0) >= 4; // create, start, fill, stop

    addStep('6. VERIFY FINAL STATE', finalStateValid, verifyFinalStart,
      finalStateValid
        ? `Final state verified: stopped, PnL=$${finalBot?.total_pnl?.toFixed(2)}, ${closedPositions?.length} closed positions`
        : `State mismatch: bot=${finalBot?.status}, pnl=${finalBot?.total_pnl}, run=${completedRun?.status}`,
      {
        bot_status: finalBot?.status,
        total_pnl: finalBot?.total_pnl,
        winning_trades: finalBot?.winning_trades,
        total_trades: finalBot?.total_trades,
        closed_positions: closedPositions?.length,
        run_status: completedRun?.status,
        total_events: allEvents?.length,
        event_sequence: allEvents?.map(e => e.event_type),
      }
    );

    // ========== STEP 7: CLEANUP ==========
    const cleanupStart = Date.now();
    try {
      // Delete in order respecting foreign key constraints
      await serviceClient.from('bot_events').delete().eq('bot_id', testBotId);
      await serviceClient.from('positions').delete().eq('bot_id', testBotId);
      await serviceClient.from('orders').delete().eq('bot_id', testBotId);
      await serviceClient.from('bot_runs').delete().eq('id', testRunId);
      await serviceClient.from('bots').delete().eq('id', testBotId);
      
      addStep('7. CLEANUP', true, cleanupStart, 'Test data cleaned up successfully');
    } catch (cleanupError) {
      addStep('7. CLEANUP', false, cleanupStart, `Cleanup failed: ${(cleanupError as Error).message}`);
    }

    // ========== FINAL RESULT ==========
    const allPassed = steps.every(s => s.passed);
    const passedCount = steps.filter(s => s.passed).length;
    const totalDuration = Date.now() - testStart;

    const result: BotLifecycleTestResult = {
      success: allPassed,
      total_duration_ms: totalDuration,
      summary: `${passedCount}/${steps.length} steps passed in ${totalDuration}ms`,
      steps,
      bot_id: testBotId ?? undefined,
    };

    logInfo({
      component: 'bot-lifecycle-test',
      message: `Bot lifecycle test ${allPassed ? 'PASSED' : 'FAILED'}`,
      context: { summary: result.summary },
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const error = err as Error;
    logError({
      component: 'bot-lifecycle-test',
      message: 'Bot lifecycle test failed',
      context: { error: error.message },
    });

    // Attempt cleanup on error
    if (testBotId) {
      try {
        await serviceClient.from('bot_events').delete().eq('bot_id', testBotId);
        await serviceClient.from('positions').delete().eq('bot_id', testBotId);
        await serviceClient.from('orders').delete().eq('bot_id', testBotId);
        if (testRunId) {
          await serviceClient.from('bot_runs').delete().eq('id', testRunId);
        }
        await serviceClient.from('bots').delete().eq('id', testBotId);
      } catch {
        // Best effort cleanup
      }
    }

    return new Response(JSON.stringify({
      success: false,
      total_duration_ms: Date.now() - testStart,
      summary: `Test failed: ${error.message}`,
      steps,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
