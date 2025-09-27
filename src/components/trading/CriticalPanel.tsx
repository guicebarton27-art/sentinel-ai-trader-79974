import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Bot, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Play,
  Pause,
  Power
} from 'lucide-react';

interface CriticalPanelProps {
  portfolioPnl: number;
  portfolioPnlPercentage: number;
  totalPnlPercentage: number;
  currentDrawdown: number;
  riskScore: 'safe' | 'warning' | 'danger';
  botStatus: 'running' | 'paused' | 'stopped';
  onBotStatusChange: (status: 'running' | 'paused' | 'stopped') => void;
  onKillSwitch: () => void;
}

export const CriticalPanel = ({ 
  portfolioPnl,
  portfolioPnlPercentage,
  totalPnlPercentage,
  currentDrawdown,
  riskScore,
  botStatus,
  onBotStatusChange,
  onKillSwitch
}: CriticalPanelProps) => {
  const getRiskColor = (score: string) => {
    switch (score) {
      case 'safe': return 'text-success';
      case 'warning': return 'text-warning';
      case 'danger': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getRiskBadgeVariant = (score: string) => {
    switch (score) {
      case 'safe': return 'default';
      case 'warning': return 'secondary';
      case 'danger': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
          {/* Portfolio P&L */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Today P&L</p>
            <div className={`text-lg font-bold flex items-center gap-1 ${
              portfolioPnl > 0 ? 'text-success' : 'text-destructive'
            }`}>
              {portfolioPnl > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {portfolioPnl > 0 ? '+' : ''}{portfolioPnlPercentage}%
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {totalPnlPercentage > 0 ? '+' : ''}{totalPnlPercentage}%
            </p>
          </div>

          {/* Current Drawdown */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Current DD</p>
            <div className="text-lg font-bold text-destructive">
              -{currentDrawdown}%
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div 
                className="bg-destructive h-1.5 rounded-full transition-all" 
                style={{ width: `${Math.min(currentDrawdown * 2, 100)}%` }}
              />
            </div>
          </div>

          {/* Risk Score */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Risk Level</p>
            <Badge variant={getRiskBadgeVariant(riskScore)} className="justify-center">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {riskScore === 'safe' ? '🟢 Safe' : riskScore === 'warning' ? '🟡 Warning' : '🔴 Danger'}
            </Badge>
          </div>

          {/* Bot Status */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Bot Status</p>
            <Badge 
              variant={botStatus === 'running' ? 'default' : botStatus === 'paused' ? 'secondary' : 'outline'}
              className="justify-center"
            >
              <Bot className="h-3 w-3 mr-1" />
              {botStatus === 'running' ? 'Active' : botStatus === 'paused' ? 'Paused' : 'Inactive'}
            </Badge>
            <div className="flex gap-1">
              <Button
                variant={botStatus === 'running' ? 'destructive' : 'default'}
                size="sm"
                className="flex-1 h-6 px-2 text-xs"
                onClick={() => onBotStatusChange(botStatus === 'running' ? 'stopped' : 'running')}
              >
                {botStatus === 'running' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {/* Kill Switch */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Emergency</p>
            <Button
              variant="destructive"
              size="sm"
              className="w-full h-8 font-bold"
              onClick={onKillSwitch}
            >
              <Power className="h-4 w-4 mr-1" />
              KILL
            </Button>
            <p className="text-xs text-muted-foreground">Close all positions</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};