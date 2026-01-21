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
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const functionsUrl = getEnv('SUPABASE_FUNCTIONS_URL', `${supabaseUrl}/functions/v1`).replace(/\/$/, '');
const tickIntervalMs = Number(getEnv('WORKER_TICK_INTERVAL_MS', '60000'));

if (!Number.isFinite(tickIntervalMs) || tickIntervalMs < 5000) {
  throw new Error('WORKER_TICK_INTERVAL_MS must be a number >= 5000');
}

const tickEndpoint = `${functionsUrl}/tick-bots`;

const log = (level, message, context) => {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    component: 'worker',
    ...context,
  };
  const output = JSON.stringify(entry);
  if (level === 'error') {
    console.error(output);
    return;
  }
  if (level === 'warn') {
    console.warn(output);
    return;
  }
  console.log(output);
};

const tick = async () => {
  try {
    const response = await fetch(tickEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-role': serviceRoleKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Tick failed (${response.status}): ${text}`);
    }

    const payload = await response.json();
    log('info', 'Tick completed', { payload });
  } catch (error) {
    log('error', 'Tick failed', { error: error.message });
  }
};

log('info', 'Worker starting', { tickEndpoint, tickIntervalMs });
tick();
setInterval(tick, tickIntervalMs);
