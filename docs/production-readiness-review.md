# Production readiness review

## Scope checked
- Frontend bot controls, bot controller hook, and bot engine WebSocket hook.
- Supabase integration and self-test flow for system interaction coverage.

## Commands run
- `ls`
- `find .. -name AGENTS.md -print`
- `rg -n "TODO|FIXME|HACK|XXX" src`
- `ls src`
- `ls src/integrations`
- `ls src/integrations/supabase`
- `cat src/integrations/supabase/client.ts`
- `cat src/integrations/supabase/types.ts`
- `ls src/components/trading`
- `cat src/components/trading/BotControls.tsx`
- `cat src/hooks/useBotController.ts`
- `rg -n "auth" src/hooks src/pages src/components/trading`
- `cat src/pages/SelfTest.tsx`
- `cat package.json`
- `git status -sb`
- `nl -ba src/hooks/useTradingBot.ts`
- `nl -ba src/components/trading/BotControls.tsx`
- `nl -ba src/hooks/useBotController.ts`

## Gaps to address before production
- Add runtime validation around required Supabase environment variables and surface user-facing errors for missing config in production builds.
- Add API error telemetry/logging to capture edge function failures in a central observability sink.
- Define and enforce server-side authorization for bot-controller endpoints to ensure user access control is enforced for bot operations.
- Ensure the self-test page is gated or removed from production deployments, or protected behind admin roles.
- Add end-to-end tests for bot lifecycle controls (create/start/pause/stop/kill) and strategy updates to verify inter-component interactions.

## Production readiness actions completed in this change
- Added shared trading/risk models with structured logging to keep decision flow cohesive.
- Secured worker-only endpoints with service-role headers and explicit env validation.
- Added worker and backtest scripts to run the automated loop and produce reports deterministically.
- Removed the unused bot-engine function and client hook to eliminate a dead telemetry path.
