import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  status: "active" | "thinking" | "idle" | "alert";
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
  const [agents, setAgents] = useState<Agent[]>([
    {
      id: "strategy",
      name: "Strategy Agent",
      type: "strategy",
      status: "active",
      confidence: 87,
      lastAction: "Identified momentum opportunity",
      metrics: { decisions: 1247, accuracy: 73.2, latency: 12 }
    },
    {
      id: "risk",
      name: "Risk Guardian",
      type: "risk",
      status: "active",
      confidence: 94,
      lastAction: "Approved position sizing",
      metrics: { decisions: 3891, accuracy: 96.1, latency: 3 }
    },
    {
      id: "execution",
      name: "Execution Engine",
      type: "execution",
      status: "thinking",
      confidence: 91,
      lastAction: "Optimizing order routing",
      metrics: { decisions: 892, accuracy: 98.7, latency: 8 }
    },
    {
      id: "sentiment",
      name: "Sentiment Scanner",
      type: "sentiment",
      status: "active",
      confidence: 76,
      lastAction: "Processing social signals",
      metrics: { decisions: 5623, accuracy: 68.4, latency: 45 }
    },
    {
      id: "learning",
      name: "Meta-Learner",
      type: "learning",
      status: "active",
      confidence: 82,
      lastAction: "Updating strategy weights",
      metrics: { decisions: 156, accuracy: 71.8, latency: 1200 }
    }
  ]);

  const [connections, setConnections] = useState<Connection[]>([
    { from: "sentiment", to: "strategy", signal: "strong", data: "Bullish sentiment +0.34" },
    { from: "strategy", to: "risk", signal: "strong", data: "BUY signal 0.87 conf" },
    { from: "risk", to: "execution", signal: "weak", data: "Sizing: 2.1% capital" },
    { from: "execution", to: "learning", signal: "none", data: "Awaiting fill" },
    { from: "learning", to: "strategy", signal: "strong", data: "Model v2.4.1 deployed" }
  ]);

  const [pulseIndex, setPulseIndex] = useState(0);

  // Simulate agent activity
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents(prev => prev.map(agent => ({
        ...agent,
        confidence: Math.max(50, Math.min(99, agent.confidence + (Math.random() - 0.5) * 5)),
        status: Math.random() > 0.9 
          ? (["active", "thinking", "alert"] as const)[Math.floor(Math.random() * 3)]
          : agent.status
      })));

      setConnections(prev => prev.map(conn => ({
        ...conn,
        signal: (["strong", "weak", "none"] as const)[Math.floor(Math.random() * 3)]
      })));

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
              <p className="text-xs text-muted-foreground">5 agents • 11,809 decisions today</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50">
              <Workflow className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Multi-Agent Consensus</span>
              <span className="text-xs text-success font-mono">ALIGNED</span>
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
                  <span>{agent.metrics.accuracy}% acc</span>
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
              <Target className="h-4 w-4 text-success" />
              <span className="text-xs">Consensus: <span className="text-success font-semibold">BUY</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs">Avg Confidence: <span className="font-semibold">86.0%</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-success" />
              <span className="text-xs">Risk: <span className="text-success font-semibold">LOW</span></span>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">
            Next decision in 47s
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
