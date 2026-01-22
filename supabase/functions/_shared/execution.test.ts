import { evaluateLiveEligibility, getNextFailureState, normalizeKrakenOrderResponse } from "./execution.ts";

Deno.test("evaluateLiveEligibility blocks when not armed or kill switch active", () => {
  const result = evaluateLiveEligibility({
    run: {
      id: "run-1",
      mode: "live",
      status: "running",
      live_armed: false,
      armed_at: null,
      summary: {},
    },
    liveTradingEnabled: true,
    killSwitchActive: true,
    secretsReady: true,
    cooldownSeconds: 60,
    now: new Date(),
  });

  if (result.allowed) {
    throw new Error("Expected live eligibility to be blocked");
  }

  if (!result.reasons.includes("LIVE_NOT_ARMED") || !result.reasons.includes("KILL_SWITCH_ACTIVE")) {
    throw new Error("Expected LIVE_NOT_ARMED and KILL_SWITCH_ACTIVE reasons");
  }
});

Deno.test("normalizeKrakenOrderResponse returns normalized order status", () => {
  const normalized = normalizeKrakenOrderResponse({ txid: ["ABC123"] });

  if (normalized.exchange_order_id !== "ABC123") {
    throw new Error("Expected exchange_order_id to be normalized");
  }

  if (normalized.status !== "submitted") {
    throw new Error("Expected submitted status");
  }
});

Deno.test("getNextFailureState triggers circuit breaker after threshold", () => {
  const { nextCount, triggered } = getNextFailureState({ live_failure_count: 2 }, 3);

  if (nextCount !== 3) {
    throw new Error("Expected nextCount to be 3");
  }

  if (!triggered) {
    throw new Error("Expected circuit breaker to trigger at threshold");
  }
});
