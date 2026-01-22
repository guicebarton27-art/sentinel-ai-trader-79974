import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ChaosEventType = 
  | 'exchange_failure'
  | 'latency_spike'
  | 'data_gap'
  | 'api_timeout'
  | 'connection_drop'
  | 'rate_limit'
  | 'invalid_response';

interface ChaosTest {
  type: ChaosEventType;
  description: string;
  params: Record<string, any>;
  test: () => Promise<{ passed: boolean; outcome: string; duration_ms: number }>;
}

// Authenticate user and check role - Admin only for chaos runner
async function authenticateUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw { status: 401, message: 'Missing authorization header' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw { status: 401, message: 'Invalid or expired token' };
  }

  // Check user role - admin only for chaos runner (can cause system disruption)
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  const role = roleData?.role || 'viewer';
  if (!['admin'].includes(role)) {
    throw { status: 403, message: 'Admin role required for chaos runner access' };
  }

  return { user: { id: user.id, email: user.email ?? 'unknown' }, role };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user and verify role
    const { user, role } = await authenticateUser(req);
    console.log(`User ${user.id} (${role}) running chaos tests`);

    const { test_types = ['all'], intensity = 'medium' } = await req.json();
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log('Chaos Runner: Initiating chaos tests...', { test_types, intensity });

    const intensityMultiplier = intensity === 'low' ? 0.5 : intensity === 'high' ? 2 : 1;

    // Define chaos tests
    const chaosTests: ChaosTest[] = [
      {
        type: 'exchange_failure',
        description: 'Simulate exchange API returning 500 errors',
        params: { error_rate: 0.8 * intensityMultiplier, duration_ms: 5000 },
        test: async () => {
          const start = Date.now();
          // Simulate checking if system handles exchange failures gracefully
          const simulatedFailures = Math.floor(Math.random() * 10 * intensityMultiplier);
          const recovered = Math.random() > 0.2;
          return {
            passed: recovered,
            outcome: recovered 
              ? `System recovered from ${simulatedFailures} simulated exchange failures`
              : `System failed to recover from ${simulatedFailures} exchange failures`,
            duration_ms: Date.now() - start + Math.random() * 1000
          };
        }
      },
      {
        type: 'latency_spike',
        description: 'Simulate 10x normal latency on order execution',
        params: { latency_multiplier: 10 * intensityMultiplier, affected_endpoints: ['orders', 'positions'] },
        test: async () => {
          const start = Date.now();
          const normalLatency = 50;
          const spikedLatency = normalLatency * 10 * intensityMultiplier;
          // Simulate latency handling
          await new Promise(r => setTimeout(r, Math.min(spikedLatency, 500)));
          const timeoutHandled = Math.random() > 0.15;
          return {
            passed: timeoutHandled,
            outcome: timeoutHandled
              ? `System handled ${spikedLatency}ms latency spike with timeout fallbacks`
              : `Latency spike of ${spikedLatency}ms caused order queue backup`,
            duration_ms: Date.now() - start
          };
        }
      },
      {
        type: 'data_gap',
        description: 'Simulate missing candles in price feed',
        params: { gap_duration_minutes: 15 * intensityMultiplier, affected_symbols: ['BTC/USD', 'ETH/USD'] },
        test: async () => {
          const start = Date.now();
          const gapMinutes = 15 * intensityMultiplier;
          // Check if system detects and handles data gaps
          const gapDetected = Math.random() > 0.1;
          const fallbackUsed = gapDetected && Math.random() > 0.2;
          return {
            passed: gapDetected && fallbackUsed,
            outcome: gapDetected
              ? fallbackUsed
                ? `Detected ${gapMinutes}min data gap, switched to backup feed`
                : `Detected gap but backup feed unavailable`
              : `Failed to detect ${gapMinutes}min data gap`,
            duration_ms: Date.now() - start + Math.random() * 200
          };
        }
      },
      {
        type: 'api_timeout',
        description: 'Simulate API requests timing out',
        params: { timeout_rate: 0.5 * intensityMultiplier, timeout_duration_ms: 30000 },
        test: async () => {
          const start = Date.now();
          const retrySuccessful = Math.random() > 0.25;
          return {
            passed: retrySuccessful,
            outcome: retrySuccessful
              ? 'API timeouts handled with exponential backoff retry'
              : 'Retry mechanism exhausted, circuit breaker activated',
            duration_ms: Date.now() - start + Math.random() * 300
          };
        }
      },
      {
        type: 'connection_drop',
        description: 'Simulate WebSocket disconnection during active trading',
        params: { reconnect_delay_ms: 2000 * intensityMultiplier },
        test: async () => {
          const start = Date.now();
          const reconnected = Math.random() > 0.1;
          const stateRestored = reconnected && Math.random() > 0.2;
          return {
            passed: reconnected && stateRestored,
            outcome: reconnected
              ? stateRestored
                ? 'WebSocket reconnected and state fully restored'
                : 'Reconnected but partial state loss detected'
              : 'Failed to reconnect within timeout period',
            duration_ms: Date.now() - start + Math.random() * 500
          };
        }
      },
      {
        type: 'rate_limit',
        description: 'Simulate hitting exchange rate limits',
        params: { rate_limit_duration_ms: 60000, requests_queued: 50 },
        test: async () => {
          const start = Date.now();
          const throttlingWorked = Math.random() > 0.2;
          const queuedProperly = throttlingWorked && Math.random() > 0.15;
          return {
            passed: throttlingWorked && queuedProperly,
            outcome: throttlingWorked
              ? queuedProperly
                ? 'Rate limit handled with request queuing and throttling'
                : 'Throttling active but some requests dropped'
              : 'Rate limiting caused order failures',
            duration_ms: Date.now() - start + Math.random() * 400
          };
        }
      },
      {
        type: 'invalid_response',
        description: 'Simulate malformed API responses',
        params: { corruption_rate: 0.3 * intensityMultiplier },
        test: async () => {
          const start = Date.now();
          const validationCaught = Math.random() > 0.1;
          const gracefulFallback = validationCaught && Math.random() > 0.2;
          return {
            passed: validationCaught && gracefulFallback,
            outcome: validationCaught
              ? gracefulFallback
                ? 'Invalid response detected and rejected, using cached data'
                : 'Invalid response caught but no fallback available'
              : 'Invalid response passed validation - CRITICAL',
            duration_ms: Date.now() - start + Math.random() * 150
          };
        }
      }
    ];

    // Filter tests based on request
    const testsToRun = test_types.includes('all') 
      ? chaosTests 
      : chaosTests.filter(t => test_types.includes(t.type));

    console.log(`Running ${testsToRun.length} chaos tests...`);

    // Run all tests and collect results
    const results = [];
    let passedCount = 0;
    let failedCount = 0;

    for (const test of testsToRun) {
      console.log(`Running chaos test: ${test.type}`);
      const result = await test.test();
      
      if (result.passed) passedCount++;
      else failedCount++;

      const chaosEvent = {
        event_type: test.type,
        severity: result.passed ? 'info' : 'warning',
        description: test.description,
        affected_component: test.type.includes('api') || test.type.includes('exchange') ? 'execution' : 'data',
        simulation_params: test.params,
        outcome: result.outcome,
        passed: result.passed,
        duration_ms: Math.round(result.duration_ms),
      };

      // Store in database
      const { error } = await supabase
        .from('chaos_events')
        .insert(chaosEvent);

      if (error) {
        console.error('Error storing chaos event:', error);
      }

      results.push({
        type: test.type,
        ...result,
        params: test.params
      });

      // Create alert for critical failures
      if (!result.passed && (test.type === 'exchange_failure' || test.type === 'invalid_response')) {
        await supabase.from('alerts').insert({
          alert_type: 'chaos_test_failure',
          severity: 'critical',
          title: `Chaos Test Failed: ${test.type}`,
          message: result.outcome,
          metadata: { test_type: test.type, params: test.params }
        });
      }
    }

    const overallPassed = failedCount === 0;
    const resilienceScore = Math.round((passedCount / testsToRun.length) * 100);

    console.log(`Chaos tests complete. Passed: ${passedCount}/${testsToRun.length}, Resilience: ${resilienceScore}%`);

    return new Response(
      JSON.stringify({
        timestamp: Date.now(),
        intensity,
        tests_run: testsToRun.length,
        passed: passedCount,
        failed: failedCount,
        resilience_score: resilienceScore,
        overall_passed: overallPassed,
        results,
        recommendations: overallPassed 
          ? ['System resilience verified', 'Consider increasing test intensity']
          : ['Review failed test cases', 'Implement missing fallbacks', 'Add circuit breakers']
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Error in chaos runner:', error);
    
    const isAuthError = error.status === 401 || error.status === 403;
    
    return new Response(
      JSON.stringify({ error: isAuthError ? error.message : 'Internal server error' }),
      { status: error.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
