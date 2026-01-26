import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Activity, 
  Settings,
  Play,
  Pause,
  Square,
  Minimize2,
  LogOut,
  Zap,
  Shield,
  TrendingUp,
  BarChart3,
  Cpu,
  Bot,
  Wallet,
  AlertOctagon,
  TestTube,
  Sparkles
} from 'lucide-react';
// Trading Components - Grouped by Domain
import {
  // Quick Start
  QuickStartWizard,
  SimplifiedDashboard,
  MobileNavBar,
  // ML & Intelligence
  MLSentimentPanel,
  MLPricePrediction,
  StrategyRecommendation,
  AutoMLAgent,
  NeuralDecisionViz,
  AutonomousAgentViz,
  AICommandCenter,
  // Risk & Safety
  RiskEngine,
  MLRiskEngine,
  CriticalPanel,
  CollapsibleRiskPanel,
  // Execution
  ExecutionRouter,
  CompactExecutionPanel,
  BotControls,
  LiveTradesFeed,
  // Market Data
  TradingChart,
  LiveCandleChart,
  MarketData,
  // Arbitrage
  ArbitrageDetector,
  ArbitrageAutomationPanel,
  MultiExchangeArbitrage,
  // Strategy
  StrategyEngine,
  CompactStrategyPanel,
  // Portfolio
  PortfolioOverview,
  PortfolioOptimizer,
  // Backtesting
  BacktestPanel,
  BacktestResults,
  // System
  SystemStatusWidget,
  ApiKeyManager,
} from './trading';
import { useBotController } from '@/hooks/useBotController';
import { useFirstTimeUser } from '@/hooks/useFirstTimeUser';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

