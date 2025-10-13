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
import { SentimentAnalysis } from './trading/SentimentAnalysis';
import { ArbitrageDetector } from './trading/ArbitrageDetector';
import { PricePrediction } from './trading/PricePrediction';
import { StrategyRecommendation } from './trading/StrategyRecommendation';
import { ApiKeyManager } from './trading/ApiKeyManager';
import { BacktestPanel } from './trading/BacktestPanel';
import { BacktestResults } from './trading/BacktestResults';
import { MLSentimentPanel } from './trading/MLSentimentPanel';
import { MLPricePrediction } from './trading/MLPricePrediction';
import { MLRiskEngine } from './trading/MLRiskEngine';
import { PortfolioOptimizer } from './trading/PortfolioOptimizer';
import { useTradingBot } from '@/hooks/useTradingBot';
import { useToast } from '@/hooks/use-toast';

export const TradingDashboard = () => {
  const [minimalMode, setMinimalMode] = useState(false);
  const { telemetry, isConnected, controlBot } = useTradingBot();
  const { toast } = useToast();
  
  const botStatus = telemetry?.status || 'stopped';

  const portfolioData = {
    totalValue: telemetry?.nav || 1000000,
    pnl: telemetry?.pnl || 0,
    pnlPercentage: telemetry?.pnlPercentage || 0,
    totalPnlPercentage: telemetry?.pnlPercentage || 0,
    availableBalance: (telemetry?.nav || 1000000) * 0.35,
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
    ordersToday: telemetry?.ordersToday || 0
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

  const handleBotControl = async (action: 'start' | 'pause' | 'stop' | 'kill', mode?: 'paper' | 'live') => {
    try {
      await controlBot(action, mode ? { mode } : undefined);
      toast({
        title: `Bot ${action}ed`,
        description: action === 'kill' ? 'Emergency stop activated' : `Bot is now ${action === 'start' ? 'running' : action === 'pause' ? 'paused' : 'stopped'}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${action} bot`,
        variant: 'destructive',
      });
    }
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
          <Badge variant={isConnected ? 'default' : 'destructive'} className="gap-1">
            <Activity className="h-3 w-3" />
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          
          <div className="flex items-center gap-2">
            <Minimize2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Minimal Mode</span>
            <Switch checked={minimalMode} onCheckedChange={setMinimalMode} />
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const tabsList = document.querySelector('[value="settings"]');
              if (tabsList instanceof HTMLElement) tabsList.click();
            }}
          >
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <MLPricePrediction symbol="BTC/USD" />
              <MLSentimentPanel />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <MLRiskEngine symbol="BTC/USD" />
              <PortfolioOptimizer />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <StrategyRecommendation />
              <ArbitrageDetector />
            </div>
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
              <BacktestResults />
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
              <BacktestPanel />
              <ApiKeyManager />
              <BotControls 
                botStatus={botStatus} 
                onStatusChange={(status) => {
                  if (status === 'running') handleBotControl('start', 'paper');
                  else if (status === 'paused') handleBotControl('pause');
                  else handleBotControl('stop');
                }} 
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Sticky Bot Controls Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-4 flex justify-center gap-4 z-50">
        <Button 
          onClick={() => handleBotControl('start', 'paper')} 
          disabled={botStatus === 'running' || !isConnected}
          className="bg-green-600 hover:bg-green-700"
        >
          <Play className="h-4 w-4 mr-2" />
          Start Bot
        </Button>
        <Button 
          onClick={() => handleBotControl('pause')} 
          disabled={botStatus === 'paused' || !isConnected}
          variant="outline"
        >
          <Pause className="h-4 w-4 mr-2" />
          Pause Bot
        </Button>
        <Button 
          onClick={() => handleBotControl('stop')} 
          disabled={botStatus === 'stopped' || !isConnected}
          variant="outline"
        >
          Stop Bot
        </Button>
        <Button 
          onClick={() => handleBotControl('kill')}
          disabled={!isConnected}
          variant="destructive"
          className="ml-4"
        >
          🛑 Kill Switch
        </Button>
      </div>
    </div>
  );
};