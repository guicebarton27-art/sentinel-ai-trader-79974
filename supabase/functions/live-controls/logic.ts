import { requireEnv } from "../_shared/env.ts";

async function callKrakenFunction(
  authHeader: string | null,
  payload: Record<string, unknown>,
) {
  const response = await fetch(`${requireEnv("SUPABASE_URL")}/functions/v1/exchange-kraken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader ?? "",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return { ok: response.ok, data };
}

export async function performConnectivityCheck(options: {
  authHeader: string | null;
  apiKeyId: string;
  symbol: string;
}) {
  const krakenSymbol = options.symbol.replace("BTC", "XBT").replace("/", "");

  const balanceResult = await callKrakenFunction(options.authHeader, {
    action: "balance",
    api_key_id: options.apiKeyId,
  });

  if (!balanceResult.ok || !balanceResult.data?.success) {
    return { success: false, error: balanceResult.data?.error ?? { code: "AUTH_FAILED", message: "Balance check failed" } };
  }

  const tickerResult = await callKrakenFunction(options.authHeader, {
    action: "ticker",
    pair: krakenSymbol,
  });

  if (!tickerResult.ok || !tickerResult.data?.success) {
    return { success: false, error: tickerResult.data?.error ?? { code: "TICKER_FAILED", message: "Ticker check failed" } };
  }

  const tickerData = tickerResult.data?.data;
  const tickerEntry = tickerData ? Object.values(tickerData)[0] : null;
  const lastPrice = Array.isArray(tickerEntry?.c) ? tickerEntry?.c?.[0] : null;

  return {
    success: true,
    data: {
      balance_status: "ok",
      ticker_price: lastPrice,
      asset_count: Object.keys(balanceResult.data?.data ?? {}).length,
    },
  };
}
