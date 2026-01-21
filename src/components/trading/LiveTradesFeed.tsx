import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';
import { Position, Order, BotEvent } from '@/hooks/useBotController';
import { formatDistanceToNow } from 'date-fns';

interface LiveTradesFeedProps {
  positions: Position[];
  recentOrders: Order[];
  recentEvents: BotEvent[];
}

export const LiveTradesFeed = ({ positions, recentOrders, recentEvents }: LiveTradesFeedProps) => {
  const openPositions = positions.filter(p => p.status === 'open');
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-destructive bg-destructive/10';
      case 'error': return 'text-destructive bg-destructive/10';
      case 'warn': return 'text-warning bg-warning/10';
      case 'info': return 'text-primary bg-primary/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'fill': return <ArrowUpRight className="h-3 w-3" />;
      case 'order': return <Activity className="h-3 w-3" />;
      case 'risk_alert': return <AlertCircle className="h-3 w-3" />;
      case 'error': return <AlertCircle className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Open Positions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Open Positions
            <Badge variant="outline" className="ml-auto">{openPositions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {openPositions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No open positions</p>
            ) : (
              <div className="space-y-2">
                {openPositions.map((position) => (
                  <div key={position.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      {position.side === 'buy' ? (
                        <ArrowUpRight className="h-4 w-4 text-success" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-destructive" />
                      )}
                      <div>
                        <div className="text-sm font-medium">{position.symbol}</div>
                        <div className="text-xs text-muted-foreground">
                          {position.quantity.toFixed(6)} @ ${position.entry_price.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${position.unrealized_pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {position.unrealized_pnl >= 0 ? '+' : ''}${position.unrealized_pnl.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(position.opened_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" />
            Recent Orders
            <Badge variant="outline" className="ml-auto">{recentOrders.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent orders</p>
            ) : (
              <div className="space-y-2">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      {order.side === 'buy' ? (
                        <ArrowUpRight className="h-4 w-4 text-success" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-destructive" />
                      )}
                      <div>
                        <div className="text-sm font-medium">{order.symbol}</div>
                        <div className="text-xs text-muted-foreground">
                          {order.quantity.toFixed(6)} @ ${(order.average_fill_price || order.price || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={order.status === 'filled' ? 'default' : order.status === 'rejected' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {order.status}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Bot Events */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            Bot Events
            <Badge variant="outline" className="ml-auto">{recentEvents.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent events</p>
            ) : (
              <div className="space-y-2">
                {recentEvents.slice(0, 10).map((event) => (
                  <div key={event.id} className="p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-xs ${getSeverityColor(event.severity)}`}>
                        {getEventIcon(event.event_type)}
                        <span className="ml-1">{event.event_type}</span>
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{event.message}</p>
                    {event.market_price && (
                      <p className="text-xs text-primary mt-1">Price: ${event.market_price.toFixed(2)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
