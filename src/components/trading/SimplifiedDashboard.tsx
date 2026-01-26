import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  Square,
  TrendingUp,
  TrendingDown,
  Wallet,
  Activity,
  Shield,
  Zap,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Bot,
  BarChart3,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimplifiedDashboardProps {
  botStatus: 'stopped' | 'running' | 'paused' | 'error';
  portfolioValue: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  riskLevel: 'low' | 'medium' | 'high';
  openPositions: number;
  winRate: number;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onViewDetails: () => void;
}

export const SimplifiedDashboard = ({
  botStatus,
  portfolioValue,
  dailyPnl,
  dailyPnlPercent,
  riskLevel,
  openPositions,
  winRate,
  onStart,
  onPause,
  onStop,
  onViewDetails,
}: SimplifiedDashboardProps) => {
  const [showBalance, setShowBalance] = useState(true);
  
  const isProfitable = dailyPnl >= 0;
  const isRunning = botStatus === 'running';
  const isPaused = botStatus === 'paused';
  
  const getRiskColor = () => {
    switch (riskLevel) {
      case 'low': return 'text-success bg-success/10';
      case 'medium': return 'text-warning bg-warning/10';
      case 'high': return 'text-destructive bg-destructive/10';
    }
  };

  const getStatusConfig = () => {
    switch (botStatus) {
      case 'running':
        return { 
          color: 'bg-success', 
          text: 'Trading', 
          icon: Activity,
          pulse: true 
        };
      case 'paused':
        return { 
          color: 'bg-warning', 
          text: 'Paused', 
          icon: Pause,
          pulse: false 
        };
      case 'error':
        return { 
          color: 'bg-destructive', 
          text: 'Error', 
          icon: AlertTriangle,
          pulse: true 
        };
      default:
        return { 
          color: 'bg-muted', 
          text: 'Stopped', 
          icon: Square,
          pulse: false 
        };
    }
  };

  const status = getStatusConfig();
  const StatusIcon = status.icon;

  return (
    <div className="space-y-4 p-4 max-w-lg mx-auto">
      {/* Main Status Card */}
      <Card className="glass-panel border-border/50 overflow-hidden">
        {/* Status Bar */}
        <div className={cn(
          "h-1 w-full transition-all duration-500",
          status.color,
          status.pulse && "animate-pulse"
        )} />
        
        <CardContent className="p-6 space-y-6">
          {/* Bot Status & Quick Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-xl",
                isRunning ? "bg-success/10" : "bg-muted"
              )}>
                <Bot className={cn(
                  "h-6 w-6 transition-colors",
                  isRunning ? "text-success" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Sentinel AI</span>
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", status.color.replace('bg-', 'text-').replace('/10', ''))}
                  >
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {status.text}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">BTC/USD • Paper Mode</p>
              </div>
            </div>
            
            {/* Quick Action Button */}
            {isRunning ? (
              <Button 
                size="lg" 
                variant="outline"
                onClick={onPause}
                className="h-12 w-12 rounded-full p-0"
              >
                <Pause className="h-5 w-5" />
              </Button>
            ) : isPaused ? (
              <Button 
                size="lg"
                onClick={onStart}
                className="h-12 w-12 rounded-full p-0 bg-success hover:bg-success/90"
              >
                <Play className="h-5 w-5" />
              </Button>
            ) : (
              <Button 
                size="lg"
                onClick={onStart}
                className="h-12 px-6 rounded-full bg-gradient-to-r from-primary to-accent"
              >
                <Play className="h-4 w-4 mr-2" />
                Start
              </Button>
            )}
          </div>

          {/* Portfolio Value */}
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Portfolio Value</span>
              <button 
                onClick={() => setShowBalance(!showBalance)}
                className="text-muted-foreground hover:text-foreground"
              >
                {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
            <div className="text-4xl font-bold font-mono tracking-tight">
              {showBalance ? `$${portfolioValue.toLocaleString()}` : '••••••'}
            </div>
          </div>

          {/* Daily P&L */}
          <div className={cn(
            "flex items-center justify-center gap-2 py-3 rounded-xl transition-colors",
            isProfitable ? "bg-success/10" : "bg-destructive/10"
          )}>
            {isProfitable ? (
              <TrendingUp className="h-5 w-5 text-success" />
            ) : (
              <TrendingDown className="h-5 w-5 text-destructive" />
            )}
            <span className={cn(
              "text-xl font-bold font-mono",
              isProfitable ? "text-success" : "text-destructive"
            )}>
              {isProfitable ? '+' : ''}{showBalance ? `$${Math.abs(dailyPnl).toLocaleString()}` : '••••'}
            </span>
            <Badge 
              variant="outline"
              className={cn(
                "font-mono",
                isProfitable ? "text-success border-success/30" : "text-destructive border-destructive/30"
              )}
            >
              {isProfitable ? '+' : ''}{dailyPnlPercent.toFixed(2)}%
            </Badge>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-xl bg-muted/50">
              <div className="text-2xl font-bold">{openPositions}</div>
              <div className="text-xs text-muted-foreground">Positions</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/50">
              <div className="text-2xl font-bold text-success">{winRate}%</div>
              <div className="text-xs text-muted-foreground">Win Rate</div>
            </div>
            <div className={cn("text-center p-3 rounded-xl", getRiskColor())}>
              <Shield className="h-5 w-5 mx-auto mb-1" />
              <div className="text-xs font-medium capitalize">{riskLevel} Risk</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Bar */}
      {isRunning && (
        <Card className="glass-panel border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-sm">Live trading active</span>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={onStop}
                className="gap-2"
              >
                <Square className="h-3 w-3" />
                Stop
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Details Button */}
      <Button 
        variant="outline" 
        className="w-full py-6 justify-between"
        onClick={onViewDetails}
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span>View Full Dashboard</span>
        </div>
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
};
