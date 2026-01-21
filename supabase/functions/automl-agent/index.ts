import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StrategyGene {
  id: string;
  trendWeight: number;
  meanRevWeight: number;
  carryWeight: number;
  signalThreshold: number;
  stopLoss: number;
  takeProfit: number;
  maxPositionSize: number;
  generation: number;
  fitness: number;
  parentIds: string[];
}

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface BacktestResult {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
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

// Generate random strategy gene
function randomGene(): Omit<StrategyGene, 'id' | 'generation' | 'fitness' | 'parentIds'> {
  return {
    trendWeight: Math.random() * 2 - 0.5,
    meanRevWeight: Math.random() * 2 - 0.5,
    carryWeight: Math.random() * 2 - 0.5,
    signalThreshold: 0.01 + Math.random() * 0.09,
    stopLoss: 0.01 + Math.random() * 0.09,
    takeProfit: 0.02 + Math.random() * 0.18,
    maxPositionSize: 0.1 + Math.random() * 0.4,
  };
}

// Mutate a gene with given mutation rate
function mutateGene(gene: StrategyGene, mutationRate: number = 0.1): StrategyGene {
  const mutate = (value: number, min: number, max: number) => {
    if (Math.random() < mutationRate) {
      const change = (Math.random() - 0.5) * 0.2 * (max - min);
      return Math.max(min, Math.min(max, value + change));
    }
    return value;
  };

  return {
    ...gene,
    id: crypto.randomUUID(),
    trendWeight: mutate(gene.trendWeight, -0.5, 1.5),
    meanRevWeight: mutate(gene.meanRevWeight, -0.5, 1.5),
    carryWeight: mutate(gene.carryWeight, -0.5, 1.5),
    signalThreshold: mutate(gene.signalThreshold, 0.01, 0.1),
    stopLoss: mutate(gene.stopLoss, 0.01, 0.1),
    takeProfit: mutate(gene.takeProfit, 0.02, 0.2),
    maxPositionSize: mutate(gene.maxPositionSize, 0.1, 0.5),
    parentIds: [gene.id],
  };
}

// Crossover two parent genes
function crossover(parent1: StrategyGene, parent2: StrategyGene): StrategyGene {
  const pick = () => Math.random() < 0.5;
  return {
    id: crypto.randomUUID(),
    trendWeight: pick() ? parent1.trendWeight : parent2.trendWeight,
    meanRevWeight: pick() ? parent1.meanRevWeight : parent2.meanRevWeight,
    carryWeight: pick() ? parent1.carryWeight : parent2.carryWeight,
    signalThreshold: pick() ? parent1.signalThreshold : parent2.signalThreshold,
    stopLoss: pick() ? parent1.stopLoss : parent2.stopLoss,
    takeProfit: pick() ? parent1.takeProfit : parent2.takeProfit,
    maxPositionSize: pick() ? parent1.maxPositionSize : parent2.maxPositionSize,
    generation: Math.max(parent1.generation, parent2.generation) + 1,
    fitness: 0,
    parentIds: [parent1.id, parent2.id],
  };
}

// Calculate technical indicators
function calculateSMA(candles: Candle[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      const sum = candles.slice(i - period + 1, i + 1).reduce((acc, c) => acc + c.close, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

function calculateRSI(candles: Candle[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      rsi.push(NaN);
    } else {
      const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  return rsi;
}

// Fast backtest for strategy evaluation
function fastBacktest(candles: Candle[], gene: StrategyGene, initialCapital: number): BacktestResult {
  let capital = initialCapital;
  let position: { side: 'long' | 'short'; entryPrice: number; size: number } | null = null;
  let peakEquity = initialCapital;
  let maxDrawdown = 0;
  let wins = 0;
  let losses = 0;
  let totalGain = 0;
  let totalLoss = 0;

  const sma20 = calculateSMA(candles, 20);
  const sma50 = calculateSMA(candles, 50);
  const rsi = calculateRSI(candles, 14);

  for (let i = 50; i < candles.length; i++) {
    const candle = candles[i];
    
    // Calculate signal
    const trendSignal = (sma20[i] - sma50[i]) / sma50[i];
    const meanRevSignal = (sma20[i] - candle.close) / candle.close;
    const momentumSignal = (rsi[i] - 50) / 50;
    
    const signal = 
      gene.trendWeight * trendSignal +
      gene.meanRevWeight * meanRevSignal +
      gene.carryWeight * momentumSignal;

    // Track equity and drawdown
    const currentEquity = position 
      ? capital + (position.side === 'long' 
          ? position.size * (candle.close - position.entryPrice)
          : position.size * (position.entryPrice - candle.close))
      : capital;
    
    peakEquity = Math.max(peakEquity, currentEquity);
    const drawdown = ((peakEquity - currentEquity) / peakEquity) * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);

    // Exit logic
    if (position) {
      const priceChange = position.side === 'long' 
        ? (candle.close - position.entryPrice) / position.entryPrice
        : (position.entryPrice - candle.close) / position.entryPrice;

      const shouldExit = 
        priceChange <= -gene.stopLoss ||
        priceChange >= gene.takeProfit ||
        (position.side === 'long' && signal < -gene.signalThreshold) ||
        (position.side === 'short' && signal > gene.signalThreshold);

      if (shouldExit) {
        const pnl = position.side === 'long'
          ? position.size * (candle.close - position.entryPrice)
          : position.size * (position.entryPrice - candle.close);
        
        capital += pnl;
        
        if (pnl > 0) {
          wins++;
          totalGain += pnl;
        } else {
          losses++;
          totalLoss += Math.abs(pnl);
        }

        position = null;
      }
    }

    // Entry logic
    if (!position) {
      if (signal > gene.signalThreshold) {
        const positionSize = Math.min(capital * gene.maxPositionSize, capital * 0.95) / candle.close;
        position = { side: 'long', entryPrice: candle.close, size: positionSize };
      } else if (signal < -gene.signalThreshold) {
        const positionSize = Math.min(capital * gene.maxPositionSize, capital * 0.95) / candle.close;
        position = { side: 'short', entryPrice: candle.close, size: positionSize };
      }
    }
  }

  // Close any open position
  if (position) {
    const lastCandle = candles[candles.length - 1];
    const pnl = position.side === 'long'
      ? position.size * (lastCandle.close - position.entryPrice)
      : position.size * (position.entryPrice - lastCandle.close);
    
    capital += pnl;
    if (pnl > 0) wins++;
    else losses++;
  }

  const totalReturn = ((capital - initialCapital) / initialCapital) * 100;
  const totalTrades = wins + losses;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const profitFactor = totalLoss > 0 ? totalGain / totalLoss : totalGain > 0 ? 999 : 0;
  
  // Simplified Sharpe approximation
  const avgReturn = totalReturn / Math.max(1, totalTrades);
  const sharpeRatio = maxDrawdown > 0 ? (avgReturn / maxDrawdown) * Math.sqrt(252) : 0;

  return { totalReturn, sharpeRatio, maxDrawdown, winRate, profitFactor, totalTrades };
}

// Calculate fitness score from backtest results
function calculateFitness(result: BacktestResult): number {
  // Multi-objective fitness function
  const returnScore = Math.max(0, result.totalReturn) * 0.3;
  const sharpeScore = Math.max(0, result.sharpeRatio) * 20;
  const drawdownPenalty = Math.max(0, result.maxDrawdown - 10) * 2;
  const winRateScore = result.winRate * 0.5;
  const profitFactorScore = Math.min(result.profitFactor, 5) * 10;
  const tradeCountBonus = Math.min(result.totalTrades, 50) * 0.2;

  return returnScore + sharpeScore - drawdownPenalty + winRateScore + profitFactorScore + tradeCountBonus;
}

// AI-enhanced strategy suggestion
async function getAIInsights(topStrategies: StrategyGene[], results: BacktestResult[]): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return "AI insights unavailable";

  const prompt = `Analyze these top-performing trading strategies and provide insights:

${topStrategies.slice(0, 3).map((s, i) => `
Strategy ${i + 1} (Gen ${s.generation}, Fitness: ${s.fitness.toFixed(2)}):
- Trend Weight: ${s.trendWeight.toFixed(3)}
- Mean Rev Weight: ${s.meanRevWeight.toFixed(3)}
- Momentum Weight: ${s.carryWeight.toFixed(3)}
- Signal Threshold: ${(s.signalThreshold * 100).toFixed(2)}%
- Stop Loss: ${(s.stopLoss * 100).toFixed(2)}%
- Take Profit: ${(s.takeProfit * 100).toFixed(2)}%
- Results: Return ${results[i].totalReturn.toFixed(2)}%, Sharpe ${results[i].sharpeRatio.toFixed(2)}, Win Rate ${results[i].winRate.toFixed(1)}%
`).join('\n')}

Provide a brief 2-3 sentence analysis of what's working and one suggestion for improvement.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a quantitative trading expert. Be concise and actionable." },
          { role: "user", content: prompt }
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) return "AI insights unavailable";
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "AI insights unavailable";
  } catch {
    return "AI insights unavailable";
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user } = await authenticateUser(req);
    console.log(`User ${user.id} running AutoML agent`);

    const { 
      symbol = 'BTC/USD',
      interval = '1h',
      populationSize = 20,
      generations = 5,
      eliteCount = 4,
      mutationRate = 0.15,
      initialCapital = 10000,
      existingPopulation = null,
    } = await req.json();

    console.log(`AutoML: ${generations} generations, population ${populationSize}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch historical data
    const { data: candles, error: fetchError } = await supabase
      .from('historical_candles')
      .select('*')
      .eq('symbol', symbol)
      .eq('interval', interval)
      .order('timestamp', { ascending: true })
      .limit(2000);

    if (fetchError) throw fetchError;
    
    if (!candles || candles.length < 100) {
      throw new Error(`Insufficient data for ${symbol}. Need at least 100 candles.`);
    }

    console.log(`Loaded ${candles.length} candles for evolution`);

    // Initialize population
    let population: StrategyGene[] = existingPopulation 
      ? existingPopulation.map((g: any) => ({ ...g, fitness: 0 }))
      : [];

    // Fill remaining slots with random genes
    while (population.length < populationSize) {
      population.push({
        id: crypto.randomUUID(),
        ...randomGene(),
        generation: 0,
        fitness: 0,
        parentIds: [],
      });
    }

    const evolutionHistory: { generation: number; bestFitness: number; avgFitness: number; bestReturn: number }[] = [];
    const allResults: Map<string, BacktestResult> = new Map();

    // Evolution loop
    for (let gen = 0; gen < generations; gen++) {
      console.log(`Generation ${gen + 1}/${generations}`);

      // Evaluate fitness for each gene
      for (const gene of population) {
        if (gene.fitness === 0) {
          const result = fastBacktest(candles as Candle[], gene, initialCapital);
          gene.fitness = calculateFitness(result);
          allResults.set(gene.id, result);
        }
      }

      // Sort by fitness
      population.sort((a, b) => b.fitness - a.fitness);

      // Track evolution
      const avgFitness = population.reduce((sum, g) => sum + g.fitness, 0) / population.length;
      const bestResult = allResults.get(population[0].id)!;
      evolutionHistory.push({
        generation: gen + 1,
        bestFitness: population[0].fitness,
        avgFitness,
        bestReturn: bestResult.totalReturn,
      });

      console.log(`Gen ${gen + 1}: Best fitness ${population[0].fitness.toFixed(2)}, Avg ${avgFitness.toFixed(2)}`);

      // Create next generation (except on last iteration)
      if (gen < generations - 1) {
        const nextGen: StrategyGene[] = [];

        // Keep elite
        for (let i = 0; i < eliteCount && i < population.length; i++) {
          nextGen.push({ ...population[i], generation: gen + 1 });
        }

        // Tournament selection and breeding
        while (nextGen.length < populationSize) {
          // Tournament selection for parents
          const tournamentSize = 3;
          const selectParent = () => {
            const candidates = [];
            for (let i = 0; i < tournamentSize; i++) {
              candidates.push(population[Math.floor(Math.random() * population.length)]);
            }
            return candidates.sort((a, b) => b.fitness - a.fitness)[0];
          };

          const parent1 = selectParent();
          const parent2 = selectParent();

          // Crossover
          let child = crossover(parent1, parent2);
          child.generation = gen + 1;

          // Mutate
          child = mutateGene(child, mutationRate);
          child.generation = gen + 1;
          child.fitness = 0;

          nextGen.push(child);
        }

        population = nextGen;
      }
    }

    // Final evaluation and ranking
    const topStrategies = population.slice(0, 10);
    const topResults = topStrategies.map(s => allResults.get(s.id)!);

    // Get AI insights on top strategies
    const aiInsights = await getAIInsights(topStrategies, topResults);

    // Format response
    const response = {
      success: true,
      evolution: {
        totalGenerations: generations,
        populationSize,
        mutationRate,
        history: evolutionHistory,
      },
      topStrategies: topStrategies.map((s, i) => ({
        rank: i + 1,
        id: s.id,
        generation: s.generation,
        fitness: s.fitness,
        config: {
          trendWeight: s.trendWeight,
          meanRevWeight: s.meanRevWeight,
          carryWeight: s.carryWeight,
          signalThreshold: s.signalThreshold,
          stopLoss: s.stopLoss,
          takeProfit: s.takeProfit,
          maxPositionSize: s.maxPositionSize,
        },
        performance: topResults[i],
        parentIds: s.parentIds,
      })),
      aiInsights,
      population: population.slice(0, 20), // Return population for continuation
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('AutoML error:', error);
    
    const isAuthError = error.message?.includes('authorization') || 
                        error.message?.includes('token') || 
                        error.message?.includes('permission');
    
    return new Response(
      JSON.stringify({ error: isAuthError ? error.message : 'AutoML agent failed. Please try again.' }),
      { status: isAuthError ? 401 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
