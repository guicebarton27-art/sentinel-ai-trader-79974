import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  AlertTriangle, 
  Bot, 
  Database, 
  Clock, 
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  components: {
    database: { status: 'ok' | 'warning' | 'error'; message?: string; latency_ms?: number };
    scheduler: { status: 'ok' | 'warning' | 'error'; message?: string };
    bots: { status: 'ok' | 'warning' | 'error'; total: number; running: number; paused: number; stopped: number; error: number };
    errors: { status: 'ok' | 'warning' | 'error'; count_last_hour: number; count_last_24h: number; recent_errors: Array<{ bot_id: string; bot_name: string; message: string; timestamp: string }> };
  };
  uptime_info: {
    last_tick_at: string | null;
    seconds_since_last_tick: number | null;
  };
}

export const SystemStatusWidget = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase.functions.invoke('health');
      
      if (fetchError) throw fetchError;
      setHealth(data);
    } catch (err) {
      console.error('Failed to fetch health:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-warning" />;
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getOverallStatusBadge = (status: 'healthy' | 'degraded' | 'unhealthy') => {
    switch (status) {
      case 'healthy': return <Badge className="bg-success text-success-foreground">Healthy</Badge>;
      case 'degraded': return <Badge className="bg-warning text-warning-foreground">Degraded</Badge>;
      case 'unhealthy': return <Badge variant="destructive">Unhealthy</Badge>;
    }
  };

  if (loading && !health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={fetchHealth} className="mt-3">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!health) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
          </div>
          <div className="flex items-center gap-2">
            {getOverallStatusBadge(health.status)}
            <Button size="icon" variant="ghost" onClick={fetchHealth} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Components Status */}
        <div className="grid grid-cols-2 gap-3">
          {/* Database */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            {getStatusIcon(health.components.database.status)}
            <div>
              <div className="text-sm font-medium flex items-center gap-1">
                <Database className="h-3 w-3" />
                Database
              </div>
              {health.components.database.latency_ms !== undefined && (
                <div className="text-xs text-muted-foreground">
                  {health.components.database.latency_ms}ms latency
                </div>
              )}
            </div>
          </div>

          {/* Scheduler */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            {getStatusIcon(health.components.scheduler.status)}
            <div>
              <div className="text-sm font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Scheduler
              </div>
              {health.components.scheduler.message && (
                <div className="text-xs text-muted-foreground">
                  {health.components.scheduler.message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bot Stats */}
        <div className="p-3 rounded-lg bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            {getStatusIcon(health.components.bots.status)}
            <span className="text-sm font-medium flex items-center gap-1">
              <Bot className="h-3 w-3" />
              Trading Bots
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-success">{health.components.bots.running}</div>
              <div className="text-xs text-muted-foreground">Running</div>
            </div>
            <div>
              <div className="text-lg font-bold text-warning">{health.components.bots.paused}</div>
              <div className="text-xs text-muted-foreground">Paused</div>
            </div>
            <div>
              <div className="text-lg font-bold text-muted-foreground">{health.components.bots.stopped}</div>
              <div className="text-xs text-muted-foreground">Stopped</div>
            </div>
            <div>
              <div className="text-lg font-bold text-destructive">{health.components.bots.error}</div>
              <div className="text-xs text-muted-foreground">Error</div>
            </div>
          </div>
        </div>

        {/* Errors */}
        {health.components.errors.count_last_hour > 0 && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium">
                {health.components.errors.count_last_hour} error(s) in last hour
              </span>
            </div>
            {health.components.errors.recent_errors.slice(0, 2).map((err, i) => (
              <div key={i} className="text-xs text-muted-foreground mt-1">
                <span className="font-medium">{err.bot_name}:</span> {err.message}
              </div>
            ))}
          </div>
        )}

        {/* Last Tick */}
        {health.uptime_info.last_tick_at && (
          <div className="text-xs text-muted-foreground text-center">
            Last tick: {new Date(health.uptime_info.last_tick_at).toLocaleTimeString()}
            {health.uptime_info.seconds_since_last_tick !== null && (
              <span> ({health.uptime_info.seconds_since_last_tick}s ago)</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
