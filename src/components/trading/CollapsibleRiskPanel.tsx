import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Shield, TrendingDown, GitBranch, Target } from 'lucide-react';

interface RiskMetrics {
  var: number;
  maxDrawdown: number;
  correlationRisk: number;
  positionSize: number;
  positionLimit: number;
  dailyLoss: number;
  dailyLossLimit: number;
}

interface CollapsibleRiskPanelProps {
  metrics: RiskMetrics;
}

export const CollapsibleRiskPanel = ({ metrics }: CollapsibleRiskPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const getRiskZone = (value: number, thresholds: { safe: number; warning: number }) => {
    if (value <= thresholds.safe) return { zone: '🟢 Safe Zone', color: 'text-success' };
    if (value <= thresholds.warning) return { zone: '🟡 Warning Zone', color: 'text-warning' };
    return { zone: '🔴 Danger Zone', color: 'text-destructive' };
  };

  const positionUtilization = (metrics.positionSize / metrics.positionLimit) * 100;
  const lossUtilization = (Math.abs(metrics.dailyLoss) / metrics.dailyLossLimit) * 100;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Risk Monitoring
              </CardTitle>
              <Button variant="ghost" size="sm">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Risk Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">VaR (95%)</span>
                </div>
                <div className="text-2xl font-bold">{metrics.var}%</div>
                <div className={getRiskZone(metrics.var, { safe: 2, warning: 5 }).color}>
                  {getRiskZone(metrics.var, { safe: 2, warning: 5 }).zone}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Max Drawdown</span>
                </div>
                <div className="text-2xl font-bold">{metrics.maxDrawdown}%</div>
                <div className={getRiskZone(metrics.maxDrawdown, { safe: 10, warning: 20 }).color}>
                  {getRiskZone(metrics.maxDrawdown, { safe: 10, warning: 20 }).zone}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Correlation Risk</span>
                </div>
                <div className="text-2xl font-bold">{metrics.correlationRisk}%</div>
                <div className={getRiskZone(metrics.correlationRisk, { safe: 60, warning: 80 }).color}>
                  {getRiskZone(metrics.correlationRisk, { safe: 60, warning: 80 }).zone}
                </div>
              </div>
            </div>

            {/* Position and Loss Limits */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Position Size vs Limit</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ${metrics.positionSize.toLocaleString()} / ${metrics.positionLimit.toLocaleString()}
                  </span>
                </div>
                <Progress 
                  value={positionUtilization} 
                  className="h-2"
                />
                <div className="text-xs text-muted-foreground">
                  {positionUtilization.toFixed(1)}% utilization
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Daily Loss Limit</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ${Math.abs(metrics.dailyLoss).toLocaleString()} / ${metrics.dailyLossLimit.toLocaleString()}
                  </span>
                </div>
                <Progress 
                  value={lossUtilization} 
                  className="h-2"
                />
                <div className="text-xs text-muted-foreground">
                  {lossUtilization.toFixed(1)}% of daily limit used
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};