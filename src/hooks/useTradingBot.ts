import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BotTelemetry {
  status: 'running' | 'paused' | 'stopped';
  mode: 'paper' | 'live';
  nav: number;
  startingNav: number;
  pnl: number;
  pnlPercentage: number;
  ordersToday: number;
  timestamp: number;
}

export const useTradingBot = () => {
  const [telemetry, setTelemetry] = useState<BotTelemetry | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;

    const connectWebSocket = async () => {
      try {
        // Get the current session for authentication
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          console.log('No auth session, skipping WebSocket connection');
          return;
        }

        const projectRef = 'swpjpzsnqpamdchdlkpf';
        const wsUrl = `wss://${projectRef}.supabase.co/functions/v1/bot-engine`;

        console.log('Connecting to trading bot WebSocket:', wsUrl);

        // Pass the JWT token as a query parameter for authentication
        ws = new WebSocket(`${wsUrl}?apikey=${session.access_token}`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('Trading bot WebSocket connected');
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.topic === 'telemetry.v1') {
              setTelemetry({
                status: data.status,
                mode: data.mode,
                nav: data.nav,
                startingNav: data.startingNav,
                pnl: data.pnl,
                pnlPercentage: data.pnlPercentage,
                ordersToday: data.ordersToday,
                timestamp: data.timestamp,
              });
            }
          } catch (error) {
            console.error('Error parsing telemetry:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('Trading bot WebSocket error:', error);
          setIsConnected(false);
        };

        ws.onclose = () => {
          console.log('Trading bot WebSocket disconnected');
          setIsConnected(false);
        };
      } catch (error) {
        console.error('Error setting up WebSocket:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const controlBot = useCallback(
    async (action: 'start' | 'pause' | 'stop' | 'kill', options?: { mode?: 'paper' | 'live' }) => {
      try {
        const { data, error } = await supabase.functions.invoke(`bot-engine/${action}`, {
          body: options || {},
        });

        if (error) throw error;
        console.log('Bot control response:', data);
        return data;
      } catch (error) {
        console.error(`Error controlling bot (${action}):`, error);
        throw error;
      }
    },
    []
  );

  return {
    telemetry,
    isConnected,
    controlBot,
  };
};
