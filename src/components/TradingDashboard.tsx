import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Activity, 
  Bot, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Settings,
  Play,
  Pause,
  BarChart3,
  AlertTriangle,
  Minimize2
} from 'lucide-react';
import { CriticalPanel } from './trading/CriticalPanel';
import { CompactExecutionPanel } from './trading/CompactExecutionPanel';
import { CollapsibleRiskPanel } from './trading/CollapsibleRiskPanel';
import { CompactStrategyPanel } from './trading/CompactStrategyPanel';
import { PortfolioOverview } from './trading/PortfolioOverview';
import { MarketData } from './trading/MarketData';
import { BotControls } from './trading/BotControls';
import { TradingChart } from './trading/TradingChart';
import { StrategyEngine } from './trading/StrategyEngine';
import { RiskEngine } from './trading/RiskEngine';
import { ExecutionRouter } from './trading/ExecutionRouter';
import { ApiKeyManager } from './trading/ApiKeyManager';

export const TradingDashboard = () => {
  const [botStatus, setBotStatus] = useState<'running' | 'paused' | 'stopped'>('stopped');
  const [minimalMode, setMinimalMode] = useState(false);

  const portfolioData = {
    totalValue: 125840.32,
    pnl: 2340.45,
    pnlPercentage: 1.89,
    totalPnlPercentage: 8.7,
    availableBalance: 45230.10,
    positions: [
      { symbol: 'BTC/USD', size: 0.5, value: 32150.25, pnl: 1250.30, pnlPercentage: 4.05 },
      { symbol: 'ETH/USD', size: 2.1, value: 5243.50, pnl: -156.20, pnlPercentage: -2.89 },
      { symbol: 'XRP/USD', size: 1000, value: 620.00, pnl: 45.80, pnlPercentage: 7.98 }
    ]
  };

  const executionMetrics = {
    fillRate: 98.2,
    slippage: 0.08,
    latency: 11,
    ordersToday: 279
  };

  const riskMetrics = {
    var: 2.1,
    maxDrawdown: 12.5,
    correlationRisk: 72,
    positionSize: 75000,
    positionLimit: 100000,
    dailyLoss: -1200,
    dailyLossLimit: 5000
  };

  const strategies = [
    {
      id: 'trend-001',
      name: 'Momentum Alpha',
      type: 'trend' as const,
      status: 'active' as const,
      allocation: 35,
      sharpe: 1.85,
      drawdown: 8.5,
      pnl: 12500,
      pnlPercentage: 4.2
    },
    {
      id: 'breakout-002', 
      name: 'Volatility Breakout',
      type: 'breakout' as const,
      status: 'active' as const,
      allocation: 25,
      sharpe: 1.62,
      drawdown: 12.1,
      pnl: -1200,
      pnlPercentage: -1.8
    },
    {
      id: 'mean-003',
      name: 'Mean Reversion Pro', 
      type: 'mean-revert' as const,
      status: 'paused' as const,
      allocation: 20,
      sharpe: 1.23,
      drawdown: 15.3,
      pnl: 2300,
      pnlPercentage: 2.1
    }
  ];

  const handleKillSwitch = () => {
    setBotStatus('stopped');
    // Additional kill switch logic would go here
    console.log('EMERGENCY STOP - All positions closing');
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Sentinel AI Trader</h1>
          <p className="text-muted-foreground">Kraken Exchange Integration</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Minimize2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Minimal Mode</span>
            <Switch checked={minimalMode} onCheckedChange={setMinimalMode} />
          </div>
          
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Critical Panel - Always Visible */}
      <CriticalPanel
        portfolioPnl={portfolioData.pnl}
        portfolioPnlPercentage={portfolioData.pnlPercentage}
        totalPnlPercentage={portfolioData.totalPnlPercentage}
        currentDrawdown={5.2}
        riskScore="warning"
        botStatus={botStatus}
        onBotStatusChange={setBotStatus}
        onKillSwitch={handleKillSwitch}
      />

      {/* Expandable Panels - Hidden in Minimal Mode */}
      {!minimalMode && (
        <div className="space-y-4">
          <CompactExecutionPanel metrics={executionMetrics} />
          <CollapsibleRiskPanel metrics={riskMetrics} />
          <CompactStrategyPanel strategies={strategies} />
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="execution">Execution</TabsTrigger>
          <TabsTrigger value="risk">Risk Engine</TabsTrigger>
          <TabsTrigger value="market">Market Data</TabsTrigger>
          <TabsTrigger value="bot">Bot Controls</TabsTrigger>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <PortfolioOverview data={portfolioData} />
            <TradingChart />
          </div>
        </TabsContent>

        <TabsContent value="strategies" className="space-y-4">
          <StrategyEngine />
        </TabsContent>

        <TabsContent value="execution" className="space-y-4">
          <ExecutionRouter />
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <RiskEngine />
        </TabsContent>

        <TabsContent value="market" className="space-y-4">
          <MarketData />
        </TabsContent>

        <TabsContent value="bot" className="space-y-4">
          <BotControls botStatus={botStatus} onStatusChange={setBotStatus} />
        </TabsContent>

        <TabsContent value="keys" className="space-y-4">
          <ApiKeyManager />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Advanced analytics and performance metrics coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
};