import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  AlertTriangle, 
  Zap, 
  Activity,
  TrendingDown,
  DollarSign,
  Gauge,
  Target,
  StopCircle
} from 'lucide-react';

interface RiskMetrics {
  portfolioVaR: number;
  maxDrawdown: number;
  currentDrawdown: number;
  riskScore: number;
  correlationRisk: number;
  leverageRatio: number;
  sharpeRatio: number;
  volatility: number;
}

const riskMetrics: RiskMetrics = {
  portfolioVaR: -2.45,
  maxDrawdown: -15.2,
  currentDrawdown: -3.8,
  riskScore: 6.2,
  correlationRisk: 0.72,
  leverageRatio: 1.8,
  sharpeRatio: 1.68,
  volatility: 18.5
};

interface RiskLimit {
  name: string;
  current: number;
  limit: number;
  status: 'safe' | 'warning' | 'critical';
  enabled: boolean;
}

const riskLimits: RiskLimit[] = [
  { name: 'Daily VaR', current: 2.1, limit: 3.0, status: 'safe', enabled: true },
  { name: 'Max Drawdown', current: 3.8, limit: 15.0, status: 'safe', enabled: true },
  { name: 'Position Size', current: 8.5, limit: 10.0, status: 'warning', enabled: true },
  { name: 'Correlation', current: 72, limit: 80, status: 'warning', enabled: true },
  { name: 'Leverage', current: 1.8, limit: 2.5, status: 'safe', enabled: true },
  { name: 'Volatility', current: 18.5, limit: 25.0, status: 'safe', enabled: true }
];

const getRiskColor = (status: RiskLimit['status']) => {
  switch (status) {
    case 'safe': return 'text-success';
    case 'warning': return 'text-warning';
    case 'critical': return 'text-error';
  }
};

const getRiskBadgeColor = (status: RiskLimit['status']) => {
  switch (status) {
    case 'safe': return 'bg-success text-success-foreground';
    case 'warning': return 'bg-warning text-warning-foreground';
    case 'critical': return 'bg-error text-error-foreground';
  }
};

export const RiskEngine = () => {
  const criticalAlerts = riskLimits.filter(limit => limit.status === 'critical').length;
  const warningAlerts = riskLimits.filter(limit => limit.status === 'warning').length;

  return (
    <div className="space-y-6">
      {/* Risk Overview */}
      <Card className="shadow-risk">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-risk" />
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
              <p className="text-2xl font-bold text-risk">{riskMetrics.riskScore}</p>
              <p className="text-sm text-muted-foreground">Risk Score</p>
              <Progress value={(riskMetrics.riskScore / 10) * 100} className="h-2" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold">{riskMetrics.portfolioVaR}%</p>
              <p className="text-sm text-muted-foreground">Daily VaR</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold text-error">{riskMetrics.currentDrawdown}%</p>
              <p className="text-sm text-muted-foreground">Current DD</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold">{riskMetrics.sharpeRatio}</p>
              <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
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
                    <Switch checked={limit.enabled} />
                  </div>
                  <Badge className={getRiskBadgeColor(limit.status)}>
                    {limit.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Current: <span className={getRiskColor(limit.status)}>{limit.current}%</span></span>
                  <span>Limit: {limit.limit}%</span>
                </div>
                <Progress 
                  value={(limit.current / limit.limit) * 100} 
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
              <StopCircle className="h-5 w-5 text-error" />
              Emergency Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Kill Switch */}
            <div className="p-4 border border-error/20 rounded-lg bg-error/5">
              <div className="flex items-center justify-between mb-3">
                <div className="space-y-1">
                  <h4 className="font-medium text-error">Kill Switch</h4>
                  <p className="text-xs text-muted-foreground">Emergency stop all trading</p>
                </div>
                <Button variant="destructive" size="lg">
                  <StopCircle className="h-4 w-4 mr-2" />
                  KILL
                </Button>
              </div>
            </div>

            {/* Position Limits */}
            <div className="space-y-4">
              <h4 className="font-medium">Position Limits</h4>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">Max Position Size: 10%</Label>
                  <Slider defaultValue={[10]} max={25} min={1} step={1} />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Max Portfolio DD: 15%</Label>
                  <Slider defaultValue={[15]} max={30} min={5} step={1} />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Daily Loss Limit</Label>
                  <Input placeholder="$5,000" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Risk Alerts */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Risk Alerts
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">High correlation alert</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Volatility spike alert</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Drawdown warning</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Liquidity alert</Label>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Metrics Detail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Risk Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-error" />
                <span className="text-sm font-medium">Value at Risk (95%)</span>
              </div>
              <p className="text-2xl font-bold">{riskMetrics.portfolioVaR}%</p>
              <p className="text-xs text-muted-foreground">1-day horizon</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium">Max Drawdown</span>
              </div>
              <p className="text-2xl font-bold text-error">{riskMetrics.maxDrawdown}%</p>
              <p className="text-xs text-muted-foreground">Historical maximum</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-algo-primary" />
                <span className="text-sm font-medium">Correlation Risk</span>
              </div>
              <p className="text-2xl font-bold">{(riskMetrics.correlationRisk * 100).toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Avg position correlation</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-neutral" />
                <span className="text-sm font-medium">Leverage Ratio</span>
              </div>
              <p className="text-2xl font-bold">{riskMetrics.leverageRatio}x</p>
              <p className="text-xs text-muted-foreground">Current exposure</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};