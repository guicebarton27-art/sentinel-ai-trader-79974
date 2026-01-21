import fs from 'node:fs';
import path from 'node:path';

const getEnv = (name, fallback) => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return fallback;
  }
  return value;
};

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const supabaseUrl = requireEnv('SUPABASE_URL');
const normalizedSupabaseUrl = supabaseUrl.replace(/\/$/, '');
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const functionsUrl = getEnv('SUPABASE_FUNCTIONS_URL', `${normalizedSupabaseUrl}/functions/v1`).replace(/\/$/, '');
const outputDir = getEnv('BACKTEST_OUTPUT_DIR', 'backtest-output');

const now = Math.floor(Date.now() / 1000);
const startTimestamp = Number(getEnv('BACKTEST_START', now - 30 * 24 * 60 * 60));
const endTimestamp = Number(getEnv('BACKTEST_END', now));

const requestBody = {
  name: getEnv('BACKTEST_NAME', 'Baseline Backtest'),
  symbol: getEnv('BACKTEST_SYMBOL', 'BTC/USD'),
  interval: getEnv('BACKTEST_INTERVAL', '1h'),
  startTimestamp,
  endTimestamp,
  initialCapital: Number(getEnv('BACKTEST_INITIAL_CAPITAL', 10000)),
  strategyConfig: {
    trendWeight: Number(getEnv('BACKTEST_TREND_WEIGHT', 0.4)),
    meanRevWeight: Number(getEnv('BACKTEST_MEANREV_WEIGHT', 0.3)),
    carryWeight: Number(getEnv('BACKTEST_CARRY_WEIGHT', 0.3)),
    signalThreshold: Number(getEnv('BACKTEST_SIGNAL_THRESHOLD', 0.2)),
    stopLoss: Number(getEnv('BACKTEST_STOP_LOSS', 0.03)),
    takeProfit: Number(getEnv('BACKTEST_TAKE_PROFIT', 0.08)),
    maxPositionSize: Number(getEnv('BACKTEST_MAX_POSITION', 0.2)),
  },
  seed: Number(getEnv('BACKTEST_SEED', 42)),
};

const log = (level, message, context) => {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    component: 'backtest-script',
    ...context,
  };
  console.log(JSON.stringify(entry));
};

if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp) || endTimestamp <= startTimestamp) {
  throw new Error('Invalid BACKTEST_START/BACKTEST_END timestamps.');
}

const run = async () => {
  log('info', 'Starting backtest', { requestBody });
  const response = await fetch(`${functionsUrl}/run-backtest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
      'x-service-role': serviceRoleKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Backtest request failed (${response.status}): ${text}`);
  }

  const payload = await response.json();
  const runId = payload.backtest_run_id;

  if (!runId) {
    throw new Error('Backtest response missing run ID.');
  }

  const tradesResponse = await fetch(`${normalizedSupabaseUrl}/rest/v1/backtest_trades?backtest_run_id=eq.${runId}&order=entry_timestamp.asc`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!tradesResponse.ok) {
    const text = await tradesResponse.text();
    throw new Error(`Failed to fetch backtest trades (${tradesResponse.status}): ${text}`);
  }

  const trades = await tradesResponse.json();
  fs.mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const summaryPath = path.join(outputDir, `${timestamp}-summary.json`);
  fs.writeFileSync(summaryPath, JSON.stringify({ request: requestBody, response: payload }, null, 2));

  const tradesCsvPath = path.join(outputDir, `${timestamp}-trades.csv`);
  const csvHeader = 'entry_timestamp,exit_timestamp,side,entry_price,exit_price,size,pnl,pnl_percentage,signal_strength\n';
  const csvRows = trades.map((trade) => [
    trade.entry_timestamp,
    trade.exit_timestamp,
    trade.side,
    trade.entry_price,
    trade.exit_price,
    trade.size,
    trade.pnl,
    trade.pnl_percentage,
    trade.signal_strength,
  ].join(','));

  fs.writeFileSync(tradesCsvPath, `${csvHeader}${csvRows.join('\n')}`);
  log('info', 'Backtest output written', { summaryPath, tradesCsvPath, trades: trades.length });
};

run().catch((error) => {
  log('error', 'Backtest failed', { error: error.message });
  process.exit(1);
});
