// AI Model Configuration with Pro/Flash fallback
// Pro for complex reasoning, Flash as fallback for speed

export const MODELS = {
  PRO: 'google/gemini-2.5-pro',
  FLASH: 'google/gemini-2.5-flash',
} as const;

export type ModelType = typeof MODELS[keyof typeof MODELS];

interface AIRequestConfig {
  timeoutMs?: number;
  useFallback?: boolean;
}

const DEFAULT_PRO_TIMEOUT = 15000; // Pro model needs longer timeout
const DEFAULT_FLASH_TIMEOUT = 8000;

/**
 * Fetch from AI gateway with automatic Pro -> Flash fallback
 * Uses Pro model first for complex reasoning, falls back to Flash if Pro fails
 */
export async function fetchWithModelFallback(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  options?: {
    tools?: any[];
    tool_choice?: any;
    config?: AIRequestConfig;
  }
): Promise<{ response: Response; model: ModelType; usedFallback: boolean }> {
  const { tools, tool_choice, config = {} } = options || {};
  const { timeoutMs = DEFAULT_PRO_TIMEOUT, useFallback = true } = config;

  const makeRequest = async (model: ModelType, timeout: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const body: any = {
        model,
        messages,
      };

      if (tools) body.tools = tools;
      if (tool_choice) body.tool_choice = tool_choice;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Try Pro model first
  try {
    console.log(`Attempting request with ${MODELS.PRO}...`);
    const response = await makeRequest(MODELS.PRO, timeoutMs);

    // If Pro succeeds, return it
    if (response.ok) {
      console.log(`${MODELS.PRO} succeeded`);
      return { response, model: MODELS.PRO, usedFallback: false };
    }

    // If rate limited or payment required, don't fallback - propagate error
    if (response.status === 429 || response.status === 402) {
      console.log(`${MODELS.PRO} returned ${response.status}, not falling back`);
      return { response, model: MODELS.PRO, usedFallback: false };
    }

    // For other errors, try fallback if enabled
    if (useFallback) {
      console.log(`${MODELS.PRO} failed with status ${response.status}, falling back to ${MODELS.FLASH}`);
    } else {
      return { response, model: MODELS.PRO, usedFallback: false };
    }
  } catch (error) {
    // Timeout or network error - try fallback
    if (useFallback) {
      console.log(`${MODELS.PRO} timed out or failed, falling back to ${MODELS.FLASH}`);
    } else {
      throw error;
    }
  }

  // Fallback to Flash
  console.log(`Attempting fallback request with ${MODELS.FLASH}...`);
  const fallbackResponse = await makeRequest(MODELS.FLASH, DEFAULT_FLASH_TIMEOUT);
  console.log(`${MODELS.FLASH} returned status ${fallbackResponse.status}`);
  
  return { response: fallbackResponse, model: MODELS.FLASH, usedFallback: true };
}