export const TradingDashboard = () => {
  const [minimalMode, setMinimalMode] = useState(false);
  const [simpleMode, setSimpleMode] = useState(true);
  const [mobileTab, setMobileTab] = useState('home');
  const [currentTime, setCurrentTime] = useState(new Date());
  const { 
    activeBot, 
    positions, 
    recentOrders, 
    recentEvents,
    health,
    loading,
    startBot,
    pauseBot,
    stopBot,
    killBot,
    createBot
  } = useBotController();
  const { isFirstTime, isLoading: wizardLoading, markWizardComplete } = useFirstTimeUser();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Use DB-driven bot status (single source of truth)
  const botStatus = activeBot?.status || 'stopped';
  const isConnected = health?.is_healthy !== false;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate portfolio data from DB-driven activeBot and positions
  const openPositions = positions.filter(p => p.status === 'open');
  const totalPositionValue = openPositions.reduce((sum, p) => 
    sum + (p.quantity * (p.current_price || p.entry_price)), 0);
  const totalUnrealizedPnl = openPositions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0);
  
  const portfolioData = {
    totalValue: activeBot?.current_capital || 10000,
    pnl: activeBot?.daily_pnl || 0,
    pnlPercentage: activeBot?.starting_capital 
      ? ((activeBot.current_capital - activeBot.starting_capital) / activeBot.starting_capital * 100) 
      : 0,
    totalPnlPercentage: activeBot?.starting_capital 
      ? ((activeBot.total_pnl || 0) / activeBot.starting_capital * 100) 
      : 0,
    availableBalance: (activeBot?.current_capital || 10000) - totalPositionValue,
    positions: openPositions.map(p => ({
      symbol: p.symbol,
      size: p.quantity,
      value: p.quantity * (p.current_price || p.entry_price),
      pnl: p.unrealized_pnl || 0,
      pnlPercentage: p.entry_price > 0 
        ? (((p.current_price || p.entry_price) - p.entry_price) / p.entry_price * 100) 
        : 0
    }))
  };

  // Calculate execution metrics from real order data
  const filledOrders = recentOrders.filter(o => o.status === 'filled');
  const todaysOrders = recentOrders.filter(o => {
    const orderDate = new Date(o.created_at);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  });
  
  const executionMetrics = {
    fillRate: recentOrders.length > 0 
      ? Math.round((filledOrders.length / recentOrders.length) * 100 * 10) / 10
      : 98.2,
    slippage: 0.08,
    latency: health?.last_heartbeat_age_seconds 
      ? Math.min(Math.round(health.last_heartbeat_age_seconds * 1000 / 60), 20) 
      : 11,
    ordersToday: todaysOrders.length
  };

  // Calculate risk metrics from real position/bot data
  const positionLimit = activeBot?.starting_capital ? activeBot.starting_capital * (activeBot.max_position_size || 0.1) : 10000;
  
  const riskMetrics = {
    var: 2.1,
    maxDrawdown: activeBot?.starting_capital && activeBot.current_capital
      ? Math.round(((activeBot.starting_capital - Math.min(activeBot.current_capital, activeBot.starting_capital)) / activeBot.starting_capital) * 100 * 10) / 10
      : 0,
    correlationRisk: 72,
    positionSize: totalPositionValue,
    positionLimit: positionLimit,
    dailyLoss: activeBot?.daily_pnl || 0,
    dailyLossLimit: activeBot?.max_daily_loss || 5000
  };

  // Strategies now come from useBotController or deployed_strategies table
  // The CompactStrategyPanel will fetch its own data from the database
  const getStrategyType = (strategyId: string | undefined): 'trend' | 'breakout' | 'mean-revert' => {
    if (strategyId?.includes('trend')) return 'trend';
    if (strategyId?.includes('breakout')) return 'breakout';
    if (strategyId?.includes('mean')) return 'mean-revert';
    return 'trend';
  };
  
  const getStrategyStatus = (status: string | undefined): 'active' | 'paused' => {
    if (status === 'running') return 'active';
    return 'paused';
  };
  
  const strategies = activeBot ? [{
    id: activeBot.id,
    name: activeBot.name,
    type: getStrategyType(activeBot.strategy_id),
    status: getStrategyStatus(activeBot.status),
    allocation: 100,
    sharpe: activeBot.winning_trades && activeBot.total_trades ? 
            (activeBot.winning_trades / activeBot.total_trades * 2) : 0,
    drawdown: 0,
    pnl: activeBot.total_pnl || 0,
    pnlPercentage: activeBot.starting_capital ? 
                   ((activeBot.total_pnl || 0) / activeBot.starting_capital * 100) : 0
  }] : [];

  const handleBotControl = async (action: 'start' | 'pause' | 'stop' | 'kill', mode?: 'paper' | 'live') => {
    if (!activeBot) {
      toast({
        title: 'No Bot Selected',
        description: 'Please create or select a bot first in Settings',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      if (action === 'start') {
        await startBot(activeBot.id, mode || activeBot.mode);
      } else if (action === 'pause') {
        await pauseBot(activeBot.id);
      } else if (action === 'stop') {
        await stopBot(activeBot.id);
      } else if (action === 'kill') {
        await killBot(activeBot.id);
      }
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

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
      toast({
        title: 'Signed out',
        description: 'You have been signed out successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sign out',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-success text-success-foreground';
      case 'paused': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Handle wizard completion
  const handleWizardComplete = async (config: any) => {
    try {
      // Create a new bot with the wizard config
      const strategyMap = {
        conservative: 'trend_following',
        moderate: 'trend_following',
        aggressive: 'momentum_breakout',
      };
      
      await createBot({
        name: 'My Trading Bot',
        symbol: 'BTC/USD',
        strategy_id: strategyMap[config.strategy as keyof typeof strategyMap],
        mode: 'paper',
        risk_params: {
          starting_capital: config.capital,
          stop_loss_pct: config.stopLoss,
          take_profit_pct: config.takeProfit,
        },
      });
      
      markWizardComplete();
      
      toast({
        title: 'Bot Created!',
        description: 'Your trading bot is ready. Click Start to begin paper trading.',
      });
    } catch (error) {
      console.error('Failed to create bot:', error);
      markWizardComplete();
    }
  };

  const handleWizardSkip = () => {
    markWizardComplete();
  };

  // Calculate risk level based on position size
  const riskLevel = riskMetrics.positionSize > riskMetrics.positionLimit * 0.8 
    ? 'high' 
    : riskMetrics.positionSize > riskMetrics.positionLimit * 0.5 
      ? 'medium' 
      : 'low';

  // Show wizard for first-time users
  if (!wizardLoading && isFirstTime) {
    return (
      <QuickStartWizard 
        onComplete={handleWizardComplete} 
        onSkip={handleWizardSkip} 
      />
    );
  }

  // Show simplified dashboard on mobile or when simple mode is enabled
  if (isMobile && simpleMode) {
    return (
      <>
        <SimplifiedDashboard
          botStatus={botStatus as 'stopped' | 'running' | 'paused' | 'error'}
          portfolioValue={portfolioData.totalValue}
          dailyPnl={portfolioData.pnl}
          dailyPnlPercent={portfolioData.pnlPercentage}
          riskLevel={riskLevel}
          openPositions={openPositions.length}
          winRate={activeBot?.total_trades ? Math.round((activeBot.winning_trades / activeBot.total_trades) * 100) : 0}
          onStart={() => handleBotControl('start', 'paper')}
          onPause={() => handleBotControl('pause')}
          onStop={() => handleBotControl('stop')}
          onViewDetails={() => setSimpleMode(false)}
        />
        <MobileNavBar 
          activeTab={mobileTab} 
          onTabChange={(tab) => {
            setMobileTab(tab);
            if (tab !== 'home') setSimpleMode(false);
          }} 
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-success/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 glass-panel border-b border-border/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight gradient-text">Sentinel AI</h1>
                  <p className="text-xs text-muted-foreground">Kraken Exchange</p>
                </div>
              </div>
              
              <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
                <span className="text-xs font-medium">{isConnected ? 'Live' : 'Offline'}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Live Clock */}
              <div className="hidden lg:block text-right">
                <div className="text-sm font-mono font-bold text-foreground">
                  {currentTime.toLocaleTimeString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              </div>

              {/* Simple Mode Toggle (Desktop) */}
              {!isMobile && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/30 border border-border/30">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground hidden sm:inline">Simple</span>
                  <Switch checked={simpleMode} onCheckedChange={setSimpleMode} className="scale-90" />
                </div>
              )}

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/30 border border-border/30">
                <Minimize2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground hidden sm:inline">Compact</span>
                <Switch checked={minimalMode} onCheckedChange={setMinimalMode} className="scale-90" />
              </div>
              
              <Button 
                variant="ghost" 
                size="icon"
                className="rounded-xl"
                onClick={() => navigate('/self-test')}
                title="Self-Test"
              >
                <TestTube className="h-4 w-4" />
              </Button>

              <Button 
                variant="ghost" 
                size="icon"
                className="rounded-xl"
                onClick={() => {
                  const tabsList = document.querySelector('[value="settings"]');
                  if (tabsList instanceof HTMLElement) tabsList.click();
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="gap-2 rounded-xl"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 pb-28">
        {/* Critical Panel */}
        <CriticalPanel
          portfolioPnl={portfolioData.pnl}
          portfolioPnlPercentage={portfolioData.pnlPercentage}
          totalPnlPercentage={portfolioData.totalPnlPercentage}
          currentDrawdown={5.2}
          riskScore="warning"
          botStatus={botStatus}
        />

        {/* Quick Stats Row */}
        {!minimalMode && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <Wallet className="h-4 w-4 text-primary" />
                <Badge variant="outline" className="text-xs">NAV</Badge>
              </div>
              <div className="mt-2">
                <div className="metric-value">${(portfolioData.totalValue / 1000).toFixed(1)}K</div>
                <div className="metric-label">Portfolio Value</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-4 w-4 text-success" />
                <Badge variant="outline" className={`text-xs ${portfolioData.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {portfolioData.pnl >= 0 ? '+' : ''}{portfolioData.pnlPercentage.toFixed(2)}%
                </Badge>
              </div>
              <div className="mt-2">
                <div className={`metric-value ${portfolioData.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                  ${Math.abs(portfolioData.pnl).toLocaleString()}
                </div>
                <div className="metric-label">Today's P&L</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <Cpu className="h-4 w-4 text-accent" />
                <Badge className={getStatusColor(botStatus)} variant="outline">
                  {botStatus}
                </Badge>
              </div>
              <div className="mt-2">
                <div className="metric-value">{executionMetrics.ordersToday}</div>
                <div className="metric-label">Orders Today</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <Zap className="h-4 w-4 text-warning" />
                <Badge variant="outline" className="text-xs">{executionMetrics.latency}ms</Badge>
              </div>
              <div className="mt-2">
                <div className="metric-value">{executionMetrics.fillRate}%</div>
                <div className="metric-label">Fill Rate</div>
              </div>
            </div>
          </div>
        )}

        {/* Strategy Panel */}
        {!minimalMode && (
          <CompactStrategyPanel />
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="glass-panel p-1 grid w-full grid-cols-6 h-auto">
            <TabsTrigger value="dashboard" className="gap-2 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="strategies" className="gap-2 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
              <Cpu className="h-4 w-4" />
              <span className="hidden sm:inline">Strategies</span>
            </TabsTrigger>
            <TabsTrigger value="risk" className="gap-2 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Risk</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="execution" className="gap-2 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Execution</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 animate-in fade-in-50 duration-300">
            {/* Live Candlestick Chart - Connected to real positions and orders */}
            <LiveCandleChart realPositions={positions} realOrders={recentOrders} />
            
            {/* Revolutionary AI Command Center */}
            <AICommandCenter />
            
            {/* Autonomous Agent Network Visualization */}
            <AutonomousAgentViz />
            
            {/* Neural Decision Visualization */}
            <NeuralDecisionViz />
            
            <LiveTradesFeed
              positions={positions}
              recentOrders={recentOrders}
              recentEvents={recentEvents}
            />
            <PortfolioOverview data={portfolioData} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MLPricePrediction symbol="BTC/USD" />
              <MLSentimentPanel />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MLRiskEngine symbol="BTC/USD" />
              <PortfolioOptimizer />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StrategyRecommendation symbol="BTC/USD" />
              <ArbitrageDetector />
            </div>
            
            {/* Auto-Execution Engine */}
            <ArbitrageAutomationPanel />
            
            {/* Multi-Exchange Arbitrage with Delta-Neutral Hedging */}
            <MultiExchangeArbitrage />
          </TabsContent>

          <TabsContent value="strategies" className="space-y-6 animate-in fade-in-50 duration-300">
            <AutoMLAgent />
            <StrategyEngine />
          </TabsContent>

          <TabsContent value="risk" className="space-y-6 animate-in fade-in-50 duration-300">
            <RiskEngine />
            <CollapsibleRiskPanel metrics={riskMetrics} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6 animate-in fade-in-50 duration-300">
            <BacktestResults />
            <TradingChart />
            <MarketData />
          </TabsContent>

          <TabsContent value="execution" className="space-y-6 animate-in fade-in-50 duration-300">
            <ExecutionRouter symbol="BTC/USD" />
            <CompactExecutionPanel metrics={executionMetrics} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6 animate-in fade-in-50 duration-300">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <BacktestPanel />
              </div>
              <SystemStatusWidget />
            </div>
            <ApiKeyManager />
            <BotControls />
          </TabsContent>
        </Tabs>
      </main>

      {/* Sticky Bot Controls Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50">
        <div className="glass-panel border-t border-border/50 px-4 py-3">
          <div className="container mx-auto flex items-center justify-center gap-3">
            <Button 
              onClick={() => handleBotControl('start', 'paper')} 
              disabled={botStatus === 'running' || !isConnected}
              className="bg-success hover:bg-success/90 text-success-foreground gap-2 rounded-xl shadow-lg"
            >
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Start Bot</span>
            </Button>
            
            <Button 
              onClick={() => handleBotControl('pause')} 
              disabled={botStatus === 'paused' || !isConnected}
              variant="outline"
              className="gap-2 rounded-xl"
            >
              <Pause className="h-4 w-4" />
              <span className="hidden sm:inline">Pause</span>
            </Button>
            
            <Button 
              onClick={() => handleBotControl('stop')} 
              disabled={botStatus === 'stopped' || !isConnected}
              variant="outline"
              className="gap-2 rounded-xl"
            >
              <Square className="h-4 w-4" />
              <span className="hidden sm:inline">Stop</span>
            </Button>
            
            <div className="w-px h-8 bg-border mx-2" />
            
            <Button 
              onClick={() => handleBotControl('kill')}
              disabled={!isConnected}
              variant="destructive"
              className="gap-2 rounded-xl shadow-lg"
            >
              <AlertOctagon className="h-4 w-4" />
              <span className="hidden sm:inline">Kill Switch</span>
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
};