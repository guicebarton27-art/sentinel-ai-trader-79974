import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Play, 
  Pause, 
  Settings, 
  Activity, 
  TrendingUp, 
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  RefreshCw,
  DollarSign
} from "lucide-react";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { useArbitrageAutomation } from "@/hooks/useArbitrageAutomation";

const EXCHANGES = [
  { id: 'kraken', name: 'Kraken', color: 'text-accent' },
  { id: 'binance', name: 'Binance', color: 'text-warning' },
  { id: 'coinbase', name: 'Coinbase', color: 'text-primary' },
  { id: 'bybit', name: 'Bybit', color: 'text-chart-4' },
  { id: 'okx', name: 'OKX', color: 'text-success' },
];

const SYMBOLS = ['BTC/USD', 'ETH/USD', 'XRP/USD', 'SOL/USD'];

export const ArbitrageAutomationPanel = () => {
  const [showSettings, setShowSettings] = useState(false);
  const {
    config,
    updateConfig,
    resetConfig,
    stats,
    executionLog,
    toggleAutomation,
  } = useArbitrageAutomation();

  const winRate = stats.totalExecutions > 0 
    ? (stats.successfulExecutions / stats.totalExecutions * 100).toFixed(1)
    : '0.0';

  return (
    <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-primary/20 shadow-performance">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Auto-Execution Engine
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={stats.isRunning 
                ? "border-success/30 text-success animate-pulse" 
                : "border-muted-foreground/30 text-muted-foreground"
              }
            >
              {stats.isRunning ? 'ACTIVE' : 'STOPPED'}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className="h-8 w-8"
            >
              <Settings className={`h-4 w-4 ${showSettings ? 'text-primary' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Controls */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border/50">
          <div className="flex items-center gap-4">
            <Button
              onClick={toggleAutomation}
              variant={stats.isRunning ? "destructive" : "default"}
              size="lg"
              className="gap-2"
            >
              {stats.isRunning ? (
                <>
                  <Pause className="h-5 w-5" />
                  Stop Engine
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  Start Engine
                </>
              )}
            </Button>
            
            {stats.isRunning && (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Scanning every {config.scanIntervalSeconds}s
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-success">
                ${stats.totalProfit.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">Total Profit</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {stats.totalExecutions}
              </div>
              <div className="text-xs text-muted-foreground">Executions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {winRate}%
              </div>
              <div className="text-xs text-muted-foreground">Success Rate</div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-sm text-muted-foreground">Successful</span>
            </div>
            <div className="text-lg font-bold text-success">{stats.successfulExecutions}</div>
          </div>
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-muted-foreground">Failed</span>
            </div>
            <div className="text-lg font-bold text-destructive">{stats.failedExecutions}</div>
          </div>
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-warning" />
              <span className="text-sm text-muted-foreground">Hedges</span>
            </div>
            <div className="text-lg font-bold text-warning">{stats.hedgesCreated}</div>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Active</span>
            </div>
            <div className="text-lg font-bold text-primary">{stats.currentExecutions}</div>
          </div>
        </div>

        {/* Settings Panel */}
        <Collapsible open={showSettings} onOpenChange={setShowSettings}>
          <CollapsibleContent className="space-y-4 pt-4">
            <Separator />
            
            {/* Profit Thresholds */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-400" />
                Profit Thresholds
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Min Profit (USD)</Label>
                  <Input
                    type="number"
                    value={config.minProfitThreshold}
                    onChange={(e) => updateConfig({ minProfitThreshold: parseFloat(e.target.value) || 0 })}
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum profit to trigger execution
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Min Spread (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.minProfitPercentage}
                    onChange={(e) => updateConfig({ minProfitPercentage: parseFloat(e.target.value) || 0 })}
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum spread after fees
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Max Position Size: ${config.maxPositionSize.toLocaleString()}</Label>
                <Slider
                  value={[config.maxPositionSize]}
                  onValueChange={([value]) => updateConfig({ maxPositionSize: value })}
                  min={1000}
                  max={100000}
                  step={1000}
                  className="py-2"
                />
              </div>
            </div>

            <Separator />

            {/* Hedging Settings */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-yellow-400" />
                Auto-Hedging
              </h4>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Enable Auto-Hedging</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically create delta-neutral positions
                  </p>
                </div>
                <Switch
                  checked={config.autoHedge}
                  onCheckedChange={(checked) => updateConfig({ autoHedge: checked })}
                />
              </div>

              {config.autoHedge && (
                <div className="space-y-2">
                  <Label className="text-sm">Min Daily Funding Capture: ${config.hedgeMinFundingCapture}</Label>
                  <Slider
                    value={[config.hedgeMinFundingCapture]}
                    onValueChange={([value]) => updateConfig({ hedgeMinFundingCapture: value })}
                    min={1}
                    max={50}
                    step={1}
                    className="py-2"
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Execution Settings */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Execution Settings
              </h4>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Scan Interval (s)</Label>
                  <Input
                    type="number"
                    value={config.scanIntervalSeconds}
                    onChange={(e) => updateConfig({ scanIntervalSeconds: parseInt(e.target.value) || 30 })}
                    className="bg-secondary/50"
                    min={10}
                    max={300}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Max Concurrent</Label>
                  <Input
                    type="number"
                    value={config.maxConcurrentExecutions}
                    onChange={(e) => updateConfig({ maxConcurrentExecutions: parseInt(e.target.value) || 3 })}
                    className="bg-secondary/50"
                    min={1}
                    max={10}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Cooldown (s)</Label>
                  <Input
                    type="number"
                    value={config.cooldownSeconds}
                    onChange={(e) => updateConfig({ cooldownSeconds: parseInt(e.target.value) || 10 })}
                    className="bg-secondary/50"
                    min={5}
                    max={60}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Opportunity Types */}
            <div className="space-y-4">
              <h4 className="font-medium">Opportunity Types</h4>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="crossExchange"
                    checked={config.enabledTypes.crossExchange}
                    onCheckedChange={(checked) => 
                      updateConfig({ 
                        enabledTypes: { ...config.enabledTypes, crossExchange: checked as boolean }
                      })
                    }
                  />
                  <Label htmlFor="crossExchange" className="text-sm">Cross-Exchange</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fundingRate"
                    checked={config.enabledTypes.fundingRate}
                    onCheckedChange={(checked) => 
                      updateConfig({ 
                        enabledTypes: { ...config.enabledTypes, fundingRate: checked as boolean }
                      })
                    }
                  />
                  <Label htmlFor="fundingRate" className="text-sm">Funding Rate</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Exchanges */}
            <div className="space-y-4">
              <h4 className="font-medium">Enabled Exchanges</h4>
              <div className="flex flex-wrap gap-2">
                {EXCHANGES.map(exchange => (
                  <Button
                    key={exchange.id}
                    variant={config.enabledExchanges.includes(exchange.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const newExchanges = config.enabledExchanges.includes(exchange.id)
                        ? config.enabledExchanges.filter(e => e !== exchange.id)
                        : [...config.enabledExchanges, exchange.id];
                      updateConfig({ enabledExchanges: newExchanges });
                    }}
                    className={config.enabledExchanges.includes(exchange.id) ? '' : 'opacity-50'}
                  >
                    <span className={exchange.color}>{exchange.name}</span>
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Symbols */}
            <div className="space-y-4">
              <h4 className="font-medium">Enabled Symbols</h4>
              <div className="flex flex-wrap gap-2">
                {SYMBOLS.map(symbol => (
                  <Button
                    key={symbol}
                    variant={config.enabledSymbols.includes(symbol) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const newSymbols = config.enabledSymbols.includes(symbol)
                        ? config.enabledSymbols.filter(s => s !== symbol)
                        : [...config.enabledSymbols, symbol];
                      updateConfig({ enabledSymbols: newSymbols });
                    }}
                    className={config.enabledSymbols.includes(symbol) ? '' : 'opacity-50'}
                  >
                    {symbol}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button variant="outline" size="sm" onClick={resetConfig}>
                Reset to Defaults
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Execution Log */}
        {executionLog.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Executions
            </h4>
            <ScrollArea className="h-[150px] rounded-lg border border-border/50 bg-secondary/30">
              <div className="p-2 space-y-1">
                {executionLog.slice(0, 10).map(log => (
                  <div 
                    key={log.id}
                    className="flex items-center justify-between p-2 rounded bg-secondary/50 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {log.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      ) : log.status === 'failed' ? (
                        <XCircle className="h-4 w-4 text-red-400" />
                      ) : (
                        <RefreshCw className="h-4 w-4 text-yellow-400 animate-spin" />
                      )}
                      <span className="font-mono">{log.symbol}</span>
                      <Badge variant="outline" className="text-xs">
                        {log.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={log.profit > 0 ? 'text-green-400' : 'text-red-400'}>
                        {log.profit > 0 ? '+' : ''}${log.profit.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Warning */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="text-yellow-400/80">
            <strong>Paper Trading Mode:</strong> All executions are simulated. Connect real exchange APIs for live trading.
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
