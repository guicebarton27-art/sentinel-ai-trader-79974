import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Shared bot state (same instance as telemetry)
const bot = {
  status: 'stopped' as 'running' | 'paused' | 'stopped',
  mode: 'paper' as 'paper' | 'live',
  nav: 1000000,
  ordersToday: 0,
  listeners: new Set<WebSocket>(),
  tickTimer: null as number | null,
};

function calcSignal(): number {
  const trend = Math.random() * 0.8 - 0.4;
  const meanrev = Math.random() * 0.6 - 0.3;
  const carry = 0.02;
  const allocTrend = 0.35, allocMR = 0.35, allocCarry = 0.3;
  return allocTrend * trend + allocMR * meanrev + allocCarry * carry;
}

function ensureLoop() {
  if (bot.tickTimer) return;

  bot.tickTimer = setInterval(() => {
    if (bot.status !== 'running') return;
    
    const sig = calcSignal();
    const ret = Math.random() * 0.0008 - 0.0004;
    const pnl = sig * ret * bot.nav;
    bot.nav += pnl;
    bot.ordersToday += Math.random() > 0.7 ? 1 : 0;

    console.log('Trading tick:', { nav: bot.nav, ordersToday: bot.ordersToday });
  }, 800);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const body = await req.json().catch(() => ({}));

    console.log('Bot control request:', path, body);

    if (path.includes('/start')) {
      bot.mode = body?.mode === 'live' ? 'live' : 'paper';
      bot.status = 'running';
      ensureLoop();
      console.log('Bot started:', { status: bot.status, mode: bot.mode });
      return json({ ok: true, status: bot.status, mode: bot.mode });
    }

    if (path.includes('/pause')) {
      bot.status = 'paused';
      console.log('Bot paused');
      return json({ ok: true, status: bot.status });
    }

    if (path.includes('/stop')) {
      bot.status = 'stopped';
      console.log('Bot stopped');
      return json({ ok: true, status: bot.status });
    }

    if (path.includes('/kill')) {
      bot.status = 'stopped';
      bot.ordersToday = 0;
      console.log('Bot killed - emergency stop');
      return json({ ok: true, status: 'killed' });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e: any) {
    console.error('Bot control error:', e);
    return json({ ok: false, error: e?.message || 'unknown' }, 500);
  }
});
