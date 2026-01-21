import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Award, Gauge, Layers, Sparkles, Target } from "lucide-react";

const profitLevers = [
  {
    title: "Regime detection",
    detail: "Auto-shifts between momentum, breakout, and mean reversion using live volatility bands.",
    impact: "High",
  },
  {
    title: "Fee-aware routing",
    detail: "Routes to lower-fee venues and batches orders to reduce taker drag.",
    impact: "Medium",
  },
  {
    title: "Adaptive sizing",
    detail: "Scales exposure with signal confidence and drawdown conditions.",
    impact: "High",
  },
  {
    title: "Signal throttling",
    detail: "Suppresses low-quality trades during choppy ranges to protect edge.",
    impact: "High",
  },
  {
    title: "Cross-market confirmation",
    detail: "Requires multi-timeframe alignment before allocating full risk.",
    impact: "Medium",
  },
  {
    title: "Volatility targeting",
    detail: "Targets stable portfolio volatility with dynamic leverage caps.",
    impact: "Medium",
  },
];

const optimizationChecklist = [
  {
    id: "edge-filter",
    title: "Edge quality filter",
    description: "Drop signals below 0.62 confidence.",
    weight: 18,
  },
  {
    id: "fee-budget",
    title: "Fee budget enforcement",
    description: "Cap fee drag at 14 bps daily.",
    weight: 14,
  },
  {
    id: "slippage-guard",
    title: "Slippage guardrails",
    description: "Cancel trades > 0.12% expected impact.",
    weight: 16,
  },
  {
    id: "capital-rotation",
    title: "Capital rotation",
    description: "Rebalance into top 3 strategies every 6h.",
    weight: 20,
  },
  {
    id: "drawdown-cut",
    title: "Drawdown-based de-risking",
    description: "Cut exposure by 35% after -3% intraday.",
    weight: 17,
  },
  {
    id: "latency-hedge",
    title: "Latency hedge",
    description: "Switch to passive orders when latency > 25ms.",
    weight: 15,
  },
];

export const ProfitabilityBlueprint = () => {
  const [enabledOptions, setEnabledOptions] = useState<Record<string, boolean>>({
    "edge-filter": true,
    "fee-budget": true,
    "slippage-guard": true,
    "capital-rotation": true,
    "drawdown-cut": true,
    "latency-hedge": false,
  });

  const score = useMemo(() => {
    return optimizationChecklist.reduce((total, item) => {
      return enabledOptions[item.id] ? total + item.weight : total;
    }, 0);
  }, [enabledOptions]);

  const scoreLabel = score >= 85 ? "Elite" : score >= 70 ? "Strong" : "Developing";

  const toggleOption = (id: string) => {
    setEnabledOptions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Card className="border-primary/30 shadow-quant">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Profitability Blueprint
            </CardTitle>
            <CardDescription>
              Hardening every edge lever for maximum risk-adjusted returns.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              Profit Score
            </Badge>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-primary">{score}</span>
              <span className="text-xs uppercase text-muted-foreground">{scoreLabel}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Progress value={score} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Baseline</span>
            <span>Elite target 90+</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-card/50 p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-success" />
              <p className="font-semibold">Signal Quality</p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Prioritize high-conviction signals and reduce noise exposure in sideways markets.
            </p>
            <Separator className="my-3" />
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span>Confidence floor</span>
                <Badge variant="secondary">0.62+</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Regime validation</span>
                <Badge variant="secondary">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Signal decay</span>
                <Badge variant="secondary">12 min</Badge>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-card/50 p-4">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-warning" />
              <p className="font-semibold">Execution Efficiency</p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Minimize slippage and fees with passive routing and adaptive order sizing.
            </p>
            <Separator className="my-3" />
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span>Fee budget</span>
                <Badge variant="secondary">14 bps</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Maker ratio</span>
                <Badge variant="secondary">68%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Max slippage</span>
                <Badge variant="secondary">0.12%</Badge>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-card/50 p-4">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <p className="font-semibold">Risk Efficiency</p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Maintain high expected edge while tightening downside exposure.
            </p>
            <Separator className="my-3" />
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span>Drawdown cut</span>
                <Badge variant="secondary">-3%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Volatility target</span>
                <Badge variant="secondary">18%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Tail hedge</span>
                <Badge variant="secondary">On</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <p className="font-semibold">Edge levers</p>
            </div>
            <div className="mt-3 space-y-3">
              {profitLevers.map((lever) => (
                <div key={lever.title} className="rounded-lg border border-border/50 bg-background p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{lever.title}</p>
                    <Badge variant="outline" className="text-xs">
                      {lever.impact} impact
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{lever.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Optimization checklist</p>
                <p className="text-xs text-muted-foreground">
                  Toggle to simulate profit impact.
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {Object.values(enabledOptions).filter(Boolean).length} / {optimizationChecklist.length} active
              </Badge>
            </div>
            <div className="mt-3 space-y-3">
              {optimizationChecklist.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-background p-3">
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Switch checked={enabledOptions[item.id]} onCheckedChange={() => toggleOption(item.id)} />
                    <Badge variant="outline" className="text-[10px]">
                      +{item.weight} pts
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            <Button className="mt-4 w-full gap-2">
              Apply Optimization Plan
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
