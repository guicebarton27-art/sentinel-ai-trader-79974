import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  Zap, 
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Radio
} from "lucide-react";

interface NeuronLayer {
  nodes: number[];
  activations: number[];
}

interface Decision {
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  factors: { name: string; weight: number; value: number }[];
}

export const NeuralDecisionViz = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [decision, setDecision] = useState<Decision>({
    action: "HOLD",
    confidence: 67,
    factors: [
      { name: "Price Momentum", weight: 0.25, value: 0.72 },
      { name: "Volume Signal", weight: 0.20, value: 0.45 },
      { name: "Sentiment Score", weight: 0.20, value: 0.68 },
      { name: "Technical RSI", weight: 0.15, value: 0.55 },
      { name: "Volatility", weight: 0.10, value: 0.33 },
      { name: "Order Flow", weight: 0.10, value: 0.61 }
    ]
  });

  const [layers] = useState<NeuronLayer[]>([
    { nodes: [1, 2, 3, 4, 5, 6], activations: [] },
    { nodes: [1, 2, 3, 4, 5, 6, 7, 8], activations: [] },
    { nodes: [1, 2, 3, 4, 5, 6], activations: [] },
    { nodes: [1, 2, 3, 4], activations: [] },
    { nodes: [1, 2, 3], activations: [] }
  ]);

  const [activations, setActivations] = useState<number[][]>([]);
  const [pulsingConnections, setPulsingConnections] = useState<Set<string>>(new Set());

  // Initialize and animate activations
  useEffect(() => {
    const updateActivations = () => {
      const newActivations = layers.map(layer => 
        layer.nodes.map(() => Math.random())
      );
      setActivations(newActivations);

      // Random decision updates
      const actions: ("BUY" | "SELL" | "HOLD")[] = ["BUY", "SELL", "HOLD"];
      const weights = [0.3, 0.2, 0.5]; // Slightly favor HOLD
      const rand = Math.random();
      let cumulative = 0;
      let selectedAction: "BUY" | "SELL" | "HOLD" = "HOLD";
      for (let i = 0; i < actions.length; i++) {
        cumulative += weights[i];
        if (rand < cumulative) {
          selectedAction = actions[i];
          break;
        }
      }

      setDecision(prev => ({
        ...prev,
        action: selectedAction,
        confidence: 50 + Math.floor(Math.random() * 45),
        factors: prev.factors.map(f => ({
          ...f,
          value: Math.max(0, Math.min(1, f.value + (Math.random() - 0.5) * 0.2))
        }))
      }));

      // Pulse random connections
      const newPulsing = new Set<string>();
      for (let i = 0; i < 5; i++) {
        const layerIdx = Math.floor(Math.random() * (layers.length - 1));
        const fromNode = Math.floor(Math.random() * layers[layerIdx].nodes.length);
        const toNode = Math.floor(Math.random() * layers[layerIdx + 1].nodes.length);
        newPulsing.add(`${layerIdx}-${fromNode}-${toNode}`);
      }
      setPulsingConnections(newPulsing);
    };

    updateActivations();
    const interval = setInterval(updateActivations, 1500);
    return () => clearInterval(interval);
  }, [layers]);

  // Draw neural network
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const layerSpacing = width / (layers.length + 1);

    ctx.clearRect(0, 0, width, height);

    // Draw connections
    for (let l = 0; l < layers.length - 1; l++) {
      const x1 = layerSpacing * (l + 1);
      const x2 = layerSpacing * (l + 2);
      
      for (let i = 0; i < layers[l].nodes.length; i++) {
        const y1 = (height / (layers[l].nodes.length + 1)) * (i + 1);
        
        for (let j = 0; j < layers[l + 1].nodes.length; j++) {
          const y2 = (height / (layers[l + 1].nodes.length + 1)) * (j + 1);
          const isPulsing = pulsingConnections.has(`${l}-${i}-${j}`);
          
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          
          if (isPulsing) {
            ctx.strokeStyle = "rgba(139, 92, 246, 0.8)";
            ctx.lineWidth = 2;
          } else {
            const activation = activations[l]?.[i] || 0;
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.1 + activation * 0.2})`;
            ctx.lineWidth = 0.5;
          }
          ctx.stroke();
        }
      }
    }

    // Draw neurons
    for (let l = 0; l < layers.length; l++) {
      const x = layerSpacing * (l + 1);
      
      for (let i = 0; i < layers[l].nodes.length; i++) {
        const y = (height / (layers[l].nodes.length + 1)) * (i + 1);
        const activation = activations[l]?.[i] || 0;
        
        // Glow
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 15);
        gradient.addColorStop(0, `rgba(139, 92, 246, ${0.3 + activation * 0.5})`);
        gradient.addColorStop(1, "rgba(139, 92, 246, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fill();

        // Neuron
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139, 92, 246, ${0.5 + activation * 0.5})`;
        ctx.fill();
        ctx.strokeStyle = "rgba(139, 92, 246, 0.8)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }, [layers, activations, pulsingConnections]);

  const getActionColor = (action: string) => {
    switch (action) {
      case "BUY": return "text-success bg-success/20 border-success/50";
      case "SELL": return "text-destructive bg-destructive/20 border-destructive/50";
      default: return "text-muted-foreground bg-muted/20 border-muted/50";
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "BUY": return <TrendingUp className="h-6 w-6" />;
      case "SELL": return <TrendingDown className="h-6 w-6" />;
      default: return <Minus className="h-6 w-6" />;
    }
  };

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Neural Decision Engine</CardTitle>
              <p className="text-xs text-muted-foreground">Real-time inference visualization</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1 bg-success/10 text-success border-success/30">
            <Radio className="h-3 w-3 animate-pulse" />
            PROCESSING
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Neural Network Visualization */}
          <div className="relative bg-secondary/20 rounded-xl p-4 border border-border/50">
            <canvas
              ref={canvasRef}
              width={350}
              height={200}
              className="w-full h-auto"
            />
            <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Activity className="h-3 w-3 animate-pulse text-primary" />
              <span>6 layers • 27 neurons • 156 connections</span>
            </div>
          </div>

          {/* Decision Output */}
          <div className="space-y-3">
            <div className={`p-4 rounded-xl border-2 flex items-center justify-between ${getActionColor(decision.action)}`}>
              <div className="flex items-center gap-3">
                {getActionIcon(decision.action)}
                <div>
                  <p className="text-2xl font-bold">{decision.action}</p>
                  <p className="text-xs opacity-70">Neural consensus</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-mono font-bold">{decision.confidence}%</p>
                <p className="text-xs opacity-70">Confidence</p>
              </div>
            </div>

            {/* Input Factors */}
            <div className="space-y-2">
              {decision.factors.map((factor, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-24 text-[10px] text-muted-foreground truncate">{factor.name}</div>
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary/50 to-primary transition-all duration-500"
                      style={{ width: `${factor.value * 100}%` }}
                    />
                  </div>
                  <div className="w-10 text-[10px] font-mono text-right">{(factor.value * 100).toFixed(0)}%</div>
                  <div className="w-8 text-[10px] text-muted-foreground">×{factor.weight}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Inference Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Inference Time", value: "12ms", icon: Zap },
            { label: "Model Version", value: "v2.4.1", icon: Brain },
            { label: "Data Points", value: "847", icon: Activity },
            { label: "Last Update", value: "0.5s", icon: Radio }
          ].map((stat, idx) => (
            <div key={idx} className="p-2 rounded-lg bg-secondary/30 border border-border/30 text-center">
              <stat.icon className="h-3 w-3 mx-auto mb-1 text-primary" />
              <p className="text-xs font-semibold">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
