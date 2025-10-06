import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Bot state
const bot = {
  status: 'stopped' as 'running' | 'paused' | 'stopped',
  mode: 'paper' as 'paper' | 'live',
  nav: 1000000,
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
  return {
    status: bot.status,
    mode: bot.mode,
    nav: bot.nav,
    ordersToday: bot.ordersToday,
    timestamp: Date.now(),
  };
}

// Ensure trading loop is running
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { 
      status: 426,
      headers: corsHeaders 
    });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => {
    console.log("WebSocket client connected");
    ensureLoop();
    bot.listeners.add(socket);

    // Send initial telemetry
    const t = telemetry();
    socket.send(JSON.stringify({ topic: 'telemetry.v1', ...t }));

    // Send telemetry updates every second
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
});
