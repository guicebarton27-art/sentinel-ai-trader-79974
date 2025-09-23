import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Pause, 
  Square, 
  Settings, 
  Shield, 
  TrendingUp, 
  AlertTriangle,
  Bot,
  Zap
} from 'lucide-react';

interface BotControlsProps {
  botStatus: 'running' | 'paused' | 'stopped';
  onStatusChange: (status: 'running' | 'paused' | 'stopped') => void;
}

export const BotControls = ({ botStatus, onStatusChange }: BotControlsProps) => {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Bot Status & Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Bot Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <Badge 
              variant={botStatus === 'running' ? 'default' : botStatus === 'paused' ? 'secondary' : 'outline'}
              className="text-lg px-4 py-2"
            >
              {botStatus === 'running' ? 'Active Trading' : botStatus === 'paused' ? 'Paused' : 'Inactive'}
            </Badge>
            
            <div className="grid gap-2">
              <Button 
                onClick={() => onStatusChange('running')} 
                disabled={botStatus === 'running'}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Start Bot
              </Button>
              <Button 
                variant="secondary"
                onClick={() => onStatusChange('paused')} 
                disabled={botStatus !== 'running'}
                className="flex items-center gap-2"
              >
                <Pause className="h-4 w-4" />
                Pause Bot
              </Button>
              <Button 
                variant="destructive"
                onClick={() => onStatusChange('stopped')} 
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
              <Zap className="h-4 w-4" />
              Quick Stats
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Trades Today</span>
                <span className="font-medium">23</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Success Rate</span>
                <span className="font-medium text-success">68%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Uptime</span>
                <span className="font-medium">6h 42m</span>
              </div>
            </div>
          </div>
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
          <div className="space-y-2">
            <Label>Trading Strategy</Label>
            <Select defaultValue="momentum">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="momentum">Momentum Trading</SelectItem>
                <SelectItem value="mean-reversion">Mean Reversion</SelectItem>
                <SelectItem value="breakout">Breakout Strategy</SelectItem>
                <SelectItem value="arbitrage">Arbitrage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Market Pairs</Label>
            <Select defaultValue="major">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="major">Major Pairs (BTC, ETH)</SelectItem>
                <SelectItem value="altcoins">Top Altcoins</SelectItem>
                <SelectItem value="all">All Available</SelectItem>
                <SelectItem value="custom">Custom Selection</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Position Size: 2.5%</Label>
            <Slider defaultValue={[2.5]} max={10} min={0.5} step={0.5} />
            <p className="text-xs text-muted-foreground">
              Percentage of portfolio per trade
            </p>
          </div>

          <div className="space-y-3">
            <Label>Max Concurrent Trades: 3</Label>
            <Slider defaultValue={[3]} max={10} min={1} step={1} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="auto-compound">Auto-compound profits</Label>
            <Switch id="auto-compound" defaultChecked />
          </div>
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
          <div className="space-y-2">
            <Label>Stop Loss</Label>
            <div className="flex gap-2">
              <Input placeholder="2.5" className="flex-1" />
              <Select defaultValue="percent">
                <SelectTrigger className="w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">%</SelectItem>
                  <SelectItem value="fixed">$</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Take Profit</Label>
            <div className="flex gap-2">
              <Input placeholder="5.0" className="flex-1" />
              <Select defaultValue="percent">
                <SelectTrigger className="w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">%</SelectItem>
                  <SelectItem value="fixed">$</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Max Daily Loss: $500</Label>
            <Slider defaultValue={[500]} max={2000} min={100} step={50} />
          </div>

          <div className="space-y-3">
            <Label>Max Drawdown: 15%</Label>
            <Slider defaultValue={[15]} max={30} min={5} step={1} />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Risk Alerts</span>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="volatility-alert">High volatility pause</Label>
              <Switch id="volatility-alert" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="loss-limit">Daily loss limit</Label>
              <Switch id="loss-limit" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="emergency-stop">Emergency stop</Label>
              <Switch id="emergency-stop" defaultChecked />
            </div>
          </div>

          <Button variant="outline" className="w-full">
            <Settings className="h-4 w-4 mr-2" />
            Advanced Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};