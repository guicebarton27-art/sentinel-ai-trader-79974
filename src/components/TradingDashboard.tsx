import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertTriangle
} from 'lucide-react';
import { PortfolioOverview } from './trading/PortfolioOverview';
import { MarketData } from './trading/MarketData';
import { BotControls } from './trading/BotControls';
import { TradingChart } from './trading/TradingChart';
import { StrategyEngine } from './trading/StrategyEngine';
import { RiskEngine } from './trading/RiskEngine';
import { ExecutionRouter } from './trading/ExecutionRouter';

export const TradingDashboard = () => {
  const [botStatus, setBotStatus] = useState<'running' | 'paused' | 'stopped'>('stopped');

  const portfolioData = {
    totalValue: 125840.32,
    pnl: 2340.45,
    pnlPercentage: 1.89,
    availableBalance: 45230.10,
    positions: [
      { symbol: 'BTC/USD', size: 0.5, value: 32150.25, pnl: 1250.30, pnlPercentage: 4.05 },
      { symbol: 'ETH/USD', size: 2.1, value: 5243.50, pnl: -156.20, pnlPercentage: -2.89 },
      { symbol: 'XRP/USD', size: 1000, value: 620.00, pnl: 45.80, pnlPercentage: 7.98 }
    ]
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
          <Badge 
            variant={botStatus === 'running' ? 'default' : botStatus === 'paused' ? 'secondary' : 'outline'}
            className="flex items-center gap-1"
          >
            <Bot className="h-3 w-3" />
            Bot {botStatus === 'running' ? 'Active' : botStatus === 'paused' ? 'Paused' : 'Inactive'}
          </Badge>
          
          <Button
            variant={botStatus === 'running' ? 'destructive' : 'default'}
            size="sm"
            onClick={() => setBotStatus(botStatus === 'running' ? 'stopped' : 'running')}
            className="flex items-center gap-2"
          >
            {botStatus === 'running' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {botStatus === 'running' ? 'Stop Bot' : 'Start Bot'}
          </Button>
          
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${portfolioData.totalValue.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-success" />
              +2.3% from last week
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily P&L</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${portfolioData.pnl > 0 ? 'text-success' : 'text-destructive'}`}>
              {portfolioData.pnl > 0 ? '+' : ''}${portfolioData.pnl.toLocaleString()}
            </div>
            <div className={`flex items-center text-xs ${portfolioData.pnl > 0 ? 'text-success' : 'text-destructive'}`}>
              {portfolioData.pnl > 0 ? 
                <TrendingUp className="h-3 w-3 mr-1" /> : 
                <TrendingDown className="h-3 w-3 mr-1" />
              }
              {portfolioData.pnl > 0 ? '+' : ''}{portfolioData.pnlPercentage}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portfolioData.positions.length}</div>
            <p className="text-xs text-muted-foreground">
              Across crypto pairs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Level</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">Medium</div>
            <p className="text-xs text-muted-foreground">
              Within target range
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="execution">Execution</TabsTrigger>
          <TabsTrigger value="risk">Risk Engine</TabsTrigger>
          <TabsTrigger value="market">Market Data</TabsTrigger>
          <TabsTrigger value="bot">Bot Controls</TabsTrigger>
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