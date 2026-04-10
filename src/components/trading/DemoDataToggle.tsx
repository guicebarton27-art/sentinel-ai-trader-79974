import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Database, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const DEMO_BOT_NAME = 'Demo Paper Bot';

export const DemoDataToggle = () => {
  const [loading, setLoading] = useState(false);
  const [demoActive, setDemoActive] = useState(false);
  const { toast } = useToast();

  const seedDemoData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if demo bot already exists
      const { data: existing } = await supabase
        .from('bots')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', DEMO_BOT_NAME)
        .maybeSingle();

      if (existing) {
        toast({ title: 'Demo data already exists', description: 'Toggle off first to reset.' });
        setDemoActive(true);
        setLoading(false);
        return;
      }

      // Create demo bot
      const { data: bot, error: botErr } = await supabase
        .from('bots')
        .insert({
          user_id: user.id,
          name: DEMO_BOT_NAME,
          status: 'stopped',
          mode: 'paper',
          symbol: 'BTC/USD',
          strategy_id: 'trend_following',
          strategy_config: { riskTolerance: 'moderate' },
          starting_capital: 10000,
          current_capital: 10847.32,
          total_pnl: 847.32,
          daily_pnl: 123.45,
          total_trades: 42,
          winning_trades: 26,
        })
        .select()
        .single();

      if (botErr) throw botErr;

      // Create demo orders
      const now = Date.now();
      const demoOrders = [
        { side: 'buy' as const, quantity: 0.015, price: 94200, pnl: 85.30, hours_ago: 2 },
        { side: 'sell' as const, quantity: 0.008, price: 94850, pnl: -22.10, hours_ago: 5 },
        { side: 'buy' as const, quantity: 0.012, price: 93100, pnl: 156.40, hours_ago: 8 },
        { side: 'sell' as const, quantity: 0.020, price: 95300, pnl: 210.00, hours_ago: 14 },
        { side: 'buy' as const, quantity: 0.010, price: 92500, pnl: 45.60, hours_ago: 20 },
      ];

      const orderInserts = demoOrders.map((o, i) => ({
        bot_id: bot.id,
        user_id: user.id,
        client_order_id: `demo_${bot.id}_${i}`,
        symbol: 'BTC/USD',
        side: o.side,
        order_type: 'market' as const,
        status: 'filled' as const,
        quantity: o.quantity,
        filled_quantity: o.quantity,
        average_fill_price: o.price,
        fee: o.quantity * o.price * 0.001,
        fee_currency: 'USD',
        strategy_id: 'trend_following',
        reason: 'Demo trade',
        risk_checked: true,
        submitted_at: new Date(now - o.hours_ago * 3600000).toISOString(),
        filled_at: new Date(now - o.hours_ago * 3600000 + 500).toISOString(),
      }));

      await supabase.from('orders').insert(orderInserts as any);

      // Create a demo open position
      const { data: entryOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('bot_id', bot.id)
        .limit(1)
        .single();

      await supabase.from('positions').insert({
        bot_id: bot.id,
        user_id: user.id,
        symbol: 'BTC/USD',
        side: 'buy',
        status: 'open',
        quantity: 0.015,
        entry_price: 94200,
        current_price: 94950,
        unrealized_pnl: 11.25,
        stop_loss_price: 93200,
        take_profit_price: 96500,
        entry_order_id: entryOrder?.id ?? null,
      } as any);

      // Create demo bot events
      const eventTypes = [
        { event_type: 'start', message: 'Bot started in paper mode', severity: 'info' },
        { event_type: 'tick', message: 'Tick completed — no signal', severity: 'info' },
        { event_type: 'order', message: 'Paper BUY 0.015 BTC/USD @ 94200', severity: 'info' },
        { event_type: 'fill', message: 'Order filled at 94200', severity: 'info' },
        { event_type: 'tick', message: 'Tick completed — HOLD', severity: 'info' },
      ];

      const eventInserts = eventTypes.map((e, i) => ({
        bot_id: bot.id,
        user_id: user.id,
        event_type: e.event_type,
        message: e.message,
        severity: e.severity,
        payload: {},
        bot_capital: 10000 + i * 50,
        market_price: 94000 + i * 200,
      }));

      await supabase.from('bot_events').insert(eventInserts as any);

      // Create a demo bot run
      await supabase.from('bot_runs').insert({
        bot_id: bot.id,
        user_id: user.id,
        mode: 'paper',
        status: 'completed',
        starting_capital: 10000,
        ending_capital: 10847.32,
        total_pnl: 847.32,
        total_trades: 42,
        winning_trades: 26,
        tick_count: 1440,
        started_at: new Date(now - 24 * 3600000).toISOString(),
        ended_at: new Date().toISOString(),
      } as any);

      setDemoActive(true);
      toast({ title: 'Demo data loaded', description: 'Sample bot, trades, and positions are now visible.' });
    } catch (err) {
      console.error('Demo seed error:', err);
      toast({ title: 'Error', description: 'Failed to create demo data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const clearDemoData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: demoBot } = await supabase
        .from('bots')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', DEMO_BOT_NAME)
        .maybeSingle();

      if (demoBot) {
        // Delete in dependency order
        await supabase.from('bot_events').delete().eq('bot_id', demoBot.id);
        await supabase.from('bot_runs').delete().eq('bot_id', demoBot.id);
        await supabase.from('positions').delete().eq('bot_id', demoBot.id);
        await supabase.from('orders').delete().eq('bot_id', demoBot.id);
        await supabase.from('bots').delete().eq('id', demoBot.id);
      }

      setDemoActive(false);
      toast({ title: 'Demo data cleared', description: 'All sample data has been removed.' });
    } catch (err) {
      console.error('Demo clear error:', err);
      toast({ title: 'Error', description: 'Failed to clear demo data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (checked: boolean) => {
    if (checked) {
      seedDemoData();
    } else {
      clearDemoData();
    }
  };

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Demo Data</CardTitle>
            {demoActive && <Badge variant="outline" className="text-xs text-success border-success/30">Active</Badge>}
          </div>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch checked={demoActive} onCheckedChange={handleToggle} />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          {demoActive
            ? 'Sample bot, trades, and positions are loaded. Toggle off to remove.'
            : 'Populate the dashboard with realistic sample data to explore features.'}
        </p>
      </CardContent>
    </Card>
  );
};
