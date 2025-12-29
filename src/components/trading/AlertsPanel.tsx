import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Bell, 
  AlertTriangle, 
  AlertOctagon,
  Info,
  Check,
  RefreshCw,
  Trash2
} from 'lucide-react';

interface Alert {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  title: string;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

export const AlertsPanel = () => {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<{
    total_24h: number;
    unacknowledged: number;
    by_severity: Record<string, number>;
  } | null>(null);
  const { toast } = useToast();

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('alert-system', {
        body: { action: 'list', limit: 20 }
      });

      if (error) throw error;

      setAlerts(data.alerts || []);

      // Fetch stats
      const { data: statsData } = await supabase.functions.invoke('alert-system', {
        body: { action: 'stats' }
      });
      if (statsData?.stats) {
        setStats(statsData.stats);
      }
    } catch (error: any) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { error } = await supabase.functions.invoke('alert-system', {
        body: { action: 'acknowledge', alert_id: alertId }
      });

      if (error) throw error;

      setAlerts(prev => prev.map(a => 
        a.id === alertId ? { ...a, acknowledged: true } : a
      ));

      toast({ title: 'Alert acknowledged' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const clearAcknowledged = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('alert-system', {
        body: { action: 'clear' }
      });

      if (error) throw error;

      toast({ title: 'Cleared', description: `${data.deleted || 0} alerts removed` });
      fetchAlerts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'emergency': return <AlertOctagon className="h-4 w-4 text-destructive" />;
      case 'critical': return <AlertOctagon className="h-4 w-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-warning" />;
      default: return <Info className="h-4 w-4 text-primary" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      emergency: 'bg-destructive text-destructive-foreground animate-pulse',
      critical: 'bg-destructive/80 text-destructive-foreground',
      warning: 'bg-warning/80 text-warning-foreground',
      info: 'bg-primary/20 text-primary',
    };
    return colors[severity] || 'bg-muted text-muted-foreground';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Alerts
            {stats?.unacknowledged ? (
              <Badge variant="destructive" className="ml-2">
                {stats.unacknowledged}
              </Badge>
            ) : null}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              onClick={clearAcknowledged}
              size="sm"
              variant="ghost"
              className="gap-1 h-7 text-xs"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </Button>
            <Button 
              onClick={fetchAlerts} 
              disabled={loading}
              size="sm"
              variant="outline"
              className="gap-1 h-7"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Row */}
        {stats && (
          <div className="flex items-center gap-4 mb-4 p-2 rounded-lg bg-secondary/30">
            <div className="text-xs">
              <span className="text-muted-foreground">24h: </span>
              <span className="font-medium">{stats.total_24h}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs gap-1 bg-destructive/10">
                <AlertOctagon className="h-3 w-3" />
                {stats.by_severity.critical + stats.by_severity.emergency}
              </Badge>
              <Badge variant="outline" className="text-xs gap-1 bg-warning/10">
                <AlertTriangle className="h-3 w-3" />
                {stats.by_severity.warning}
              </Badge>
              <Badge variant="outline" className="text-xs gap-1 bg-primary/10">
                <Info className="h-3 w-3" />
                {stats.by_severity.info}
              </Badge>
            </div>
          </div>
        )}

        {/* Alerts List */}
        <ScrollArea className="h-[300px]">
          {alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div 
                  key={alert.id}
                  className={`p-3 rounded-lg border transition-all ${
                    alert.acknowledged 
                      ? 'bg-muted/30 border-border/30 opacity-60' 
                      : 'bg-secondary/30 border-border/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      {getSeverityIcon(alert.severity)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{alert.title}</span>
                          <Badge className={`text-[10px] ${getSeverityBadge(alert.severity)}`}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {alert.message}
                        </p>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {formatTime(alert.created_at)}
                        </div>
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No alerts</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
