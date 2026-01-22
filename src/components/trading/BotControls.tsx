import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Play, 
  Pause, 
  Square, 
  Settings, 
  Shield, 
  TrendingUp, 
  AlertTriangle,
  Bot,
  Zap,
  RefreshCw,
  Plus,
  Trash2,
  Wifi,
  Timer
} from 'lucide-react';
import { useBotController } from '@/hooks/useBotController';
import { useToast } from '@/hooks/use-toast';

interface BotControlsProps {
  botStatus?: 'running' | 'paused' | 'stopped';
  onStatusChange?: (status: 'running' | 'paused' | 'stopped') => void;
}

export const BotControls = ({ onStatusChange }: BotControlsProps) => {
  const { 
    bots, 
    activeBot, 
    positions,
    health,
    loading, 
    error,
    fetchBots,
    setActiveBot,
    createBot,
    startBot,
    pauseBot,
    stopBot,
    killBot,
    updateBot,
    deleteBot,
    fetchLiveStatus,
    requestLiveArm,
    confirmLiveArm,
    runConnectivityCheck,
    runDryRun,
    setKillSwitch
  } = useBotController();
  
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [newBotName, setNewBotName] = useState('My Trading Bot');
  const [newBotSymbol, setNewBotSymbol] = useState('BTC/USD');
  const [newBotStrategy, setNewBotStrategy] = useState('trend_following');
  const [newBotMode, setNewBotMode] = useState<'paper' | 'live'>('paper');
  const [startMode, setStartMode] = useState<'paper' | 'live' | 'backtest'>('paper');
  const [liveStatus, setLiveStatus] = useState<{
    liveEnabled: boolean;
    killSwitchActive: boolean;
    secretsReady: boolean;
    liveReady: boolean;
    killSwitchActivatedAt?: string | null;
  } | null>(null);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<string | null>(null);
  
  // Risk settings for new bot
  const [positionSize, setPositionSize] = useState(10);
  const [stopLoss, setStopLoss] = useState(2.5);
  const [takeProfit, setTakeProfit] = useState(5.0);
  const [maxDailyLoss, setMaxDailyLoss] = useState(500);
  const [startingCapital, setStartingCapital] = useState(10000);

  const botStatus = activeBot?.status || 'stopped';

  // Sync status changes with parent if callback provided
  useEffect(() => {
    if (onStatusChange && activeBot) {
      onStatusChange(activeBot.status as 'running' | 'paused' | 'stopped');
    }
  }, [activeBot?.status, onStatusChange]);

  useEffect(() => {
    if (activeBot?.mode) {
      setStartMode(activeBot.mode);
    }
  }, [activeBot?.mode]);

  const refreshLiveStatus = useCallback(async () => {
    try {
      const status = await fetchLiveStatus();
      setLiveStatus({
        liveEnabled: status.live_enabled,
        killSwitchActive: status.kill_switch_active,
        secretsReady: status.secrets_ready,
        liveReady: status.live_ready,
        killSwitchActivatedAt: status.kill_switch_activated_at,
      });
    } catch (err) {
      console.error('Failed to load live status', err);
    }
  }, [fetchLiveStatus]);

  useEffect(() => {
    refreshLiveStatus();
  }, [refreshLiveStatus]);

  const handleCreateBot = useCallback(async () => {
    try {
      await createBot({
        name: newBotName,
        symbol: newBotSymbol,
        mode: newBotMode,
        strategy_id: newBotStrategy,
        risk_params: {
          max_position_size: positionSize / 100,
          stop_loss_pct: stopLoss,
          take_profit_pct: takeProfit,
          max_daily_loss: maxDailyLoss,
          starting_capital: startingCapital,
        }
      });
      setIsCreating(false);
      toast({
        title: 'Bot Created',
        description: `${newBotName} has been created successfully`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to create bot',
        variant: 'destructive',
      });
    }
  }, [createBot, newBotName, newBotSymbol, newBotMode, newBotStrategy, positionSize, stopLoss, takeProfit, maxDailyLoss, startingCapital, toast]);

  const handleStartBot = useCallback(async () => {
    if (!activeBot) return;
    try {
      if (startMode === 'backtest') {
        toast({
          title: 'Backtest Mode',
          description: 'Use the Backtest panel to run historical simulations.',
        });
        return;
      }
      if (startMode === 'live' && !liveStatus?.liveReady) {
        toast({
          title: 'Live Mode Unavailable',
          description: 'Live trading is not configured or enabled.',
          variant: 'destructive',
        });
        return;
      }

      await startBot(activeBot.id, startMode);
      toast({
        title: 'Bot Started',
        description: `${activeBot.name} is now running in ${startMode} mode`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to start bot',
        variant: 'destructive',
      });
    }
  }, [activeBot, startBot, startMode, toast, liveStatus?.liveReady]);

  const handlePauseBot = useCallback(async () => {
    if (!activeBot) return;
    try {
      await pauseBot(activeBot.id);
      toast({
        title: 'Bot Paused',
        description: `${activeBot.name} has been paused`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to pause bot',
        variant: 'destructive',
      });
    }
  }, [activeBot, pauseBot, toast]);

  const handleStopBot = useCallback(async () => {
    if (!activeBot) return;
    try {
      await stopBot(activeBot.id);
      toast({
        title: 'Bot Stopped',
        description: `${activeBot.name} has been stopped`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to stop bot',
        variant: 'destructive',
      });
    }
  }, [activeBot, stopBot, toast]);

  const handleKillBot = useCallback(async () => {
    if (!activeBot) return;
    try {
      await killBot(activeBot.id);
      toast({
        title: 'Emergency Stop',
        description: `${activeBot.name} has been killed and all orders canceled`,
        variant: 'destructive',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to kill bot',
        variant: 'destructive',
      });
    }
  }, [activeBot, killBot, toast]);

  const handleDeleteBot = useCallback(async () => {
    if (!activeBot) return;
    if (activeBot.status === 'running') {
      toast({
        title: 'Cannot Delete',
        description: 'Stop the bot before deleting',
        variant: 'destructive',
      });
      return;
    }
    try {
      await deleteBot(activeBot.id);
      toast({
        title: 'Bot Deleted',
        description: `${activeBot.name} has been deleted`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete bot',
        variant: 'destructive',
      });
    }
  }, [activeBot, deleteBot, toast]);

  const handleUpdateRiskSettings = useCallback(async () => {
    if (!activeBot) return;
    try {
      await updateBot(activeBot.id, {
        max_position_size: positionSize / 100,
        stop_loss_pct: stopLoss,
        take_profit_pct: takeProfit,
        max_daily_loss: maxDailyLoss,
      });
      toast({
        title: 'Settings Updated',
        description: 'Risk settings have been saved',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive',
      });
    }
  }, [activeBot, updateBot, positionSize, stopLoss, takeProfit, maxDailyLoss, toast]);

  const handleConnectivityCheck = useCallback(async () => {
    if (!activeBot) return;
    try {
      const result = await runConnectivityCheck(activeBot.id);
      if (!result.success) {
        throw new Error(result.error?.message || 'Connectivity check failed');
      }
      toast({
        title: 'Connectivity Check Passed',
        description: `Balances OK. Ticker: ${result.data?.ticker_price ?? 'N/A'}`,
      });
    } catch (err) {
      toast({
        title: 'Connectivity Check Failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  }, [activeBot, runConnectivityCheck, toast]);

  const handleDryRun = useCallback(async () => {
    if (!activeBot) return;
    try {
      const result = await runDryRun(activeBot.id);
      if (!result.success) {
        throw new Error(result.error?.message || 'Dry-run failed');
      }
      toast({
        title: 'Dry-run Submitted',
        description: 'Kraken validated the order without placing it.',
      });
    } catch (err) {
      toast({
        title: 'Dry-run Failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  }, [activeBot, runDryRun, toast]);

  const handleArmLive = useCallback(async () => {
    if (!activeBot) return;
    try {
      const request = await requestLiveArm(activeBot.id);
      toast({
        title: 'Live Arm Token Generated',
        description: `Confirmation token: ${request.token}`,
      });

      const confirmation = window.prompt('Enter the confirmation token to ARM LIVE');
      if (!confirmation) {
        toast({
          title: 'Live Arm Cancelled',
          description: 'Confirmation token was not provided.',
          variant: 'destructive',
        });
        return;
      }

      const result = await confirmLiveArm(activeBot.id, confirmation.trim());
      setCooldownEndsAt(result.cooldown_ends_at);
      await refreshLiveStatus();
      toast({
        title: 'Live Armed',
        description: `Cooldown active until ${new Date(result.cooldown_ends_at).toLocaleTimeString()}`,
      });
    } catch (err) {
      toast({
        title: 'Live Arm Failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  }, [activeBot, requestLiveArm, confirmLiveArm, refreshLiveStatus, toast]);

  const handleToggleKillSwitch = useCallback(async () => {
    if (!liveStatus) return;
    try {
      const result = await setKillSwitch(!liveStatus.killSwitchActive);
      await refreshLiveStatus();
      toast({
        title: result.kill_switch_active ? 'Kill Switch Activated' : 'Kill Switch Disabled',
        description: result.kill_switch_active ? 'Live trading is now blocked.' : 'Live trading is now unblocked.',
        variant: result.kill_switch_active ? 'destructive' : 'default',
      });
    } catch (err) {
      toast({
        title: 'Kill Switch Update Failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  }, [liveStatus, refreshLiveStatus, setKillSwitch, toast]);

  // Sync risk settings when active bot changes
  useEffect(() => {
    if (activeBot) {
      setPositionSize(Math.round(activeBot.max_position_size * 100));
      setStopLoss(activeBot.stop_loss_pct);
      setTakeProfit(activeBot.take_profit_pct);
      setMaxDailyLoss(activeBot.max_daily_loss);
      setStartingCapital(activeBot.starting_capital);
    }
  }, [activeBot?.id]);

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchBots} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Bot Status & Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Bot Status
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsCreating(true)}
              disabled={isCreating}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bot Selector */}
          {bots.length > 0 && (
            <div className="space-y-2">
              <Label>Select Bot</Label>
              <Select 
                value={activeBot?.id || ''} 
                onValueChange={(id) => {
                  const bot = bots.find(b => b.id === id);
                  if (bot) setActiveBot(bot);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a bot" />
                </SelectTrigger>
                <SelectContent>
                  {bots.map((bot) => (
                    <SelectItem key={bot.id} value={bot.id}>
                      {bot.name} ({bot.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Create New Bot Form */}
          {isCreating && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h4 className="font-medium">Create New Bot</h4>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input 
                  value={newBotName} 
                  onChange={(e) => setNewBotName(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label>Symbol</Label>
                <Select value={newBotSymbol} onValueChange={setNewBotSymbol}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BTC/USD">BTC/USD</SelectItem>
                    <SelectItem value="ETH/USD">ETH/USD</SelectItem>
                    <SelectItem value="XRP/USD">XRP/USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Strategy</Label>
                <Select value={newBotStrategy} onValueChange={setNewBotStrategy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trend_following">Trend Following</SelectItem>
                    <SelectItem value="mean_reversion">Mean Reversion</SelectItem>
                    <SelectItem value="breakout">Breakout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={newBotMode} onValueChange={(v) => setNewBotMode(v as 'paper' | 'live')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paper">Paper Trading</SelectItem>
                    <SelectItem value="live" disabled={!liveStatus?.liveReady}>
                      Live Trading {liveStatus?.liveReady ? '' : '(unavailable)'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Starting Capital</Label>
                <Input 
                  type="number"
                  value={startingCapital} 
                  onChange={(e) => setStartingCapital(Number(e.target.value))} 
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateBot} className="flex-1">Create</Button>
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Bot Status Display */}
          {activeBot && !isCreating && (
            <>
              <div className="text-center space-y-4">
                <Badge 
                  variant={botStatus === 'running' ? 'default' : botStatus === 'paused' ? 'secondary' : 'outline'}
                  className="text-lg px-4 py-2"
                >
                  {botStatus === 'running' ? 'Active Trading' : botStatus === 'paused' ? 'Paused' : botStatus === 'error' ? 'Error' : 'Inactive'}
                </Badge>
                
                <div className="text-sm text-muted-foreground">
                  Mode: <span className="font-medium">{activeBot.mode === 'live' ? 'LIVE' : 'Paper'}</span>
                </div>
                
                <div className="grid gap-2">
                  <div className="space-y-2 text-left">
                    <Label>Run Mode</Label>
                    <Select value={startMode} onValueChange={(v) => setStartMode(v as 'paper' | 'live' | 'backtest')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paper">Paper Trading</SelectItem>
                        <SelectItem value="backtest">Backtest (use Backtest panel)</SelectItem>
                        <SelectItem value="live" disabled={!liveStatus?.liveReady}>
                          Live Trading {liveStatus?.liveReady ? '' : '(unavailable)'}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={handleStartBot} 
                    disabled={botStatus === 'running' || (startMode === 'live' && !liveStatus?.liveReady)}
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start Bot
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={handlePauseBot} 
                    disabled={botStatus !== 'running'}
                    className="flex items-center gap-2"
                  >
                    <Pause className="h-4 w-4" />
                    Pause Bot
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleStopBot} 
                    disabled={botStatus === 'stopped'}
                    className="flex items-center gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Stop Bot
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Live Controls
                </h4>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Kill Switch</span>
                  <Badge variant={liveStatus?.killSwitchActive ? 'destructive' : 'secondary'}>
                    {liveStatus?.killSwitchActive ? 'ON' : 'OFF'}
                  </Badge>
                </div>
                {liveStatus?.killSwitchActivatedAt && liveStatus.killSwitchActive && (
                  <div className="text-xs text-muted-foreground">
                    Activated at {new Date(liveStatus.killSwitchActivatedAt).toLocaleString()}
                  </div>
                )}
                {cooldownEndsAt && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Timer className="h-3 w-3" />
                    Cooldown until {new Date(cooldownEndsAt).toLocaleTimeString()}
                  </div>
                )}
                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    onClick={handleConnectivityCheck}
                    disabled={!activeBot?.api_key_id}
                    className="flex items-center gap-2"
                  >
                    <Wifi className="h-4 w-4" />
                    Connectivity Check
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDryRun}
                    disabled={!activeBot?.api_key_id}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Dry-run Live
                  </Button>
                  <Button
                    onClick={handleArmLive}
                    disabled={!activeBot?.api_key_id || !liveStatus?.liveReady || liveStatus?.killSwitchActive}
                    className="flex items-center gap-2"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    ARM LIVE
                  </Button>
                  <Button
                    variant={liveStatus?.killSwitchActive ? 'secondary' : 'destructive'}
                    onClick={handleToggleKillSwitch}
                    className="flex items-center gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    {liveStatus?.killSwitchActive ? 'Disable Kill Switch' : 'Activate Kill Switch'}
                  </Button>
                </div>
                {!activeBot?.api_key_id && (
                  <div className="text-xs text-muted-foreground">
                    Configure a Kraken API key to enable live controls.
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Bot Stats
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Trades</span>
                    <span className="font-medium">{activeBot.total_trades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Win Rate</span>
                    <span className="font-medium text-success">
                      {activeBot.total_trades > 0 
                        ? ((activeBot.winning_trades / activeBot.total_trades) * 100).toFixed(1) 
                        : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total P&L</span>
                    <span className={`font-medium ${activeBot.total_pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                      ${activeBot.total_pnl.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Capital</span>
                    <span className="font-medium">${activeBot.current_capital.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Open Positions</span>
                    <span className="font-medium">{positions.length}</span>
                  </div>
                </div>
              </div>

              {/* Health indicator */}
              {health && (
                <div className="text-xs text-muted-foreground">
                  Health: {health.is_healthy ? '✓ Healthy' : '⚠ Issues detected'}
                  {health.last_heartbeat_age_seconds !== null && (
                    <span className="ml-2">
                      Last heartbeat: {Math.round(health.last_heartbeat_age_seconds)}s ago
                    </span>
                  )}
                </div>
              )}
            </>
          )}

          {bots.length === 0 && !isCreating && (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground mb-4">No bots configured</p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Bot
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trading Strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Strategy Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeBot ? (
            <>
              <div className="space-y-2">
                <Label>Trading Strategy</Label>
                <Select 
                  value={activeBot.strategy_id}
                  onValueChange={(value) => updateBot(activeBot.id, { strategy_id: value })}
                  disabled={activeBot.status === 'running'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trend_following">Trend Following</SelectItem>
                    <SelectItem value="mean_reversion">Mean Reversion</SelectItem>
                    <SelectItem value="breakout">Breakout Strategy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Trading Pair</Label>
                <Select 
                  value={activeBot.symbol}
                  onValueChange={(value) => updateBot(activeBot.id, { symbol: value })}
                  disabled={activeBot.status === 'running'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BTC/USD">BTC/USD</SelectItem>
                    <SelectItem value="ETH/USD">ETH/USD</SelectItem>
                    <SelectItem value="XRP/USD">XRP/USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Position Size: {positionSize}%</Label>
                <Slider 
                  value={[positionSize]} 
                  onValueChange={(v) => setPositionSize(v[0])}
                  max={25} 
                  min={1} 
                  step={1} 
                />
                <p className="text-xs text-muted-foreground">
                  Percentage of capital per trade
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label>Mode</Label>
                <Badge variant={activeBot.mode === 'live' ? 'destructive' : 'secondary'}>
                  {activeBot.mode === 'live' ? 'LIVE' : 'Paper'}
                </Badge>
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleUpdateRiskSettings}
                disabled={activeBot.status === 'running'}
              >
                <Settings className="h-4 w-4 mr-2" />
                Save Strategy Settings
              </Button>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Select or create a bot to configure strategy
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Risk Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeBot ? (
            <>
              <div className="space-y-2">
                <Label>Stop Loss: {stopLoss}%</Label>
                <Slider 
                  value={[stopLoss]} 
                  onValueChange={(v) => setStopLoss(v[0])}
                  max={10} 
                  min={0.5} 
                  step={0.5} 
                />
              </div>

              <div className="space-y-2">
                <Label>Take Profit: {takeProfit}%</Label>
                <Slider 
                  value={[takeProfit]} 
                  onValueChange={(v) => setTakeProfit(v[0])}
                  max={20} 
                  min={1} 
                  step={0.5} 
                />
              </div>

              <div className="space-y-2">
                <Label>Max Daily Loss</Label>
                <Input 
                  type="number"
                  value={maxDailyLoss} 
                  onChange={(e) => setMaxDailyLoss(Number(e.target.value))}
                  disabled={activeBot.status === 'running'}
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Emergency Controls</span>
                </div>
                
                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={handleKillBot}
                  disabled={botStatus === 'stopped'}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Kill Switch
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full text-destructive border-destructive/50"
                  onClick={handleDeleteBot}
                  disabled={botStatus === 'running'}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Bot
                </Button>
              </div>

              <Separator />

              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleUpdateRiskSettings}
                disabled={activeBot.status === 'running'}
              >
                <Settings className="h-4 w-4 mr-2" />
                Save Risk Settings
              </Button>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Select or create a bot to configure risk
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
