# Test run results and gaps

## Test run
- `npm test` (runs `node scripts/run-deno-tests.js`, which uses `deno` if present or falls back to `npm exec --yes deno`).
  - Status: passes locally when the Deno runtime is available (via system install or npm fallback).
- `npm run lint`.
  - Status: failed with existing ESLint violations (primarily `no-explicit-any`, React hook dependency warnings, and a forbidden `require()` import in `tailwind.config.ts`).
- `npm run type-check`.
  - Status: passed.
- `npm run build`.
  - Status: passed with a chunk size warning (bundle > 500 kB after minification).

## Gaps and missing components
- **Deno runtime for tests**: the test script uses Deno and falls back to `npm exec --yes deno`, so CI/local environments need network access or a preinstalled Deno binary for `npm test` to succeed.【F:package.json†L21-L40】
- **Lint debt blocking clean runs**: the lint pipeline currently fails on `@typescript-eslint/no-explicit-any` usage and a forbidden `require()` import in the Tailwind config, so lint hygiene is a prerequisite for a clean CI run.【F:src/components/trading/BacktestPanel.tsx†L44-L74】【F:tailwind.config.ts†L120-L133】
- **Runtime configuration validation**: the production readiness review notes missing runtime validation for required Supabase environment variables and user-facing errors when config is missing.【F:docs/production-readiness-review.md†L24-L33】
- **Observability for edge failures**: the same review calls for centralized API error telemetry/logging to capture edge function failures.【F:docs/production-readiness-review.md†L24-L33】
- **Server-side authorization for bot controls**: the review highlights the need for enforced server-side authorization on bot-controller endpoints.【F:docs/production-readiness-review.md†L24-L33】
- **Self-test page access controls**: the review recommends gating or removing the self-test page in production or restricting it to admins.【F:docs/production-readiness-review.md†L24-L33】
- **E2E coverage for bot lifecycle**: the review calls for end-to-end tests that cover bot lifecycle controls and strategy updates across components.【F:docs/production-readiness-review.md†L24-L33】
