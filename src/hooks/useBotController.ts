import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Bot {
  id: string;
  user_id: string;
  name: string;
  status: 'stopped' | 'running' | 'paused' | 'error';
  mode: 'paper' | 'live';
  symbol: string;
  strategy_id: string;
  strategy_config: Record<string, unknown>;
  max_position_size: number;
  max_daily_loss: number;
  stop_loss_pct: number;
  take_profit_pct: number;
  max_leverage: number;
  starting_capital: number;
  current_capital: number;
  total_pnl: number;
  daily_pnl: number;
  total_trades: number;
  winning_trades: number;
  last_heartbeat_at: string | null;
  last_tick_at: string | null;
  last_error: string | null;
  error_count: number;
  api_key_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  status: 'open' | 'closed' | 'liquidated';
  quantity: number;
  entry_price: number;
  current_price: number | null;
  exit_price: number | null;
  unrealized_pnl: number;
  realized_pnl: number;
  stop_loss_price: number | null;
  take_profit_price: number | null;
  opened_at: string;
  closed_at: string | null;
}

export interface Order {
  id: string;
  client_order_id: string;
  exchange_order_id: string | null;
  symbol: string;
  side: 'buy' | 'sell';
  order_type: string;
  status: string;
  quantity: number;
  filled_quantity: number;
  price: number | null;
  average_fill_price: number | null;
  fee: number;
  reason: string | null;
  created_at: string;
  filled_at: string | null;
}

export interface BotEvent {
  id: string;
  event_type: string;
  severity: string;
  message: string;
  payload: Record<string, unknown>;
  bot_capital: number | null;
  bot_pnl: number | null;
  market_price: number | null;
  created_at: string;
}

export interface BotHealth {
  is_healthy: boolean;
  last_heartbeat_age_seconds: number | null;
  error_count: number;
}

