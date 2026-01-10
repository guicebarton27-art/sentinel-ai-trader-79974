import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Shield, 
  AlertTriangle, 
  Zap, 
  Activity,
  TrendingDown,
  DollarSign,
  Gauge,
  Target,
  StopCircle,
  RefreshCw
} from 'lucide-react';
import { useBotController } from '@/hooks/useBotController';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RiskLimit {
  name: string;
  current: number;
  limit: number;
  status: 'safe' | 'warning' | 'critical';
  enabled: boolean;
}

const getRiskColor = (status: RiskLimit['status']) => {
  switch (status) {
    case 'safe': return 'text-success';
    case 'warning': return 'text-warning';
    case 'critical': return 'text-destructive';
  }
};

const getRiskBadgeColor = (status: RiskLimit['status']) => {
  switch (status) {
    case 'safe': return 'bg-success text-success-foreground';
    case 'warning': return 'bg-warning text-warning-foreground';
    case 'critical': return 'bg-destructive text-destructive-foreground';
  }
};

export const RiskEngine = () => {
  const { activeBot, positions, updateBot, killBot } = useBotController();
  const { toast } = useToast();
  const [globalKillSwitch, setGlobalKillSwitch] = useState(false);
  const [loading, setLoading] = useState(false);

  // Risk settings from active bot
  const [maxPositionSize, setMaxPositionSize] = useState(10);
  const [maxDrawdown, setMaxDrawdown] = useState(15);
  const [dailyLossLimit, setDailyLossLimit] = useState(500);
  const [stopLossPct, setStopLossPct] = useState(2);
  const [takeProfitPct, setTakeProfitPct] = useState(5);

  // Sync settings when bot changes
  useEffect(() => {
    if (activeBot) {
      setMaxPositionSize(Math.round(activeBot.max_position_size * 100));
      setDailyLossLimit(activeBot.max_daily_loss);
      setStopLossPct(activeBot.stop_loss_pct);
      setTakeProfitPct(activeBot.take_profit_pct);
    }
  }, [activeBot?.id]);

  // Fetch global kill switch status
  useEffect(() => {
    const fetchKillSwitch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('global_kill_switch')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setGlobalKillSwitch(data.global_kill_switch || false);
      }
    };

    fetchKillSwitch();
  }, []);

  // Calculate risk limits based on bot data
  const calculateRiskLimits = (): RiskLimit[] => {
    if (!activeBot) return [];

    const dailyPnlPct = activeBot.starting_capital > 0 
      ? (activeBot.daily_pnl / activeBot.starting_capital) * 100 
      : 0;
    
    const dailyLossLimitPct = activeBot.starting_capital > 0
      ? (activeBot.max_daily_loss / activeBot.starting_capital) * 100
      : 5;

    const positionValue = positions.reduce((sum, p) => sum + (p.quantity * (p.current_price || p.entry_price)), 0);
    const positionPct = activeBot.current_capital > 0 
      ? (positionValue / activeBot.current_capital) * 100 
      : 0;

    const totalDrawdown = activeBot.starting_capital > 0
      ? ((activeBot.starting_capital - activeBot.current_capital) / activeBot.starting_capital) * 100
      : 0;

    return [
      { 
        name: 'Daily Loss', 
        current: Math.abs(Math.min(0, dailyPnlPct)), 
        limit: dailyLossLimitPct, 
        status: dailyPnlPct < -dailyLossLimitPct * 0.8 ? 'critical' : dailyPnlPct < -dailyLossLimitPct * 0.5 ? 'warning' : 'safe',
        enabled: true 
      },
      { 
        name: 'Max Drawdown', 
        current: Math.max(0, totalDrawdown), 
        limit: maxDrawdown, 
        status: totalDrawdown > maxDrawdown * 0.8 ? 'critical' : totalDrawdown > maxDrawdown * 0.5 ? 'warning' : 'safe',
        enabled: true 
      },
      { 
        name: 'Position Size', 
        current: positionPct, 
        limit: maxPositionSize, 
        status: positionPct > maxPositionSize * 0.9 ? 'critical' : positionPct > maxPositionSize * 0.7 ? 'warning' : 'safe',
        enabled: true 
      },
      { 
        name: 'Stop Loss', 
        current: stopLossPct, 
        limit: 10, 
        status: 'safe',
        enabled: true 
      },
    ];
  };

  const riskLimits = calculateRiskLimits();
  const criticalAlerts = riskLimits.filter(limit => limit.status === 'critical').length;
  const warningAlerts = riskLimits.filter(limit => limit.status === 'warning').length;

  // Calculate risk metrics
  const riskScore = activeBot ? Math.min(10, (criticalAlerts * 3 + warningAlerts * 1.5 + (activeBot.error_count * 0.5))) : 0;
  const currentDrawdown = activeBot && activeBot.starting_capital > 0
    ? ((activeBot.starting_capital - activeBot.current_capital) / activeBot.starting_capital) * 100
    : 0;
  const winRate = activeBot && activeBot.total_trades > 0
    ? (activeBot.winning_trades / activeBot.total_trades) * 100
    : 0;

  const handleGlobalKillSwitch = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update profile
      await supabase
        .from('profiles')
        .update({ 
          global_kill_switch: true,
          kill_switch_activated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      // Kill all running bots
      const { data: bots } = await supabase
        .from('bots')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'running');

      if (bots) {
        for (const bot of bots) {
          await killBot(bot.id);
        }
      }

      setGlobalKillSwitch(true);
      toast({
        title: 'Global Kill Switch Activated',
        description: 'All bots have been stopped',
        variant: 'destructive',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to activate kill switch',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetKillSwitch = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('profiles')
        .update({ global_kill_switch: false })
        .eq('user_id', user.id);

      setGlobalKillSwitch(false);
      toast({
        title: 'Kill Switch Reset',
        description: 'You can now start bots again',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to reset kill switch',
        variant: 'destructive',
      });
    }
  };

  const handleSaveRiskSettings = async () => {
    if (!activeBot) return;
    try {
      await updateBot(activeBot.id, {
        max_position_size: maxPositionSize / 100,
        max_daily_loss: dailyLossLimit,
        stop_loss_pct: stopLossPct,
        take_profit_pct: takeProfitPct,
      });
      toast({
        title: 'Risk Settings Saved',
        description: 'Settings have been updated',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    }
  };

  if (!activeBot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Risk Engine
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12 text-muted-foreground">
          Select a bot to view risk metrics
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Risk Overview */}
      <Card className="border-l-4 border-l-warning">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-warning" />
            Risk Engine
            {(criticalAlerts > 0 || warningAlerts > 0) && (
              <Badge variant="destructive" className="ml-auto">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {criticalAlerts + warningAlerts} Alerts
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center space-y-1">
              <p className={`text-2xl font-bold ${riskScore > 7 ? 'text-destructive' : riskScore > 4 ? 'text-warning' : 'text-success'}`}>
                {riskScore.toFixed(1)}
              </p>
              <p className="text-sm text-muted-foreground">Risk Score</p>
              <Progress value={riskScore * 10} className="h-2" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold">{activeBot.daily_pnl.toFixed(2)}%</p>
              <p className="text-sm text-muted-foreground">Daily P&L</p>
            </div>
            <div className="text-center space-y-1">
              <p className={`text-2xl font-bold ${currentDrawdown > 10 ? 'text-destructive' : 'text-foreground'}`}>
                {currentDrawdown.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground">Current DD</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold">{winRate.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground">Win Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Risk Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Risk Limits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {riskLimits.map((limit, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{limit.name}</span>
                  </div>
                  <Badge className={getRiskBadgeColor(limit.status)}>
                    {limit.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Current: <span className={getRiskColor(limit.status)}>{limit.current.toFixed(1)}%</span></span>
                  <span>Limit: {limit.limit}%</span>
                </div>
                <Progress 
                  value={Math.min(100, (limit.current / limit.limit) * 100)} 
                  className="h-2"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Kill Switch & Emergency Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StopCircle className="h-5 w-5 text-destructive" />
              Emergency Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Global Kill Switch */}
            <div className={`p-4 border rounded-lg ${globalKillSwitch ? 'border-destructive bg-destructive/10' : 'border-destructive/20 bg-destructive/5'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="space-y-1">
                  <h4 className="font-medium text-destructive">Global Kill Switch</h4>
                  <p className="text-xs text-muted-foreground">
                    {globalKillSwitch ? 'All trading is halted' : 'Emergency stop all trading'}
                  </p>
                </div>
                {globalKillSwitch ? (
                  <Button variant="outline" size="sm" onClick={handleResetKillSwitch}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                ) : (
                  <Button variant="destructive" size="lg" onClick={handleGlobalKillSwitch} disabled={loading}>
                    <StopCircle className="h-4 w-4 mr-2" />
                    KILL
                  </Button>
                )}
              </div>
            </div>

            {/* Position Limits */}
            <div className="space-y-4">
              <h4 className="font-medium">Risk Parameters</h4>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">Max Position Size: {maxPositionSize}%</Label>
                  <Slider 
                    value={[maxPositionSize]} 
                    onValueChange={(v) => setMaxPositionSize(v[0])}
                    max={25} 
                    min={1} 
                    step={1}
                    disabled={activeBot.status === 'running'}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Max Drawdown: {maxDrawdown}%</Label>
                  <Slider 
                    value={[maxDrawdown]} 
                    onValueChange={(v) => setMaxDrawdown(v[0])}
                    max={30} 
                    min={5} 
                    step={1}
                    disabled={activeBot.status === 'running'}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Daily Loss Limit</Label>
                  <Input 
                    type="number"
                    value={dailyLossLimit}
                    onChange={(e) => setDailyLossLimit(Number(e.target.value))}
                    disabled={activeBot.status === 'running'}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Stop Loss: {stopLossPct}%</Label>
                  <Slider 
                    value={[stopLossPct]} 
                    onValueChange={(v) => setStopLossPct(v[0])}
                    max={10} 
                    min={0.5} 
                    step={0.5}
                    disabled={activeBot.status === 'running'}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Take Profit: {takeProfitPct}%</Label>
                  <Slider 
                    value={[takeProfitPct]} 
                    onValueChange={(v) => setTakeProfitPct(v[0])}
                    max={20} 
                    min={1} 
                    step={0.5}
                    disabled={activeBot.status === 'running'}
                  />
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={handleSaveRiskSettings}
                disabled={activeBot.status === 'running'}
              >
                Save Risk Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Metrics Detail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">Current Drawdown</span>
              </div>
              <p className="text-2xl font-bold">{currentDrawdown.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">From peak capital</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium">Total Trades</span>
              </div>
              <p className="text-2xl font-bold">{activeBot.total_trades}</p>
              <p className="text-xs text-muted-foreground">{activeBot.winning_trades} winners</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Error Count</span>
              </div>
              <p className={`text-2xl font-bold ${activeBot.error_count > 5 ? 'text-destructive' : ''}`}>
                {activeBot.error_count}
              </p>
              <p className="text-xs text-muted-foreground">Since last reset</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">Total P&L</span>
              </div>
              <p className={`text-2xl font-bold ${activeBot.total_pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                ${activeBot.total_pnl.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">All time</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
