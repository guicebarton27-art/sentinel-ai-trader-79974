import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  RefreshCw,
  XCircle,
  Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface BotRun {
  id: string;
  bot_id: string;
  status: string;
  mode: string;
  started_at: string;
  ended_at: string | null;
  last_tick_at: string | null;
  tick_count: number | null;
  total_trades: number | null;
  error_count: number | null;
  total_pnl: number | null;
  last_error: string | null;
}

interface BotEvent {
  id: string;
  event_type: string;
  severity: string;
  message: string;
  created_at: string;
  payload: Record<string, unknown>;
}

interface RunStatusPanelProps {
  botId: string | null;
  botName?: string;
  botMode?: 'paper' | 'live';
  botStatus?: string;
}

export const RunStatusPanel = ({ botId, botName, botMode, botStatus }: RunStatusPanelProps) => {
  const [currentRun, setCurrentRun] = useState<BotRun | null>(null);
  const [recentEvents, setRecentEvents] = useState<BotEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    if (!botId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      
      // Fetch current/latest run
      const { data: runs } = await supabase
        .from('bot_runs')
        .select('*')
        .eq('bot_id', botId)
        .order('started_at', { ascending: false })
        .limit(1);

      if (runs && runs.length > 0) {
        setCurrentRun(runs[0] as BotRun);
      }

      // Fetch recent events
      const { data: events } = await supabase
        .from('bot_events')
        .select('id, event_type, severity, message, created_at, payload')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (events) {
        setRecentEvents(events as BotEvent[]);
      }

      setLoading(false);
    };

    fetchData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`run-status-${botId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bot_runs', filter: `bot_id=eq.${botId}` },
        (payload) => {
          if (payload.new) {
            setCurrentRun(payload.new as BotRun);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bot_events', filter: `bot_id=eq.${botId}` },
        (payload) => {
          if (payload.new) {
            setRecentEvents(prev => [payload.new as BotEvent, ...prev.slice(0, 9)]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [botId]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
      case 'critical':
        return <XCircle className="h-3 w-3 text-destructive" />;
      case 'warn':
      case 'warning':
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      default:
        return <CheckCircle2 className="h-3 w-3 text-success" />;
    }
  };

  const getStatusBadge = () => {
    if (!botStatus || botStatus === 'stopped') {
      return <Badge variant="outline">Stopped</Badge>;
    }
    if (botStatus === 'running') {
      return <Badge variant="default" className="bg-success">Running</Badge>;
    }
    if (botStatus === 'paused') {
      return <Badge variant="secondary">Paused</Badge>;
    }
    if (botStatus === 'error') {
      return <Badge variant="destructive">Error</Badge>;
    }
    return <Badge variant="outline">{botStatus}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!botId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Run Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No bot selected</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Run Status
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {botMode && (
              <Badge variant={botMode === 'live' ? 'destructive' : 'secondary'} className="text-xs">
                {botMode.toUpperCase()}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Run Summary */}
        {currentRun && (
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Session Started</span>
              <span className="font-medium">
                {formatDistanceToNow(new Date(currentRun.started_at), { addSuffix: true })}
              </span>
            </div>
            
            {currentRun.last_tick_at && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last Tick
                </span>
                <span className="font-medium">
                  {formatDistanceToNow(new Date(currentRun.last_tick_at), { addSuffix: true })}
                </span>
              </div>
            )}
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Ticks / Trades
              </span>
              <span className="font-medium">
                {currentRun.tick_count || 0} / {currentRun.total_trades || 0}
              </span>
            </div>

            {(currentRun.error_count ?? 0) > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  Errors
                </span>
                <span className="font-medium text-destructive">
                  {currentRun.error_count}
                </span>
              </div>
            )}

            {currentRun.total_pnl !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Session P&L</span>
                <span className={`font-medium ${(currentRun.total_pnl ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  ${(currentRun.total_pnl ?? 0).toFixed(2)}
                </span>
              </div>
            )}

            {currentRun.last_error && (
              <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                <p className="text-xs text-destructive font-medium">Last Error:</p>
                <p className="text-xs text-destructive/80 truncate">{currentRun.last_error}</p>
              </div>
            )}
          </div>
        )}

        {/* Toggle Logs Button */}
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={() => setShowLogs(!showLogs)}
        >
          {showLogs ? 'Hide' : 'Show'} Event Log
          <ExternalLink className="h-3 w-3 ml-2" />
        </Button>

        {/* Recent Events */}
        {showLogs && (
          <ScrollArea className="h-48 rounded border">
            <div className="p-2 space-y-1">
              {recentEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No events yet</p>
              ) : (
                recentEvents.map((event) => (
                  <div 
                    key={event.id}
                    className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-muted/50"
                  >
                    {getSeverityIcon(event.severity)}
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{event.message}</p>
                      <p className="text-muted-foreground">
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}

        {!currentRun && botStatus === 'stopped' && (
          <div className="text-center py-4">
            <RefreshCw className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No active run session</p>
            <p className="text-xs text-muted-foreground">Start the bot to begin trading</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RunStatusPanel;
