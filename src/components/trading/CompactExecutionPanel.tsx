import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Zap, Clock, ListOrdered } from 'lucide-react';

interface ExecutionMetrics {
  fillRate: number;
  slippage: number;
  latency: number;
  ordersToday: number;
}

interface CompactExecutionPanelProps {
  metrics: ExecutionMetrics;
}

export const CompactExecutionPanel = ({ metrics }: CompactExecutionPanelProps) => {
  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'text-success';
    if (value >= thresholds.warning) return 'text-warning';
    return 'text-destructive';
  };

  const getLatencyColor = (latency: number) => {
    if (latency <= 20) return 'text-success';
    if (latency <= 50) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Execution Summary</span>
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Fill Rate:</span>
              <span className={`font-medium ${getStatusColor(metrics.fillRate, { good: 95, warning: 90 })}`}>
                {metrics.fillRate}%
              </span>
            </div>
            
            <div className="h-4 w-px bg-border" />
            
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Slippage:</span>
              <span className={`font-medium ${getStatusColor(100 - metrics.slippage * 100, { good: 99, warning: 98 })}`}>
                {metrics.slippage.toFixed(2)}%
              </span>
            </div>
            
            <div className="h-4 w-px bg-border" />
            
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Latency:</span>
              <span className={`font-medium ${getLatencyColor(metrics.latency)}`}>
                {metrics.latency}ms
              </span>
            </div>
            
            <div className="h-4 w-px bg-border" />
            
            <div className="flex items-center gap-1">
              <ListOrdered className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Orders:</span>
              <span className="font-medium">{metrics.ordersToday}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};