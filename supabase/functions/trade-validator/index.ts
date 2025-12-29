import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TradeRequest {
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  price?: number;
  order_type: 'market' | 'limit';
}

interface RiskLimits {
  max_position_size: number;
  max_daily_loss: number;
  max_correlation: number;
  kill_switch_drawdown: number;
  max_leverage: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      trade,
      account_balance = 100000,
      current_positions = [],
      daily_pnl = 0,
      risk_limits
    }: {
      trade: TradeRequest;
      account_balance: number;
      current_positions: any[];
      daily_pnl: number;
      risk_limits?: Partial<RiskLimits>;
    } = await req.json();
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log('Trade Validator: Validating trade...', trade);

    // Default risk limits
    const limits: RiskLimits = {
      max_position_size: risk_limits?.max_position_size ?? account_balance * 0.1,
      max_daily_loss: risk_limits?.max_daily_loss ?? account_balance * 0.05,
      max_correlation: risk_limits?.max_correlation ?? 0.7,
      kill_switch_drawdown: risk_limits?.kill_switch_drawdown ?? 0.15,
      max_leverage: risk_limits?.max_leverage ?? 3,
    };

    const validationResults = {
      kill_switch_active: false,
      position_limit_exceeded: false,
      daily_loss_limit_exceeded: false,
      correlation_limit_exceeded: false,
      leverage_exceeded: false,
      invalid_symbol: false,
      invalid_size: false,
    };

    const rejectionReasons: string[] = [];
    let riskScore = 0;

    // 1. Kill Switch Check - Based on account drawdown
    const accountDrawdown = daily_pnl < 0 ? Math.abs(daily_pnl) / account_balance : 0;
    if (accountDrawdown >= limits.kill_switch_drawdown) {
      validationResults.kill_switch_active = true;
      rejectionReasons.push(`Kill switch triggered: ${(accountDrawdown * 100).toFixed(2)}% drawdown exceeds ${(limits.kill_switch_drawdown * 100).toFixed(2)}% limit`);
      riskScore += 50;
    }

    // 2. Daily Loss Limit Check
    if (Math.abs(daily_pnl) >= limits.max_daily_loss && daily_pnl < 0) {
      validationResults.daily_loss_limit_exceeded = true;
      rejectionReasons.push(`Daily loss limit exceeded: $${Math.abs(daily_pnl).toFixed(2)} >= $${limits.max_daily_loss.toFixed(2)}`);
      riskScore += 30;
    }

    // 3. Position Size Check
    const tradeValue = trade.size * (trade.price || 50000); // Estimate if no price
    if (tradeValue > limits.max_position_size) {
      validationResults.position_limit_exceeded = true;
      rejectionReasons.push(`Position size exceeded: $${tradeValue.toFixed(2)} > $${limits.max_position_size.toFixed(2)}`);
      riskScore += 20;
    }

    // 4. Total Exposure / Leverage Check
    const currentExposure = current_positions.reduce((sum, p) => sum + Math.abs(p.value || 0), 0);
    const newExposure = currentExposure + tradeValue;
    const leverage = newExposure / account_balance;
    if (leverage > limits.max_leverage) {
      validationResults.leverage_exceeded = true;
      rejectionReasons.push(`Leverage exceeded: ${leverage.toFixed(2)}x > ${limits.max_leverage}x max`);
      riskScore += 25;
    }

    // 5. Correlation Check - Check if adding same-direction position in correlated asset
    const sameDirectionPositions = current_positions.filter(p => 
      (trade.side === 'buy' && p.size > 0) || (trade.side === 'sell' && p.size < 0)
    );
    const correlatedExposure = sameDirectionPositions.length / Math.max(current_positions.length, 1);
    if (correlatedExposure > limits.max_correlation && current_positions.length > 2) {
      validationResults.correlation_limit_exceeded = true;
      rejectionReasons.push(`Correlation risk high: ${(correlatedExposure * 100).toFixed(0)}% positions in same direction`);
      riskScore += 15;
    }

    // 6. Basic Validation
    if (trade.size <= 0) {
      validationResults.invalid_size = true;
      rejectionReasons.push('Invalid trade size: must be positive');
      riskScore += 10;
    }

    if (!trade.symbol || !trade.symbol.includes('/')) {
      validationResults.invalid_symbol = true;
      rejectionReasons.push(`Invalid symbol format: ${trade.symbol}`);
      riskScore += 10;
    }

    // Calculate final validation result
    const criticalFailures = validationResults.kill_switch_active || 
                              validationResults.daily_loss_limit_exceeded;
    const warningFailures = validationResults.position_limit_exceeded ||
                            validationResults.leverage_exceeded ||
                            validationResults.correlation_limit_exceeded;
    const basicFailures = validationResults.invalid_size || validationResults.invalid_symbol;

    const validationPassed = !criticalFailures && !basicFailures && !warningFailures;

    // Store validation result
    const validation = {
      symbol: trade.symbol,
      side: trade.side,
      size: trade.size,
      price: trade.price,
      validation_passed: validationPassed,
      ...validationResults,
      risk_score: Math.min(riskScore, 100),
      rejection_reason: rejectionReasons.length > 0 ? rejectionReasons.join('; ') : null,
    };

    const { error: insertError } = await supabase
      .from('trade_validations')
      .insert(validation);

    if (insertError) {
      console.error('Error storing validation:', insertError);
    }

    // Create alert for rejected trades
    if (!validationPassed) {
      const severity = criticalFailures ? 'critical' : warningFailures ? 'warning' : 'info';
      await supabase.from('alerts').insert({
        alert_type: 'trade_rejected',
        severity,
        title: `Trade Rejected: ${trade.side.toUpperCase()} ${trade.size} ${trade.symbol}`,
        message: rejectionReasons.join('. '),
        metadata: { trade, validation_results: validationResults, risk_score: riskScore }
      });
    }

    console.log('Validation complete:', { passed: validationPassed, risk_score: riskScore });

    return new Response(
      JSON.stringify({
        validation_passed: validationPassed,
        trade,
        validation_results: validationResults,
        rejection_reasons: rejectionReasons,
        risk_score: Math.min(riskScore, 100),
        limits_checked: limits,
        account_state: {
          balance: account_balance,
          daily_pnl: daily_pnl,
          current_exposure: currentExposure,
          new_exposure: newExposure,
          leverage,
          drawdown: accountDrawdown,
        },
        recommendation: validationPassed 
          ? 'Trade approved - proceed with execution'
          : criticalFailures 
            ? 'BLOCKED - Critical risk limits breached'
            : 'REJECTED - Risk limits exceeded, reduce size or wait',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Error in trade validator:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