export function useBotController() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [activeBot, setActiveBot] = useState<Bot | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [recentEvents, setRecentEvents] = useState<BotEvent[]>([]);
  const [health, setHealth] = useState<BotHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all user's bots
  const fetchBots = useCallback(async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase.functions.invoke('bot-controller/list');
      if (fetchError) throw fetchError;
      setBots(data?.bots || []);
      
      // Set first bot as active if none selected
      if (data?.bots?.length > 0 && !activeBot) {
        setActiveBot(data.bots[0]);
      }
    } catch (err) {
      console.error('Error fetching bots:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeBot]);

  // Fetch bot status with positions, orders, events
  const fetchBotStatus = useCallback(async (botId: string) => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase.functions.invoke('bot-controller/status', {
        body: { bot_id: botId }
      });
      
      if (fetchError) throw fetchError;
      
      if (data?.bot) {
        setActiveBot(data.bot);
        // Update in bots list too
        setBots(prev => prev.map(b => b.id === data.bot.id ? data.bot : b));
      }
      if (data?.positions) setPositions(data.positions);
      if (data?.recent_orders) setRecentOrders(data.recent_orders);
      if (data?.recent_events) setRecentEvents(data.recent_events);
      if (data?.health) setHealth(data.health);
    } catch (err) {
      console.error('Error fetching bot status:', err);
      setError((err as Error).message);
    }
  }, []);

  // Create a new bot
  const createBot = useCallback(async (config: {
    name?: string;
    symbol?: string;
    mode?: 'paper' | 'live';
    strategy_id?: string;
    strategy_config?: Record<string, unknown>;
    risk_params?: {
      max_position_size?: number;
      max_daily_loss?: number;
      stop_loss_pct?: number;
      take_profit_pct?: number;
      max_leverage?: number;
      starting_capital?: number;
    };
    api_key_id?: string;
  }) => {
    try {
      setError(null);
      const { data, error: createError } = await supabase.functions.invoke('bot-controller/create', {
        body: config
      });
      
      if (createError) throw createError;
      
      if (data?.bot) {
        setBots(prev => [data.bot, ...prev]);
        setActiveBot(data.bot);
      }
      
      return data?.bot;
    } catch (err) {
      console.error('Error creating bot:', err);
      throw err;
    }
  }, []);

  // Start bot
  const startBot = useCallback(async (botId: string, mode?: 'paper' | 'live') => {
    try {
      setError(null);
      const { data, error: startError } = await supabase.functions.invoke('bot-controller/start', {
        body: { bot_id: botId, mode }
      });
      
      if (startError) throw startError;
      
      if (data?.bot) {
        setActiveBot(data.bot);
        setBots(prev => prev.map(b => b.id === data.bot.id ? data.bot : b));
      }
      
      return data;
    } catch (err) {
      console.error('Error starting bot:', err);
      throw err;
    }
  }, []);

  // Pause bot
  const pauseBot = useCallback(async (botId: string) => {
    try {
      setError(null);
      const { data, error: pauseError } = await supabase.functions.invoke('bot-controller/pause', {
        body: { bot_id: botId }
      });
      
      if (pauseError) throw pauseError;
      
      if (data?.bot) {
        setActiveBot(data.bot);
        setBots(prev => prev.map(b => b.id === data.bot.id ? data.bot : b));
      }
      
      return data;
    } catch (err) {
      console.error('Error pausing bot:', err);
      throw err;
    }
  }, []);

  // Stop bot
  const stopBot = useCallback(async (botId: string) => {
    try {
      setError(null);
      const { data, error: stopError } = await supabase.functions.invoke('bot-controller/stop', {
        body: { bot_id: botId }
      });
      
      if (stopError) throw stopError;
      
      if (data?.bot) {
        setActiveBot(data.bot);
        setBots(prev => prev.map(b => b.id === data.bot.id ? data.bot : b));
      }
      
      return data;
    } catch (err) {
      console.error('Error stopping bot:', err);
      throw err;
    }
  }, []);

  // Kill bot (emergency stop)
  const killBot = useCallback(async (botId: string) => {
    try {
      setError(null);
      const { data, error: killError } = await supabase.functions.invoke('bot-controller/kill', {
        body: { bot_id: botId }
      });
      
      if (killError) throw killError;
      
      if (data?.bot) {
        setActiveBot(data.bot);
        setBots(prev => prev.map(b => b.id === data.bot.id ? data.bot : b));
      }
      
      return data;
    } catch (err) {
      console.error('Error killing bot:', err);
      throw err;
    }
  }, []);

  // Update bot configuration
  const updateBot = useCallback(async (botId: string, updates: Partial<Bot>) => {
    try {
      setError(null);
      const { data, error: updateError } = await supabase.functions.invoke('bot-controller/update', {
        body: { bot_id: botId, ...updates }
      });
      
      if (updateError) throw updateError;
      
      if (data?.bot) {
        setActiveBot(data.bot);
        setBots(prev => prev.map(b => b.id === data.bot.id ? data.bot : b));
      }
      
      return data?.bot;
    } catch (err) {
      console.error('Error updating bot:', err);
      throw err;
    }
  }, []);

  // Delete bot
  const deleteBot = useCallback(async (botId: string) => {
    try {
      setError(null);
      const { error: deleteError } = await supabase.functions.invoke('bot-controller/delete', {
        body: { bot_id: botId }
      });
      
      if (deleteError) throw deleteError;
      
      setBots(prev => prev.filter(b => b.id !== botId));
      if (activeBot?.id === botId) {
        setActiveBot(null);
      }
    } catch (err) {
      console.error('Error deleting bot:', err);
      throw err;
    }
  }, [activeBot]);

  // Initial fetch
  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  // Subscribe to realtime updates for active bot
  useEffect(() => {
    if (!activeBot) return;

    const channel = supabase
      .channel(`bot-${activeBot.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bots',
          filter: `id=eq.${activeBot.id}`,
        },
        (payload) => {
          if (payload.new) {
            const newBot = payload.new as Bot;
            setActiveBot(newBot);
            setBots(prev => prev.map(b => b.id === newBot.id ? newBot : b));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'positions',
          filter: `bot_id=eq.${activeBot.id}`,
        },
        () => {
          // Refetch positions on any change
          fetchBotStatus(activeBot.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `bot_id=eq.${activeBot.id}`,
        },
        (payload) => {
          if (payload.new) {
            setRecentOrders(prev => [payload.new as Order, ...prev.slice(0, 9)]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bot_events',
          filter: `bot_id=eq.${activeBot.id}`,
        },
        (payload) => {
          if (payload.new) {
            setRecentEvents(prev => [payload.new as BotEvent, ...prev.slice(0, 19)]);
          }
        }
      )
      .subscribe();

    // Refresh status every 30 seconds
    const interval = setInterval(() => {
      fetchBotStatus(activeBot.id);
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [activeBot?.id, fetchBotStatus]);

  return {
    // State
    bots,
    activeBot,
    positions,
    recentOrders,
    recentEvents,
    health,
    loading,
    error,
    
    // Actions
    fetchBots,
    fetchBotStatus,
    setActiveBot,
    createBot,
    startBot,
    pauseBot,
    stopBot,
    killBot,
    updateBot,
    deleteBot,
  };
}
