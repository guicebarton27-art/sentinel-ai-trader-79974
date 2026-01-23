import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Position {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  entry_price: number;
  current_price: number | null;
  status: 'open' | 'closed';
  bot_id: string;
  user_id: string;
}

interface ExchangePosition {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  avgPrice: number;
}

interface Discrepancy {
  type: 'missing_in_db' | 'missing_on_exchange' | 'quantity_mismatch' | 'side_mismatch';
  dbPosition?: Position;
  exchangePosition?: ExchangePosition;
  details: string;
}

// Authenticate user and check role
async function authenticateUser(req: Request): Promise<{ userId: string; role: string }> {
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
  return { userId: user.id, role };
}

// Get service client
function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// Fetch positions from exchange via Kraken API
async function fetchExchangePositions(
  supabase: SupabaseClient,
  userId: string,
  apiKeyId: string
): Promise<ExchangePosition[]> {
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/exchange-kraken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'balance',
        api_key_id: apiKeyId,
      }),
    });

    const result = await response.json();
    
    if (!result.success) {
      console.error('Failed to fetch exchange positions:', result.error);
      return [];
    }

    // Parse Kraken balance response to positions
    // Kraken returns balances, not positions - this is a simplification
    // In reality, you'd need to track trades or use TradesHistory
    const positions: ExchangePosition[] = [];
    const balances = result.data || {};

    for (const [asset, balance] of Object.entries(balances)) {
      const qty = parseFloat(balance as string);
      if (qty > 0.00001 && !['USD', 'ZUSD', 'EUR', 'ZEUR'].includes(asset)) {
        // Convert Kraken asset names back to standard symbols
        const symbol = asset.replace('XXBT', 'BTC').replace('XETH', 'ETH') + '/USD';
        positions.push({
          symbol,
          side: 'buy', // Assuming long positions for simplicity
          quantity: qty,
          avgPrice: 0, // Would need trade history for accurate avg price
        });
      }
    }

    return positions;
  } catch (error) {
    console.error('Error fetching exchange positions:', error);
    return [];
  }
}

