import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Shared bot state across all connections
const bot = {
  status: 'stopped' as 'running' | 'paused' | 'stopped',
  mode: 'paper' as 'paper' | 'live',
  nav: 1000000,
  startingNav: 1000000,
  ordersToday: 0,
  listeners: new Set<WebSocket>(),
  tickTimer: null as number | null,
};

// Calculate trading signal
function calcSignal(): number {
  const trend = Math.random() * 0.8 - 0.4;
  const meanrev = Math.random() * 0.6 - 0.3;
  const carry = 0.02;
  const allocTrend = 0.35, allocMR = 0.35, allocCarry = 0.3;
  return allocTrend * trend + allocMR * meanrev + allocCarry * carry;
}

// Generate telemetry data
function telemetry() {
  const pnl = bot.nav - bot.startingNav;
  const pnlPercentage = ((pnl / bot.startingNav) * 100);
  
  return {
    status: bot.status,
    mode: bot.mode,
    nav: bot.nav,
    startingNav: bot.startingNav,
    pnl: pnl,
    pnlPercentage: pnlPercentage,
    ordersToday: bot.ordersToday,
    timestamp: Date.now(),
  };
}

// Broadcast telemetry to all connected WebSocket clients
function broadcastTelemetry() {
  const t = telemetry();
  const message = JSON.stringify({ topic: 'telemetry.v1', ...t });
  
  for (const ws of bot.listeners) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch (error) {
        console.error('Error sending to client:', error);
        bot.listeners.delete(ws);
      }
    } else {
      bot.listeners.delete(ws);
    }
  }
}

// Ensure trading loop is running
function ensureLoop() {
  if (bot.tickTimer) return;

  console.log('Starting trading loop');
  bot.tickTimer = setInterval(() => {
    if (bot.status !== 'running') return;
    
    const sig = calcSignal();
    const ret = Math.random() * 0.0008 - 0.0004;
    const pnl = sig * ret * bot.nav;
    bot.nav += pnl;
    bot.ordersToday += Math.random() > 0.7 ? 1 : 0;

    // Broadcast updates to all connected clients
    broadcastTelemetry();
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

  const url = new URL(req.url);
  const path = url.pathname;

  // Handle WebSocket connections for telemetry
  if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      console.log("WebSocket client connected");
      ensureLoop();
      bot.listeners.add(socket);

      // Send initial telemetry
      const t = telemetry();
      socket.send(JSON.stringify({ topic: 'telemetry.v1', ...t }));

      // Set up periodic updates
      const intervalId = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          const t = telemetry();
          socket.send(JSON.stringify({ topic: 'telemetry.v1', ...t }));
        } else {
          clearInterval(intervalId);
        }
      }, 1000);

      socket.addEventListener('close', () => {
        clearInterval(intervalId);
        bot.listeners.delete(socket);
        console.log("WebSocket client disconnected");
      });
    };

    socket.onerror = (e) => {
      console.error("WebSocket error:", e);
    };

    return response;
  }

  // Handle HTTP control commands
  if (req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));

      if (path.includes('/start')) {
        bot.mode = body?.mode === 'live' ? 'live' : 'paper';
        bot.status = 'running';
        bot.startingNav = bot.nav; // Reset starting NAV when starting
        bot.ordersToday = 0;
        ensureLoop();
        console.log('Bot started:', { status: bot.status, mode: bot.mode });
        broadcastTelemetry();
        return json({ ok: true, status: bot.status, mode: bot.mode });
      }

      if (path.includes('/pause')) {
        bot.status = 'paused';
        console.log('Bot paused');
        broadcastTelemetry();
        return json({ ok: true, status: bot.status });
      }

      if (path.includes('/stop')) {
        bot.status = 'stopped';
        console.log('Bot stopped');
        broadcastTelemetry();
        return json({ ok: true, status: bot.status });
      }

      if (path.includes('/kill')) {
        bot.status = 'stopped';
        bot.ordersToday = 0;
        console.log('Bot killed - emergency stop');
        broadcastTelemetry();
        return json({ ok: true, status: 'killed' });
      }

      return json({ error: 'Not found' }, 404);
    } catch (e: any) {
      console.error('Bot control error:', e);
      return json({ ok: false, error: e?.message || 'unknown' }, 500);
    }
  }

  return json({ error: 'Method not allowed' }, 405);
});
