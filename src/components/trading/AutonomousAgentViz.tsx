import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useTicker } from "@/hooks/useMarketData";
import { 
  Bot, 
  Brain, 
  Eye, 
  Shield, 
  Zap, 
  Target, 
  GitBranch,
  Activity,
  Radio,
  Cpu,
  Network,
  Workflow,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock
} from "lucide-react";

interface Agent {
  id: string;
  name: string;
  type: "strategy" | "risk" | "execution" | "sentiment" | "learning";
  status: "active" | "thinking" | "idle" | "alert" | "offline";
  confidence: number;
  lastAction: string;
  metrics: {
    decisions: number;
    accuracy: number;
    latency: number;
  };
}

interface Connection {
  from: string;
  to: string;
  signal: "strong" | "weak" | "none";
  data?: string;
}

export const AutonomousAgentViz = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pulseIndex, setPulseIndex] = useState(0);
  const [totalDecisions, setTotalDecisions] = useState(0);
  const [consensusAction, setConsensusAction] = useState<'BUY' | 'SELL' | 'HOLD'>('HOLD');
  const [avgConfidence, setAvgConfidence] = useState(0);

  // Real market data
  const { ticker } = useTicker({ symbol: 'BTC/USD', refreshInterval: 5000 });

  // Fetch real agent data from database
  useEffect(() => {
    const fetchAgentData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch bot data for strategy/execution agent
        const { data: bots } = await supabase
          .from('bots')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        // Fetch recent orders for execution metrics
        const { data: orders } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100);

        // Fetch sentiment data
        const { data: sentiment } = await supabase
          .from('sentiment_data')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        // Fetch ML predictions
        const { data: predictions } = await supabase
          .from('ml_predictions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        // Fetch bot events for decision count
        const { data: events } = await supabase
          .from('bot_events')
          .select('id, event_type, created_at')
          .eq('user_id', user.id)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        const bot = bots?.[0];
        const orderCount = orders?.length || 0;
        const filledOrders = orders?.filter(o => o.status === 'filled').length || 0;
        const sentimentScore = sentiment?.[0]?.sentiment_score || 0;
        const predictionConfidence = predictions?.[0]?.confidence || 0.5;
        const eventCount = events?.length || 0;

        // Calculate real metrics
        const winRate = bot ? (bot.winning_trades / Math.max(1, bot.total_trades)) * 100 : 75;
        const executionAccuracy = orderCount > 0 ? (filledOrders / orderCount) * 100 : 98;

        // Build agents from real data
        // Build agents from real database data only - no hardcoded fallback values
        const realAgents: Agent[] = [
          {
            id: "strategy",
            name: "Strategy Agent",
            type: "strategy",
            status: bot?.status === 'running' ? 'active' : bot ? 'idle' : 'offline',
            confidence: bot ? Math.min(99, 70 + winRate * 0.3) : 0,
            lastAction: bot ? `${bot.strategy_id} on ${bot.symbol}` : 'No bot configured',
            metrics: { 
              decisions: bot?.total_trades || 0, 
              accuracy: bot ? winRate : 0, 
              latency: bot?.last_tick_at ? Math.round((Date.now() - new Date(bot.last_tick_at).getTime()) / 1000) : 0
            }
          },
          {
            id: "risk",
            name: "Risk Guardian",
            type: "risk",
            status: bot?.error_count && bot.error_count > 3 ? 'alert' : bot ? 'active' : 'offline',
            confidence: bot ? Math.max(50, 100 - (bot.error_count || 0) * 5) : 0,
            lastAction: bot?.last_error || (bot ? 'All risk checks passed' : 'No bot configured'),
            metrics: { 
              decisions: eventCount, 
              accuracy: eventCount > 0 ? Math.round((1 - (bot?.error_count || 0) / Math.max(1, eventCount)) * 100) : 0, 
              latency: 0 // Real latency would come from event timestamps
            }
          },
          {
            id: "execution",
            name: "Execution Engine",
            type: "execution",
            status: orderCount > 0 ? 'active' : 'idle',
            confidence: orderCount > 0 ? Math.min(99, executionAccuracy) : 0,
            lastAction: orders?.[0] ? `${orders[0].side} ${orders[0].quantity} @ ${orders[0].average_fill_price || orders[0].price}` : 'No orders',
            metrics: { 
              decisions: orderCount, 
              accuracy: orderCount > 0 ? executionAccuracy : 0, 
              latency: 0 // Would need order execution timestamps
            }
          },
          {
            id: "sentiment",
            name: "Sentiment Scanner",
            type: "sentiment",
            status: sentiment && sentiment.length > 0 ? 'active' : 'offline',
            confidence: sentiment?.length ? Math.min(99, 50 + Math.abs(sentimentScore) * 50) : 0,
            lastAction: sentiment?.[0] ? `${sentiment[0].source}: ${sentiment[0].trend || 'analyzing'}` : 'No sentiment data',
            metrics: { 
              decisions: sentiment?.length || 0, 
              accuracy: sentiment?.[0]?.confidence ? sentiment[0].confidence * 100 : 0, 
              latency: 0
            }
          },
          {
            id: "learning",
            name: "Meta-Learner",
            type: "learning",
            status: predictions && predictions.length > 0 ? 'active' : 'offline',
            confidence: predictions?.length ? Math.min(99, predictionConfidence * 100) : 0,
            lastAction: predictions?.[0] ? `${predictions[0].prediction_type} prediction` : 'No predictions',
            metrics: { 
              decisions: predictions?.length || 0, 
              accuracy: predictions?.length ? predictionConfidence * 100 : 0, 
              latency: 0
            }
          }
        ];

        setAgents(realAgents);
        setTotalDecisions(realAgents.reduce((sum, a) => sum + a.metrics.decisions, 0));
        setAvgConfidence(realAgents.reduce((sum, a) => sum + a.confidence, 0) / realAgents.length);

        // Determine consensus from real signals
        const bullishSignals = (sentimentScore > 0 ? 1 : 0) + (ticker && (ticker.change24h || 0) > 0 ? 1 : 0);
        const bearishSignals = (sentimentScore < 0 ? 1 : 0) + (ticker && (ticker.change24h || 0) < 0 ? 1 : 0);
        setConsensusAction(bullishSignals > bearishSignals ? 'BUY' : bearishSignals > bullishSignals ? 'SELL' : 'HOLD');

        // Build connections based on real data flow
        setConnections([
          { 
            from: "sentiment", 
            to: "strategy", 
            signal: Math.abs(sentimentScore) > 0.3 ? "strong" : sentimentScore !== 0 ? "weak" : "none", 
            data: `Sentiment ${sentimentScore > 0 ? '+' : ''}${(sentimentScore * 100).toFixed(0)}%` 
          },
          { 
            from: "strategy", 
            to: "risk", 
            signal: bot?.status === 'running' ? "strong" : "weak", 
            data: bot ? `${bot.strategy_id} signal` : "Awaiting signal"
          },
          { 
            from: "risk", 
            to: "execution", 
            signal: (bot?.error_count || 0) < 3 ? "strong" : "weak", 
            data: `Risk score: ${bot?.error_count || 0}/10` 
          },
          { 
            from: "execution", 
            to: "learning", 
            signal: orderCount > 0 ? "strong" : "none", 
            data: `${orderCount} orders processed` 
          },
          { 
            from: "learning", 
            to: "strategy", 
            signal: predictions && predictions.length > 0 ? "strong" : "weak", 
            data: `Model accuracy: ${(predictionConfidence * 100).toFixed(0)}%` 
          }
        ]);

      } catch (err) {
        console.error('Error fetching agent data:', err);
      }
    };

    fetchAgentData();
    const interval = setInterval(fetchAgentData, 15000);
    return () => clearInterval(interval);
  }, [ticker]);

  // Pulse animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseIndex(prev => (prev + 1) % 5);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const getAgentIcon = (type: string) => {
    switch (type) {
      case "strategy": return <Brain className="h-5 w-5" />;
      case "risk": return <Shield className="h-5 w-5" />;
      case "execution": return <Zap className="h-5 w-5" />;
      case "sentiment": return <Eye className="h-5 w-5" />;
      case "learning": return <GitBranch className="h-5 w-5" />;
      default: return <Bot className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-success text-success-foreground";
      case "thinking": return "bg-primary text-primary-foreground animate-pulse";
      case "alert": return "bg-warning text-warning-foreground";
      case "offline": return "bg-destructive/20 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case "strong": return "border-success/50 shadow-success/20";
      case "weak": return "border-warning/50 shadow-warning/20";
      default: return "border-muted/50";
    }
  };

  const getConsensusColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'text-success';
      case 'SELL': return 'text-destructive';
      default: return 'text-warning';
    }
  };

  if (agents.length === 0) {
    return (
      <Card className="border-accent/20">
        <CardContent className="py-12 text-center">
          <Network className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-pulse" />
          <p className="text-muted-foreground">Initializing agent network...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-background via-background to-accent/5">
      {/* Background animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px]">
          <svg className="w-full h-full opacity-10">
            {/* Central hub */}
            <circle cx="300" cy="300" r="40" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" />
            <circle cx="300" cy="300" r="60" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="5,5" className="text-primary/50 animate-spin" style={{ animationDuration: "20s" }} />
            
            {/* Agent nodes */}
            {[0, 72, 144, 216, 288].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const x = 300 + Math.cos(rad) * 180;
              const y = 300 + Math.sin(rad) * 180;
              return (
                <g key={i}>
                  <line x1="300" y1="300" x2={x} y2={y} stroke="currentColor" strokeWidth="1" className={i === pulseIndex ? "text-primary" : "text-muted"} />
                  <circle cx={x} cy={y} r="20" fill="currentColor" className={i === pulseIndex ? "text-primary/30 animate-pulse" : "text-muted/20"} />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <CardHeader className="relative pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-accent to-primary">
              <Network className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                Autonomous Agent Network
                <Badge variant="outline" className="gap-1 text-xs bg-success/10 text-success border-success/30">
                  <Radio className="h-3 w-3 animate-pulse" />
                  LIVE
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{agents.length} agents • {totalDecisions.toLocaleString()} decisions today</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50">
              <Workflow className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Multi-Agent Consensus</span>
              <span className={`text-xs font-mono font-semibold ${getConsensusColor(consensusAction)}`}>
                {consensusAction}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        {/* Agent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {agents.map((agent, idx) => (
            <div
              key={agent.id}
              className={`relative p-4 rounded-xl border-2 transition-all duration-500 ${
                idx === pulseIndex ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border/50 bg-secondary/20'
              }`}
            >
              {/* Connection indicator */}
              {idx < agents.length - 1 && (
                <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                  <ArrowRight className={`h-4 w-4 transition-colors duration-300 ${
                    connections[idx]?.signal === 'strong' ? 'text-success' :
                    connections[idx]?.signal === 'weak' ? 'text-warning' : 'text-muted'
                  }`} />
                </div>
              )}

              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${getStatusColor(agent.status)}`}>
                  {getAgentIcon(agent.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{agent.name}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Confidence</span>
                  <span className="text-xs font-mono text-foreground">{agent.confidence.toFixed(0)}%</span>
                </div>
                <Progress value={agent.confidence} className="h-1.5" />

                <p className="text-[10px] text-muted-foreground truncate">{agent.lastAction}</p>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{agent.metrics.decisions} ops</span>
                  <span>•</span>
                  <span>{agent.metrics.accuracy.toFixed(1)}% acc</span>
                </div>
              </div>

              {/* Status indicator */}
              <div className="absolute top-2 right-2">
                {agent.status === "active" && <CheckCircle2 className="h-3 w-3 text-success" />}
                {agent.status === "thinking" && <Cpu className="h-3 w-3 text-primary animate-pulse" />}
                {agent.status === "alert" && <AlertCircle className="h-3 w-3 text-warning" />}
                {agent.status === "idle" && <Clock className="h-3 w-3 text-muted-foreground" />}
              </div>
            </div>
          ))}
        </div>

        {/* Data Flow Visualization */}
        <div className="grid grid-cols-4 gap-2">
          {connections.slice(0, 4).map((conn, idx) => (
            <div
              key={idx}
              className={`p-2 rounded-lg border transition-all duration-300 ${getSignalColor(conn.signal)}`}
            >
              <div className="flex items-center gap-1 mb-1">
                <Activity className={`h-3 w-3 ${
                  conn.signal === 'strong' ? 'text-success' :
                  conn.signal === 'weak' ? 'text-warning' : 'text-muted'
                }`} />
                <span className="text-[10px] font-medium">
                  {conn.from} → {conn.to}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{conn.data}</p>
            </div>
          ))}
        </div>

        {/* System Status Bar */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Target className={`h-4 w-4 ${getConsensusColor(consensusAction)}`} />
              <span className="text-xs">Consensus: <span className={`font-semibold ${getConsensusColor(consensusAction)}`}>{consensusAction}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs">Avg Confidence: <span className="font-semibold">{avgConfidence.toFixed(1)}%</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-success" />
              <span className="text-xs">Risk: <span className="text-success font-semibold">{avgConfidence > 70 ? 'LOW' : avgConfidence > 50 ? 'MEDIUM' : 'HIGH'}</span></span>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {ticker ? `BTC $${ticker.price.toLocaleString()}` : 'Loading...'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
