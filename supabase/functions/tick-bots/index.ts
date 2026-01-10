import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function is called by a cron job to tick all running bots
// It reads bot state from DB, executes strategy logic, and places orders

interface Bot {
  id: string;
  user_id: string;
  status: string;
  mode: 'paper' | 'live';
  symbol: string;
  strategy_id: string;
  strategy_config: Record<string, unknown>;
  max_position_size: number;
  max_daily_loss: number;
  stop_loss_pct: number;
  take_profit_pct: number;
  current_capital: number;
  daily_pnl: number;
  total_pnl: number;
  total_trades: number;
  winning_trades: number;
  error_count: number;
  api_key_id: string | null;
}

interface Position {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  entry_price: number;
  stop_loss_price: number | null;
  take_profit_price: number | null;
  total_fees: number;
}

interface MarketData {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume_24h: number;
  change_24h: number;
}

// Get service client for server-side operations
function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

// Fetch real market data from Kraken public API
async function fetchMarketData(symbol: string): Promise<MarketData> {
  try {
    // Convert symbol format (BTC/USD -> XXBTZUSD)
    const krakenSymbol = symbol.replace('BTC', 'XBT').replace('/', '');
    const response = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${krakenSymbol}`);
    const data = await response.json();
    
    if (data.error && data.error.length > 0) {
      throw new Error(data.error[0]);
    }

    const pairData = Object.values(data.result)[0] as {
      a: string[];
      b: string[];
      c: string[];
      v: string[];
      p: string[];
    };

    return {
      symbol,
      price: parseFloat(pairData.c[0]),
      bid: parseFloat(pairData.b[0]),
      ask: parseFloat(pairData.a[0]),
      volume_24h: parseFloat(pairData.v[1]),
      change_24h: parseFloat(pairData.p[1]),
    };
  } catch (error) {
    console.error('Error fetching market data:', error);
    // Return simulated data as fallback
    const basePrice = 95000 + Math.random() * 1000;
    return {
      symbol,
      price: basePrice,
      bid: basePrice - 10,
      ask: basePrice + 10,
      volume_24h: 50000,
      change_24h: (Math.random() - 0.5) * 5,
    };
  }
}

// Simple strategy calculations
function calculateSignal(
  strategyId: string,
  marketData: MarketData,
  _position: Position | null,
  _config: Record<string, unknown>
): { action: 'buy' | 'sell' | 'hold'; strength: number; reason: string } {
  // Trend following strategy (simplified)
  if (strategyId === 'trend_following') {
    const change = marketData.change_24h;
    if (change > 2) {
      return { action: 'buy', strength: Math.min(change / 5, 1), reason: 'Strong upward trend' };
    } else if (change < -2) {
      return { action: 'sell', strength: Math.min(Math.abs(change) / 5, 1), reason: 'Strong downward trend' };
    }
  }

  // Mean reversion strategy
  if (strategyId === 'mean_reversion') {
    const change = marketData.change_24h;
    if (change > 3) {
      return { action: 'sell', strength: Math.min(change / 5, 1), reason: 'Overbought - expecting reversion' };
    } else if (change < -3) {
      return { action: 'buy', strength: Math.min(Math.abs(change) / 5, 1), reason: 'Oversold - expecting reversion' };
    }
  }

  return { action: 'hold', strength: 0, reason: 'No clear signal' };
}

// Check risk limits before placing order
function checkRiskLimits(
  bot: Bot,
  _position: Position | null,
  orderSize: number,
  _orderSide: 'buy' | 'sell',
  currentPrice: number
): { allowed: boolean; flags: string[] } {
  const flags: string[] = [];

  // Check daily loss limit
  if (bot.daily_pnl < -bot.max_daily_loss) {
    flags.push('DAILY_LOSS_LIMIT_EXCEEDED');
    return { allowed: false, flags };
  }

  // Check position size limit
  const orderValue = orderSize * currentPrice;
  if (orderValue > bot.current_capital * bot.max_position_size) {
    flags.push('POSITION_SIZE_EXCEEDED');
    return { allowed: false, flags };
  }

  return { allowed: flags.length === 0, flags };
}

// Log event to database - uses type assertion for new tables
async function logEvent(
  supabase: SupabaseClient,
  botId: string,
  userId: string,
  eventType: string,
  message: string,
  severity: string = 'info',
  payload: Record<string, unknown> = {},
  metrics?: { capital?: number; pnl?: number; price?: number }
) {
  try {
    await supabase.from('bot_events').insert([{
      bot_id: botId,
      user_id: userId,
      event_type: eventType,
      severity,
      message,
      payload,
      bot_capital: metrics?.capital ?? null,
      bot_pnl: metrics?.pnl ?? null,
      market_price: metrics?.price ?? null,
    }] as unknown[]);
  } catch (err) {
    console.error('Failed to log event:', err);
  }
}

// Execute paper trade (simulated)
async function executePaperTrade(
  supabase: SupabaseClient,
  bot: Bot,
  side: 'buy' | 'sell',
  quantity: number,
  price: number,
  reason: string
): Promise<void> {
  const clientOrderId = `paper_${bot.id}_${Date.now()}`;
  const fee = quantity * price * 0.001; // 0.1% fee simulation

  // Create order record
  const orderData = {
    bot_id: bot.id,
    user_id: bot.user_id,
    client_order_id: clientOrderId,
    symbol: bot.symbol,
    side,
    order_type: 'market',
    status: 'filled',
    quantity,
    filled_quantity: quantity,
    average_fill_price: price,
    fee,
    fee_currency: 'USD',
    strategy_id: bot.strategy_id,
    reason,
    risk_checked: true,
    submitted_at: new Date().toISOString(),
    filled_at: new Date().toISOString(),
  };

  const { data: orderResult, error: orderError } = await supabase
    .from('orders')
    .insert([orderData] as unknown[])
    .select()
    .single();

  if (orderError) {
    console.error('Failed to create order:', orderError);
    throw orderError;
  }

  const order = orderResult as { id: string };

  // Update or create position
  const { data: existingPositions } = await supabase
    .from('positions')
    .select('*')
    .eq('bot_id', bot.id)
    .eq('symbol', bot.symbol)
    .eq('status', 'open');

  const existingPosition = existingPositions && existingPositions.length > 0 ? existingPositions[0] as Position : null;

  if (existingPosition) {
    // Close existing position
    const exitPnl = side === 'sell'
      ? (price - existingPosition.entry_price) * existingPosition.quantity
      : (existingPosition.entry_price - price) * existingPosition.quantity;

    await supabase
      .from('positions')
      .update({
        status: 'closed',
        exit_price: price,
        realized_pnl: exitPnl - fee,
        total_fees: (existingPosition.total_fees || 0) + fee,
        exit_order_id: order.id,
        closed_at: new Date().toISOString(),
      } as unknown)
      .eq('id', existingPosition.id);

    // Update bot capital
    await supabase
      .from('bots')
      .update({
        current_capital: Number(bot.current_capital) + exitPnl - fee,
        total_pnl: (bot.total_pnl || 0) + exitPnl - fee,
        daily_pnl: (bot.daily_pnl || 0) + exitPnl - fee,
        total_trades: (bot.total_trades || 0) + 1,
        winning_trades: exitPnl > 0 ? (bot.winning_trades || 0) + 1 : bot.winning_trades,
      } as unknown)
      .eq('id', bot.id);
  } else {
    // Open new position
    const stopLoss = side === 'buy'
      ? price * (1 - bot.stop_loss_pct / 100)
      : price * (1 + bot.stop_loss_pct / 100);
    
    const takeProfit = side === 'buy'
      ? price * (1 + bot.take_profit_pct / 100)
      : price * (1 - bot.take_profit_pct / 100);

    await supabase
      .from('positions')
      .insert([{
        bot_id: bot.id,
        user_id: bot.user_id,
        symbol: bot.symbol,
        side,
        status: 'open',
        quantity,
        entry_price: price,
        current_price: price,
        stop_loss_price: stopLoss,
        take_profit_price: takeProfit,
        total_fees: fee,
        entry_order_id: order.id,
      }] as unknown[]);
  }

  await logEvent(
    supabase,
    bot.id,
    bot.user_id,
    'fill',
    `Paper ${side} ${quantity.toFixed(6)} ${bot.symbol} @ ${price.toFixed(2)}`,
    'info',
    { side, quantity, price, fee, reason },
    { capital: Number(bot.current_capital), price }
  );
}

// Execute live trade via Kraken API
async function executeLiveTrade(
  supabase: SupabaseClient,
  bot: Bot,
  side: 'buy' | 'sell',
  quantity: number,
  price: number,
  reason: string
): Promise<void> {
  if (!bot.api_key_id) {
    await logEvent(supabase, bot.id, bot.user_id, 'error', 'Live trade failed: No API key configured', 'error');
    return;
  }

  const clientOrderId = `live_${bot.id}_${Date.now()}`;
  
  // Create pending order record
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([{
      bot_id: bot.id,
      user_id: bot.user_id,
      client_order_id: clientOrderId,
      symbol: bot.symbol,
      side,
      order_type: 'market',
      status: 'pending',
      quantity,
      filled_quantity: 0,
      strategy_id: bot.strategy_id,
      reason,
      risk_checked: true,
    }] as unknown[])
    .select()
    .single();

  if (orderError) {
    console.error('Failed to create order:', orderError);
    await logEvent(supabase, bot.id, bot.user_id, 'error', `Order creation failed: ${orderError.message}`, 'error');
    return;
  }

  try {
    // Call exchange-kraken edge function
    const krakenSymbol = bot.symbol.replace('/', '');
    const krakenResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/exchange-kraken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'add_order',
        api_key_id: bot.api_key_id,
        pair: krakenSymbol,
        type: side,
        ordertype: 'market',
        volume: quantity.toString(),
      }),
    });

    const result = await krakenResponse.json();

    if (!result.success) {
      // Update order as rejected
      await supabase.from('orders').update({ status: 'rejected', reason: result.error?.message } as unknown).eq('id', (order as { id: string }).id);
      await logEvent(supabase, bot.id, bot.user_id, 'error', `Kraken order rejected: ${result.error?.message}`, 'error', { error: result.error });
      return;
    }

    // Update order with exchange response
    const txid = result.data?.txid?.[0] || null;
    await supabase.from('orders').update({
      status: 'submitted',
      exchange_order_id: txid,
      submitted_at: new Date().toISOString(),
    } as unknown).eq('id', (order as { id: string }).id);

    await logEvent(supabase, bot.id, bot.user_id, 'order', `Live ${side} order submitted: ${quantity} ${bot.symbol}`, 'info', { txid, quantity, price });
  } catch (err) {
    const error = err as Error;
    await supabase.from('orders').update({ status: 'rejected', reason: error.message } as unknown).eq('id', (order as { id: string }).id);
    await logEvent(supabase, bot.id, bot.user_id, 'error', `Live trade error: ${error.message}`, 'error');
  }
}

// Process a single bot tick
async function processBotTick(supabase: SupabaseClient, bot: Bot): Promise<void> {
  try {
    // Fetch current market data
    const marketData = await fetchMarketData(bot.symbol);

    // Get open position if any
    const { data: positions } = await supabase
      .from('positions')
      .select('*')
      .eq('bot_id', bot.id)
      .eq('status', 'open');

    const position = positions && positions.length > 0 ? positions[0] as Position : null;

    // Update position with current price
    if (position) {
      const unrealizedPnl = position.side === 'buy'
        ? (marketData.price - position.entry_price) * position.quantity
        : (position.entry_price - marketData.price) * position.quantity;

      await supabase
        .from('positions')
        .update({
          current_price: marketData.price,
          unrealized_pnl: unrealizedPnl,
        } as unknown)
        .eq('id', position.id);

      // Check stop loss / take profit
      if (position.side === 'buy') {
        if (position.stop_loss_price && marketData.price <= position.stop_loss_price) {
          await executePaperTrade(supabase, bot, 'sell', position.quantity, marketData.price, 'Stop loss triggered');
          await logEvent(supabase, bot.id, bot.user_id, 'risk_alert', 'Stop loss triggered', 'warn', { price: marketData.price, stop_loss: position.stop_loss_price });
          return;
        }
        if (position.take_profit_price && marketData.price >= position.take_profit_price) {
          await executePaperTrade(supabase, bot, 'sell', position.quantity, marketData.price, 'Take profit triggered');
          return;
        }
      } else {
        if (position.stop_loss_price && marketData.price >= position.stop_loss_price) {
          await executePaperTrade(supabase, bot, 'buy', position.quantity, marketData.price, 'Stop loss triggered');
          await logEvent(supabase, bot.id, bot.user_id, 'risk_alert', 'Stop loss triggered', 'warn', { price: marketData.price, stop_loss: position.stop_loss_price });
          return;
        }
        if (position.take_profit_price && marketData.price <= position.take_profit_price) {
          await executePaperTrade(supabase, bot, 'buy', position.quantity, marketData.price, 'Take profit triggered');
          return;
        }
      }
    }

    // Calculate trading signal
    const signal = calculateSignal(bot.strategy_id, marketData, position, bot.strategy_config);

    // Only act on strong signals and when we don't have a position
    if (signal.action !== 'hold' && signal.strength > 0.3 && !position) {
      // Calculate position size (fraction of capital)
      const positionValue = Number(bot.current_capital) * bot.max_position_size * signal.strength;
      const quantity = positionValue / marketData.price;

      // Check risk limits
      const riskCheck = checkRiskLimits(bot, position, quantity, signal.action, marketData.price);

      if (riskCheck.allowed) {
        if (bot.mode === 'paper') {
          await executePaperTrade(supabase, bot, signal.action, quantity, marketData.price, signal.reason);
        } else {
          // Live trading via exchange-kraken adapter
          await executeLiveTrade(supabase, bot, signal.action, quantity, marketData.price, signal.reason);
        }
      } else {
        await logEvent(
          supabase,
          bot.id,
          bot.user_id,
          'risk_alert',
          `Order blocked by risk limits: ${riskCheck.flags.join(', ')}`,
          'warn',
          { signal, riskCheck }
        );
      }
    }

    // Update heartbeat
    await supabase
      .from('bots')
      .update({
        last_heartbeat_at: new Date().toISOString(),
        last_tick_at: new Date().toISOString(),
      } as unknown)
      .eq('id', bot.id);

    // Log tick event (every 10th tick to reduce noise)
    const tickCount = Math.floor(Date.now() / 60000) % 10;
    if (tickCount === 0) {
      await logEvent(
        supabase,
        bot.id,
        bot.user_id,
        'heartbeat',
        `Tick processed: ${marketData.symbol} @ ${marketData.price.toFixed(2)}`,
        'info',
        { marketData, signal, hasPosition: !!position },
        { capital: Number(bot.current_capital), pnl: Number(bot.total_pnl), price: marketData.price }
      );
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`Error processing bot ${bot.id}:`, error);

    // Log error and increment error count
    await supabase
      .from('bots')
      .update({
        error_count: (bot.error_count || 0) + 1,
        last_error: error.message,
        status: (bot.error_count || 0) >= 5 ? 'error' : bot.status,
      } as unknown)
      .eq('id', bot.id);

    await logEvent(
      supabase,
      bot.id,
      bot.user_id,
      'error',
      `Tick error: ${error.message}`,
      'error',
      { error: error.message, stack: error.stack }
    );
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getServiceClient();

  try {
    console.log('Tick-bots starting...');

    // Get all running bots
    const { data: bots, error: botsError } = await supabase
      .from('bots')
      .select('*')
      .eq('status', 'running');

    if (botsError) throw botsError;

    if (!bots || bots.length === 0) {
      console.log('No running bots found');
      return new Response(JSON.stringify({ message: 'No running bots', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Processing ${bots.length} running bot(s)`);

    // Process each bot
    const results = await Promise.allSettled(
      bots.map(bot => processBotTick(supabase, bot as Bot))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Tick complete: ${successful} succeeded, ${failed} failed`);

    return new Response(JSON.stringify({
      message: 'Tick complete',
      processed: bots.length,
      successful,
      failed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Tick-bots error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
