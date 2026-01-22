import { performConnectivityCheck } from "./logic.ts";

Deno.test("performConnectivityCheck succeeds when Kraken endpoints respond", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (_input, init) => {
    const body = init?.body ? JSON.parse(init.body.toString()) : {};

    if (body.action === "balance") {
      return new Response(JSON.stringify({ success: true, data: { ZUSD: "100" } }), { status: 200 });
    }

    if (body.action === "ticker") {
      return new Response(JSON.stringify({
        success: true,
        data: { XXBTZUSD: { c: ["50000"] } },
      }), { status: 200 });
    }

    return new Response(JSON.stringify({ success: false, error: { code: "UNKNOWN" } }), { status: 400 });
  };

  try {
    const result = await performConnectivityCheck({
      authHeader: "Bearer test",
      apiKeyId: "key-1",
      symbol: "BTC/USD",
    });

    if (!result.success) {
      throw new Error("Expected connectivity check to succeed");
    }

    if (result.data?.ticker_price !== "50000") {
      throw new Error("Expected ticker price to be normalized");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