// Compare DB positions with exchange positions
function comparePositions(
  dbPositions: Position[],
  exchangePositions: ExchangePosition[]
): Discrepancy[] {
  const discrepancies: Discrepancy[] = [];
  
  // Check for positions in DB that may not match exchange
  for (const dbPos of dbPositions) {
    const exchangePos = exchangePositions.find(ep => 
      ep.symbol === dbPos.symbol && ep.side === dbPos.side
    );

    if (!exchangePos) {
      discrepancies.push({
        type: 'missing_on_exchange',
        dbPosition: dbPos,
        details: `DB shows open ${dbPos.side} position for ${dbPos.symbol} (qty: ${dbPos.quantity}) but no matching position found on exchange`,
      });
    } else if (Math.abs(exchangePos.quantity - dbPos.quantity) > 0.00001) {
      discrepancies.push({
        type: 'quantity_mismatch',
        dbPosition: dbPos,
        exchangePosition: exchangePos,
        details: `Quantity mismatch for ${dbPos.symbol}: DB has ${dbPos.quantity}, exchange has ${exchangePos.quantity}`,
      });
    }
  }

  // Check for positions on exchange not in DB
  for (const exchangePos of exchangePositions) {
    const dbPos = dbPositions.find(dp => 
      dp.symbol === exchangePos.symbol && dp.side === exchangePos.side
    );

    if (!dbPos) {
      discrepancies.push({
        type: 'missing_in_db',
        exchangePosition: exchangePos,
        details: `Exchange shows ${exchangePos.side} position for ${exchangePos.symbol} (qty: ${exchangePos.quantity}) but no matching open position in DB`,
      });
    }
  }

  return discrepancies;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const { userId, role } = await authenticateUser(req);

    // Check if user has trader or admin role
    if (!['admin', 'trader'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Trader or admin role required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getServiceClient();
    const body = await req.json().catch(() => ({}));
    const { bot_id, api_key_id, dry_run = true } = body;

    // Check global conditions
    const liveEnabled = Deno.env.get('LIVE_TRADING_ENABLED') === 'true';
    const killSwitchEnabled = Deno.env.get('KILL_SWITCH_ENABLED') === 'true';

    // Check user kill switch
    const { data: profile } = await supabase
      .from('profiles')
      .select('global_kill_switch')
      .eq('user_id', userId)
      .single();

    const userKillSwitch = profile?.global_kill_switch ?? false;

    // If not live or kill switch is on, return disabled status
    if (!liveEnabled || killSwitchEnabled || userKillSwitch) {
      return new Response(JSON.stringify({
        status: 'disabled',
        reason: !liveEnabled 
          ? 'Live trading is not enabled' 
          : 'Kill switch is active',
        message: 'Reconciliation is only available when live trading is enabled and kill switch is off',
        discrepancies: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate required params for live reconciliation
    if (!api_key_id) {
      return new Response(
        JSON.stringify({ error: 'api_key_id is required for live reconciliation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify API key belongs to user
    const { data: apiKey, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('id, user_id')
      .eq('id', api_key_id)
      .eq('user_id', userId)
      .single();

    if (apiKeyError || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not found or does not belong to user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch DB positions
    const positionQuery = supabase
      .from('positions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'open');

    if (bot_id) {
      positionQuery.eq('bot_id', bot_id);
    }

    const { data: dbPositions, error: posError } = await positionQuery;
    if (posError) {
      throw new Error(`Failed to fetch DB positions: ${posError.message}`);
    }

    // Fetch exchange positions
    const exchangePositions = await fetchExchangePositions(supabase, userId, api_key_id);

    // Compare positions
    const discrepancies = comparePositions(
      (dbPositions || []) as Position[],
      exchangePositions
    );

    // Log discrepancies to bot_events
    if (discrepancies.length > 0) {
      const eventInserts = discrepancies.map(d => ({
        bot_id: bot_id || null,
        user_id: userId,
        event_type: 'reconciliation',
        severity: 'warn',
        message: `Reconciliation discrepancy: ${d.type}`,
        payload: {
          discrepancy: d,
          dry_run,
          timestamp: new Date().toISOString(),
        },
      }));

      // Only log if we have a bot_id, otherwise skip
      if (bot_id) {
        await supabase.from('bot_events').insert(eventInserts as unknown[]);
      }
    }

    // Apply auto-fix if dry_run is false
    const fixResults: { discrepancy: Discrepancy; action: string; success: boolean; error?: string }[] = [];
    
    if (!dry_run && discrepancies.length > 0) {
      for (const discrepancy of discrepancies) {
        try {
          switch (discrepancy.type) {
            case 'missing_on_exchange': {
              // DB shows position but exchange doesn't have it
              // Mark the DB position as closed (exchange is source of truth for live)
              if (discrepancy.dbPosition) {
                const { error } = await supabase
                  .from('positions')
                  .update({ 
                    status: 'closed',
                    closed_at: new Date().toISOString(),
                    close_reason: 'reconciliation_sync'
                  })
                  .eq('id', discrepancy.dbPosition.id);
                
                fixResults.push({
                  discrepancy,
                  action: 'closed_orphan_db_position',
                  success: !error,
                  error: error?.message
                });

                // Log the fix event
                if (bot_id) {
                  await supabase.from('bot_events').insert({
                    bot_id,
                    user_id: userId,
                    event_type: 'reconciliation',
                    severity: 'info',
                    message: `Auto-closed orphan position ${discrepancy.dbPosition.symbol}`,
                    payload: { fix: 'closed_orphan_db_position', position_id: discrepancy.dbPosition.id }
                  });
                }
              }
              break;
            }

            case 'missing_in_db': {
              // Exchange has position but DB doesn't - create tracking record
              if (discrepancy.exchangePosition && bot_id) {
                const { data: bot } = await supabase
                  .from('bots')
                  .select('symbol')
                  .eq('id', bot_id)
                  .single();

                const { error } = await supabase
                  .from('positions')
                  .insert({
                    user_id: userId,
                    bot_id: bot_id,
                    symbol: discrepancy.exchangePosition.symbol,
                    side: discrepancy.exchangePosition.side,
                    quantity: discrepancy.exchangePosition.quantity,
                    entry_price: discrepancy.exchangePosition.avgPrice,
                    status: 'open',
                    opened_at: new Date().toISOString()
                  });

                fixResults.push({
                  discrepancy,
                  action: 'created_missing_db_position',
                  success: !error,
                  error: error?.message
                });

                if (!error) {
                  await supabase.from('bot_events').insert({
                    bot_id,
                    user_id: userId,
                    event_type: 'reconciliation',
                    severity: 'info',
                    message: `Created missing DB record for ${discrepancy.exchangePosition.symbol}`,
                    payload: { fix: 'created_missing_db_position', symbol: discrepancy.exchangePosition.symbol }
                  });
                }
              } else {
                fixResults.push({
                  discrepancy,
                  action: 'skipped_no_bot_id',
                  success: false,
                  error: 'Cannot create position without bot_id'
                });
              }
              break;
            }

            case 'quantity_mismatch': {
              // Update DB to match exchange (exchange is source of truth for live)
              if (discrepancy.dbPosition && discrepancy.exchangePosition) {
                const { error } = await supabase
                  .from('positions')
                  .update({ 
                    quantity: discrepancy.exchangePosition.quantity,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', discrepancy.dbPosition.id);

                fixResults.push({
                  discrepancy,
                  action: 'updated_quantity',
                  success: !error,
                  error: error?.message
                });

                if (!error && bot_id) {
                  await supabase.from('bot_events').insert({
                    bot_id,
                    user_id: userId,
                    event_type: 'reconciliation',
                    severity: 'info',
                    message: `Updated quantity for ${discrepancy.dbPosition.symbol}: ${discrepancy.dbPosition.quantity} → ${discrepancy.exchangePosition.quantity}`,
                    payload: { 
                      fix: 'updated_quantity', 
                      position_id: discrepancy.dbPosition.id,
                      old_qty: discrepancy.dbPosition.quantity,
                      new_qty: discrepancy.exchangePosition.quantity
                    }
                  });
                }
              }
              break;
            }

            case 'side_mismatch': {
              // This is a critical discrepancy - log but don't auto-fix
              fixResults.push({
                discrepancy,
                action: 'manual_review_required',
                success: false,
                error: 'Side mismatch requires manual review - positions may need to be closed and re-opened'
              });

              if (bot_id) {
                await supabase.from('bot_events').insert({
                  bot_id,
                  user_id: userId,
                  event_type: 'reconciliation',
                  severity: 'critical',
                  message: `CRITICAL: Side mismatch for ${discrepancy.dbPosition?.symbol} - manual review required`,
                  payload: { discrepancy, requires_manual_review: true }
                });
              }
              break;
            }
          }
        } catch (fixError) {
          fixResults.push({
            discrepancy,
            action: 'fix_failed',
            success: false,
            error: (fixError as Error).message
          });
        }
      }
    }

    const successfulFixes = fixResults.filter(r => r.success).length;
    const failedFixes = fixResults.filter(r => !r.success).length;

    return new Response(JSON.stringify({
      status: 'completed',
      dry_run,
      db_positions: dbPositions?.length || 0,
      exchange_positions: exchangePositions.length,
      discrepancies_count: discrepancies.length,
      discrepancies,
      fixes_applied: !dry_run ? {
        total: fixResults.length,
        successful: successfulFixes,
        failed: failedFixes,
        results: fixResults
      } : null,
      message: dry_run 
        ? 'Dry run completed. Review discrepancies and use dry_run=false to apply fixes.'
        : `Reconciliation completed. ${successfulFixes} fixes applied, ${failedFixes} failed.`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Reconciliation error:', error);
    
    const isAuthError = (error as Error).message?.includes('authorization') || 
                        (error as Error).message?.includes('token') ||
                        (error as Error).message?.includes('permission');
    
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { 
        status: isAuthError ? 401 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
