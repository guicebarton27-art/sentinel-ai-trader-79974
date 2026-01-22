import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Brain,
  ChevronDown, 
  ChevronUp,
  TrendingUp,
  BarChart3,
  Target,
  Zap,
  Play,
  Pause,
  Settings
} from 'lucide-react';

interface Strategy {
  id: string;
  name: string;
  type: 'trend' | 'breakout' | 'mean-revert' | 'automl' | 'rl';
  status: 'active' | 'paused' | 'training' | 'disabled';
  allocation: number;
  sharpe: number;
  drawdown: number;
  pnl: number;
  pnlPercentage: number;
}

interface CompactStrategyPanelProps {
  strategies: Strategy[];
}

const getStrategyIcon = (type: Strategy['type']) => {
  switch (type) {
    case 'trend': return TrendingUp;
    case 'breakout': return BarChart3;
    case 'mean-revert': return Target;
    case 'automl': return Brain;
    case 'rl': return Zap;
    default: return Brain;
  }
};

const getStatusColor = (status: Strategy['status']) => {
  switch (status) {
    case 'active': return 'text-success';
    case 'paused': return 'text-warning';
    case 'training': return 'text-primary';
    case 'disabled': return 'text-muted-foreground';
    default: return 'text-muted-foreground';
  }
};

const getStatusBadgeVariant = (status: Strategy['status']) => {
  switch (status) {
    case 'active': return 'default';
    case 'paused': return 'secondary';
    case 'training': return 'outline';
    case 'disabled': return 'outline';
    default: return 'outline';
  }
};

export const CompactStrategyPanel = ({ strategies }: CompactStrategyPanelProps) => {
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);

  const activeStrategies = strategies.filter(s => s.status === 'active').length;
  const totalAllocation = strategies.reduce((sum, s) => sum + s.allocation, 0);
  const avgSharpe = strategies.reduce((sum, s) => sum + s.sharpe, 0) / strategies.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Bot Strategies ({activeStrategies} active)
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              Total: {totalAllocation}% | Avg Sharpe: {avgSharpe.toFixed(2)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {strategies.map((strategy) => {
          const Icon = getStrategyIcon(strategy.type);
          const isExpanded = expandedStrategy === strategy.id;
          
          return (
            <Collapsible 
              key={strategy.id} 
              open={isExpanded} 
              onOpenChange={(open) => setExpandedStrategy(open ? strategy.id : null)}
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{strategy.name}</span>
                      <Badge variant={getStatusBadgeVariant(strategy.status)} className="text-xs">
                        {strategy.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-medium">{strategy.allocation}%</div>
                        <div className="text-xs text-muted-foreground">allocation</div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-medium">{strategy.sharpe.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">sharpe</div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-medium text-destructive">-{strategy.drawdown}%</div>
                        <div className="text-xs text-muted-foreground">max DD</div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`font-medium ${strategy.pnl > 0 ? 'text-success' : 'text-destructive'}`}>
                          {strategy.pnl > 0 ? '+' : ''}{strategy.pnlPercentage}%
                        </div>
                        <div className="text-xs text-muted-foreground">P&L</div>
                      </div>
                    </div>
                    
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="p-4 ml-7 border-l-2 border-muted space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Allocation Control</p>
                      <Progress value={strategy.allocation} className="h-2" />
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-6 px-2 text-xs">-</Button>
                        <span className="text-sm font-medium">{strategy.allocation}%</span>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-xs">+</Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Performance</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span>Sharpe:</span>
                          <span className="font-medium">{strategy.sharpe.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Max DD:</span>
                          <span className="font-medium text-destructive">-{strategy.drawdown}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>P&L:</span>
                          <span className={`font-medium ${strategy.pnl > 0 ? 'text-success' : 'text-destructive'}`}>
                            ${strategy.pnl.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Controls</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs">Active</span>
                          <Switch checked={strategy.status === 'active'} />
                        </div>
                        <Button size="sm" variant="outline" className="w-full h-6 text-xs">
                          {strategy.status === 'active' ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                          {strategy.status === 'active' ? 'Pause' : 'Start'}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Actions</p>
                      <div className="space-y-1">
                        <Button size="sm" variant="outline" className="w-full h-6 text-xs">
                          <Settings className="h-3 w-3 mr-1" />
                          Settings
                        </Button>
                        <Button size="sm" variant="outline" className="w-full h-6 text-xs">
                          Optimize
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Recent Alerts/Events */}
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium mb-2">Recent Activity</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>• Position increased to 2.5% allocation</div>
                      <div>• Sharpe ratio improved from 1.45 to {strategy.sharpe}</div>
                      <div>• Last rebalance: 2 hours ago</div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
};
