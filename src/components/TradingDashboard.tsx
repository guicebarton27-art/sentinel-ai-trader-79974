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
      />

      {/* Expandable Panels - Hidden in Minimal Mode */}
      {!minimalMode && (
        <div className="space-y-4">
          <CompactExecutionPanel metrics={executionMetrics} />
          <CollapsibleRiskPanel metrics={riskMetrics} />
          <CompactStrategyPanel strategies={strategies} />
        </div>
      )}

      {/* Main Content Tabs - Streamlined Layout */}
      <div className="pb-20"> {/* Add padding bottom for sticky footer */}
        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="strategies">Strategies</TabsTrigger>
            <TabsTrigger value="risk">Risk</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="execution">Execution</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <PortfolioOverview data={portfolioData} />
          </TabsContent>

          <TabsContent value="strategies" className="space-y-4">
            <StrategyEngine />
          </TabsContent>

          <TabsContent value="risk" className="space-y-4">
            <div className="space-y-4">
              <RiskEngine />
              <CollapsibleRiskPanel metrics={riskMetrics} />
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="space-y-4">
              <TradingChart />
              <MarketData />
            </div>
          </TabsContent>

          <TabsContent value="execution" className="space-y-4">
            <div className="space-y-4">
              <ExecutionRouter />
              <CompactExecutionPanel metrics={executionMetrics} />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="space-y-4">
              <ApiKeyManager />
              <BotControls botStatus={botStatus} onStatusChange={setBotStatus} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Sticky Bot Controls Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-4 flex justify-center gap-4 z-50">
        <Button 
          onClick={() => setBotStatus('running')} 
          disabled={botStatus === 'running'}
          className="bg-green-600 hover:bg-green-700"
        >
          <Play className="h-4 w-4 mr-2" />
          Start Bot
        </Button>
        <Button 
          onClick={() => setBotStatus('paused')} 
          disabled={botStatus === 'paused'}
          variant="outline"
        >
          <Pause className="h-4 w-4 mr-2" />
          Pause Bot
        </Button>
        <Button 
          onClick={() => setBotStatus('stopped')} 
          disabled={botStatus === 'stopped'}
          variant="outline"
        >
          Stop Bot
        </Button>
        <Button 
          onClick={handleKillSwitch}
          variant="destructive"
          className="ml-4"
        >
          🛑 Kill Switch
        </Button>
      </div>
    </div>
  );
};