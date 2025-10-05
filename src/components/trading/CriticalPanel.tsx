import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle
} from 'lucide-react';

interface CriticalPanelProps {
  portfolioPnl: number;
  portfolioPnlPercentage: number;
  totalPnlPercentage: number;
  currentDrawdown: number;
  riskScore: 'safe' | 'warning' | 'danger';
  botStatus: 'running' | 'paused' | 'stopped';
}

export const CriticalPanel = ({ 
  portfolioPnl,
  portfolioPnlPercentage,
  totalPnlPercentage,
  currentDrawdown,
  riskScore,
  botStatus
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
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
              className="justify-center w-full"
            >
              <Bot className="h-3 w-3 mr-1" />
              {botStatus === 'running' ? 'Active' : botStatus === 'paused' ? 'Paused' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};