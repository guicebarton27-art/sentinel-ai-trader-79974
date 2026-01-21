import { parseNumber } from "./env.ts";
import { logWarn } from "./logging.ts";

export type AiModelConfig = {
  provider: string;
  model: string;
  version: string;
};

export type AiConfig = AiModelConfig & {
  apiKey: string;
  gatewayUrl: string;
};

type CircuitState = {
  failures: number;
  openUntil: number;
};

type ResilienceConfig = {
  timeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetMs?: number;
};

const circuitBreakers = new Map<string, CircuitState>();

const getCircuitState = (key: string): CircuitState => {
  const existing = circuitBreakers.get(key);
  if (existing) {
    return existing;
  }
  const state = { failures: 0, openUntil: 0 };
  circuitBreakers.set(key, state);
  return state;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryStatus = (status: number) => [408, 500, 502, 503, 504].includes(status);

const getConfigValue = (value: number | undefined, envName: string, fallback: number) =>
  value ?? parseNumber(Deno.env.get(envName), fallback);

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const deterministicFloat = (seed: string) => {
  const hash = hashString(seed);
  return (hash % 10000) / 10000;
};

export const getAiModelConfig = (): AiModelConfig => ({
  provider: Deno.env.get('AI_PROVIDER') ?? 'lovable',
  model: Deno.env.get('AI_MODEL') ?? 'google/gemini-2.5-flash',
  version: Deno.env.get('AI_MODEL_VERSION') ?? '2025-02-01',
});

export const requireAiConfig = (): AiConfig => {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  return {
    apiKey,
    gatewayUrl: Deno.env.get('AI_GATEWAY_URL') ?? 'https://ai.gateway.lovable.dev/v1/chat/completions',
    ...getAiModelConfig(),
  };
};

export const fetchWithResilience = async (
  circuitKey: string,
  url: string,
  options: RequestInit,
  config: ResilienceConfig = {},
) => {
  const timeoutMs = getConfigValue(config.timeoutMs, 'AI_TIMEOUT_MS', 8000);
  const maxRetries = getConfigValue(config.maxRetries, 'AI_MAX_RETRIES', 2);
  const retryBackoffMs = getConfigValue(config.retryBackoffMs, 'AI_RETRY_BACKOFF_MS', 500);
  const circuitBreakerThreshold = getConfigValue(
    config.circuitBreakerThreshold,
    'AI_CIRCUIT_BREAKER_THRESHOLD',
    3,
  );
  const circuitBreakerResetMs = getConfigValue(
    config.circuitBreakerResetMs,
    'AI_CIRCUIT_BREAKER_RESET_MS',
    60000,
  );

  const circuit = getCircuitState(circuitKey);
  if (Date.now() < circuit.openUntil) {
    throw new Error(`Circuit breaker open for ${circuitKey}`);
  }

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    attempt += 1;
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      if (!response.ok && shouldRetryStatus(response.status)) {
        throw new Error(`Retryable AI response status: ${response.status}`);
      }

      circuit.failures = 0;
      circuit.openUntil = 0;
      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt > maxRetries) {
        break;
      }
      const delayMs = retryBackoffMs * Math.pow(2, attempt - 1);
      await sleep(delayMs);
    }
  }

  circuit.failures += 1;
  if (circuit.failures >= circuitBreakerThreshold) {
    circuit.openUntil = Date.now() + circuitBreakerResetMs;
    logWarn({
      component: 'ai-resilience',
      message: 'Circuit breaker opened after repeated failures',
      context: { circuitKey, failures: circuit.failures },
    });
  }

  throw lastError ?? new Error('AI request failed');
};
