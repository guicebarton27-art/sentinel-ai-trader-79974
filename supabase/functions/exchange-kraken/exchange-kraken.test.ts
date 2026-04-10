// Mocked exchange-kraken client tests
// These test the normalizeKrakenError function and rate-limiting logic
// without making real API calls.

// --- Inline copies of pure functions from index.ts for isolated testing ---

function normalizeKrakenError(errors: string[]): { code: string; message: string } {
  if (errors.length === 0) {
    return { code: "UNKNOWN", message: "Unknown error" };
  }

  const error = errors[0];
  const errorMap: Record<string, { code: string; message: string }> = {
    "EAPI:Invalid key": { code: "INVALID_API_KEY", message: "Invalid API key" },
    "EAPI:Invalid signature": { code: "INVALID_SIGNATURE", message: "Invalid API signature" },
    "EAPI:Invalid nonce": { code: "INVALID_NONCE", message: "Invalid nonce - request too old" },
    "EOrder:Insufficient funds": { code: "INSUFFICIENT_FUNDS", message: "Insufficient funds for order" },
    "EOrder:Order minimum not met": { code: "ORDER_MIN_NOT_MET", message: "Order size below minimum" },
    "EOrder:Rate limit exceeded": { code: "RATE_LIMIT", message: "Exchange rate limit exceeded" },
    "EGeneral:Permission denied": { code: "PERMISSION_DENIED", message: "API key lacks required permissions" },
    "EService:Unavailable": { code: "SERVICE_UNAVAILABLE", message: "Kraken service temporarily unavailable" },
  };

  return errorMap[error] || { code: "KRAKEN_ERROR", message: error };
}

function checkRateLimit(
  rateLimitMap: Map<string, { count: number; resetAt: number }>,
  userId: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (userLimit.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  userLimit.count++;
  return { allowed: true, remaining: maxRequests - userLimit.count };
}

// --- Tests ---

Deno.test("normalizeKrakenError returns UNKNOWN for empty errors", () => {
  const result = normalizeKrakenError([]);
  if (result.code !== "UNKNOWN") throw new Error(`Expected UNKNOWN, got ${result.code}`);
});

Deno.test("normalizeKrakenError maps EAPI:Invalid key", () => {
  const result = normalizeKrakenError(["EAPI:Invalid key"]);
  if (result.code !== "INVALID_API_KEY") throw new Error(`Expected INVALID_API_KEY, got ${result.code}`);
});

Deno.test("normalizeKrakenError maps EOrder:Insufficient funds", () => {
  const result = normalizeKrakenError(["EOrder:Insufficient funds"]);
  if (result.code !== "INSUFFICIENT_FUNDS") throw new Error(`Expected INSUFFICIENT_FUNDS, got ${result.code}`);
});

Deno.test("normalizeKrakenError maps EService:Unavailable", () => {
  const result = normalizeKrakenError(["EService:Unavailable"]);
  if (result.code !== "SERVICE_UNAVAILABLE") throw new Error(`Expected SERVICE_UNAVAILABLE, got ${result.code}`);
});

Deno.test("normalizeKrakenError returns KRAKEN_ERROR for unknown errors", () => {
  const result = normalizeKrakenError(["EFoo:Bar"]);
  if (result.code !== "KRAKEN_ERROR") throw new Error(`Expected KRAKEN_ERROR, got ${result.code}`);
  if (result.message !== "EFoo:Bar") throw new Error(`Expected raw error as message`);
});

Deno.test("checkRateLimit allows first request", () => {
  const map = new Map();
  const result = checkRateLimit(map, "user-1", 5, 60000);
  if (!result.allowed) throw new Error("Expected first request to be allowed");
  if (result.remaining !== 4) throw new Error(`Expected 4 remaining, got ${result.remaining}`);
});

Deno.test("checkRateLimit blocks after max requests", () => {
  const map = new Map();
  for (let i = 0; i < 5; i++) {
    checkRateLimit(map, "user-2", 5, 60000);
  }
  const result = checkRateLimit(map, "user-2", 5, 60000);
  if (result.allowed) throw new Error("Expected request to be blocked after limit");
  if (result.remaining !== 0) throw new Error(`Expected 0 remaining, got ${result.remaining}`);
});

Deno.test("checkRateLimit resets after window expires", () => {
  const map = new Map<string, { count: number; resetAt: number }>();
  // Set expired entry
  map.set("user-3", { count: 15, resetAt: Date.now() - 1000 });
  const result = checkRateLimit(map, "user-3", 5, 60000);
  if (!result.allowed) throw new Error("Expected request to be allowed after window reset");
  if (result.remaining !== 4) throw new Error(`Expected 4 remaining, got ${result.remaining}`);
});

Deno.test("checkRateLimit isolates users", () => {
  const map = new Map();
  // Exhaust user-4 limit
  for (let i = 0; i < 5; i++) {
    checkRateLimit(map, "user-4", 5, 60000);
  }
  // user-5 should still be allowed
  const result = checkRateLimit(map, "user-5", 5, 60000);
  if (!result.allowed) throw new Error("Expected different user to be allowed");
});
