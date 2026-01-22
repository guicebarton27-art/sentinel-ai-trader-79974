import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pause, Play, RefreshCw, Square, Zap } from 'lucide-react';
import { useBotController } from '@/hooks/useBotController';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RunRecord {
  id: string;
  state: string;
  last_tick_at?: string | null;
}

interface BotEvent {
  id: string;
  event_type: string;
  message: string;
  severity: string;
  created_at: string;
}

export const RunControlPanel = () => {
  const { activeBot } = useBotController();
  const { toast } = useToast();
  const [run, setRun] = useState<RunRecord | null>(null);
  const [events, setEvents] = useState<BotEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const statusColor = useMemo(() => {
    if (!run?.state) return 'bg-muted text-muted-foreground';
    if (run.state === 'running') return 'bg-success text-success-foreground';
    if (run.state === 'completed') return 'bg-primary text-primary-foreground';
    if (run.state === 'failed') return 'bg-destructive text-destructive-foreground';
    return 'bg-muted text-muted-foreground';
  }, [run?.state]);

  const fetchRun = useCallback(async (runId: string) => {
    const { data, error } = await supabase
      .from('runs')
      .select('id, state, last_tick_at')
      .eq('id', runId)
      .single();

    if (error) {
      return;
    }

    setRun(data as RunRecord);
  }, []);

  const fetchEvents = useCallback(async (runId: string) => {
    const { data, error } = await supabase
      .from('bot_events')
      .select('id, event_type, message, severity, created_at')
      .eq('run_id', runId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load run events',
        variant: 'destructive',
      });
      return;
    }

    setEvents((data as BotEvent[]) ?? []);
  }, [toast]);

  const handleCreateRun = useCallback(async () => {
    if (!activeBot) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-control/create-run', {
        body: { bot_id: activeBot.id, mode: activeBot.mode },
      });

      if (error) throw error;
      const nextRun = data?.run as RunRecord | undefined;
      if (nextRun) {
        setRun(nextRun);
        await fetchEvents(nextRun.id);
      }
      toast({
        title: 'Run created',
        description: 'Manual run created for this bot.',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to create run',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeBot, fetchEvents, toast]);

  const handleTransition = useCallback(async (transition: 'start' | 'pause' | 'stop' | 'kill') => {
    if (!run) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-control/request-transition', {
        body: { run_id: run.id, transition },
      });

      if (error) throw error;
      if (data?.run) {
        setRun(data.run as RunRecord);
      }
      await fetchEvents(run.id);
      toast({
        title: 'Run updated',
        description: `Transitioned run (${transition}).`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update run state',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [fetchEvents, run, toast]);

  const handleRunTick = useCallback(async () => {
    if (!run) return;
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('run-control/run-one-tick', {
        body: { run_id: run.id },
      });

      if (error) throw error;
      toast({
        title: 'Tick requested',
        description: 'Manual tick submitted for execution.',
      });
      setTimeout(async () => {
        await fetchRun(run.id);
        await fetchEvents(run.id);
      }, 800);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to run tick',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [fetchEvents, run, toast]);

  useEffect(() => {
    if (run?.id) {
      fetchRun(run.id);
      fetchEvents(run.id);
    }
  }, [fetchEvents, fetchRun, run?.id]);

  useEffect(() => {
    setRun(null);
    setEvents([]);
  }, [activeBot?.id]);

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Run Control</CardTitle>
        {run ? (
          <Badge className={statusColor}>{run.state}</Badge>
        ) : (
          <Badge className="bg-muted text-muted-foreground">No active run</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!activeBot ? (
          <div className="text-sm text-muted-foreground">Select a bot to create a run.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCreateRun} disabled={loading} variant="outline" className="gap-2">
              <Play className="h-4 w-4" />
              Create Run
            </Button>
            <Button onClick={() => handleTransition('start')} disabled={!run || loading} className="gap-2">
              <Play className="h-4 w-4" />
              Start
            </Button>
            <Button onClick={() => handleTransition('pause')} disabled={!run || loading} variant="outline" className="gap-2">
              <Pause className="h-4 w-4" />
              Pause
            </Button>
            <Button onClick={() => handleTransition('stop')} disabled={!run || loading} variant="outline" className="gap-2">
              <Square className="h-4 w-4" />
              Stop
            </Button>
            <Button onClick={() => handleTransition('kill')} disabled={!run || loading} variant="destructive" className="gap-2">
              <Zap className="h-4 w-4" />
              Kill
            </Button>
            <Button onClick={handleRunTick} disabled={!run || loading} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Run 1 Tick
            </Button>
            <Button
              onClick={() => run && fetchEvents(run.id)}
              disabled={!run || loading}
              variant="ghost"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Events
            </Button>
          </div>
        )}

        {run && (
          <div className="text-xs text-muted-foreground">
            Run ID: {run.id}
            {run.last_tick_at ? ` • Last tick: ${new Date(run.last_tick_at).toLocaleTimeString()}` : ''}
          </div>
        )}

        <div>
          <div className="text-sm font-medium text-muted-foreground mb-2">Last 50 Events</div>
          <ScrollArea className="h-64 rounded-md border border-border/50 bg-background/40">
            <div className="space-y-2 p-3">
              {events.length === 0 ? (
                <div className="text-sm text-muted-foreground">No events for this run yet.</div>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="flex flex-col gap-1 border-b border-border/40 pb-2 last:border-b-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="uppercase tracking-wide">{event.event_type}</span>
                      <span>{new Date(event.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-sm text-foreground">{event.message}</div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};
