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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000;

  useEffect(() => {
    let shouldReconnect = true;

    const connectWebSocket = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          console.log('No auth session, skipping WebSocket connection');
          return;
        }

        const projectRef = 'swpjpzsnqpamdchdlkpf';
        const wsUrl = `wss://${projectRef}.supabase.co/functions/v1/bot-engine`;

        console.log('Connecting to trading bot WebSocket:', wsUrl);

        const ws = new WebSocket(`${wsUrl}?apikey=${session.access_token}`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('Trading bot WebSocket connected');
          setIsConnected(true);
          reconnectAttemptRef.current = 0;
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
        };

        ws.onclose = () => {
          console.log('Trading bot WebSocket disconnected');
          setIsConnected(false);
          wsRef.current = null;

          if (shouldReconnect && reconnectAttemptRef.current < maxReconnectAttempts) {
            const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttemptRef.current), 30000);
            console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current + 1}/${maxReconnectAttempts})`);
            reconnectAttemptRef.current++;
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
          }
        };
      } catch (error) {
        console.error('Error setting up WebSocket:', error);
      }
    };

    connectWebSocket();

    return () => {
      shouldReconnect = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
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
