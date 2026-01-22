// Preflight diagnostics to help debug preview environment issues.
// Intentionally does NOT log actual key material.

const hasUrl = Boolean(import.meta.env?.VITE_SUPABASE_URL);
const hasKey = Boolean(import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY);

// eslint-disable-next-line no-console
console.log("[env-preflight] has VITE_SUPABASE_URL:", hasUrl);
// eslint-disable-next-line no-console
console.log("[env-preflight] has VITE_SUPABASE_PUBLISHABLE_KEY:", hasKey);
