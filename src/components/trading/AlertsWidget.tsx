import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, 
  BellOff,
  AlertTriangle, 
  XCircle,
  CheckCircle2,
  Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  acknowledged: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}

export const AlertsWidget = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAlerts = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('acknowledged', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setAlerts(data as Alert[]);
      }
      setLoading(false);
    };

    fetchAlerts();

    // Subscribe to new alerts
    const channel = supabase
      .channel('alerts-widget')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          const newAlert = payload.new as Alert;
          setAlerts(prev => [newAlert, ...prev.slice(0, 9)]);
          
          // Show toast for critical alerts
          if (newAlert.severity === 'critical' || newAlert.severity === 'emergency') {
            toast({
              title: `🚨 ${newAlert.title}`,
              description: newAlert.message,
              variant: 'destructive',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const acknowledgeAlert = async (alertId: string) => {
    const { error } = await supabase
      .from('alerts')
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq('id', alertId);

    if (!error) {
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    }
  };

  const acknowledgeAll = async () => {
    const alertIds = alerts.map(a => a.id);
    const { error } = await supabase
      .from('alerts')
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
      .in('id', alertIds);

    if (!error) {
      setAlerts([]);
      toast({
        title: 'All alerts acknowledged',
        description: `${alertIds.length} alerts cleared`,
      });
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'emergency':
      case 'critical':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'info':
      default:
        return <Info className="h-4 w-4 text-primary" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'emergency':
        return <Badge variant="destructive" className="text-xs">Emergency</Badge>;
      case 'critical':
        return <Badge variant="destructive" className="text-xs">Critical</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="text-xs border-yellow-500 text-yellow-600">Warning</Badge>;
      case 'info':
      default:
        return <Badge variant="secondary" className="text-xs">Info</Badge>;
    }
  };

  if (loading) {
    return null;
  }

  if (alerts.length === 0) {
    return null;
  }

  return (
    <Card className="border-yellow-500/50 bg-yellow-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-yellow-500" />
            Active Alerts
            <Badge variant="outline" className="ml-1">{alerts.length}</Badge>
          </div>
          {alerts.length > 0 && (
            <Button variant="ghost" size="sm" onClick={acknowledgeAll}>
              <BellOff className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-48">
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div 
                key={alert.id}
                className="flex items-start gap-3 p-2 rounded-lg border bg-background"
              >
                {getSeverityIcon(alert.severity)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getSeverityBadge(alert.severity)}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{alert.message}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 shrink-0"
                  onClick={() => acknowledgeAlert(alert.id)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AlertsWidget;
