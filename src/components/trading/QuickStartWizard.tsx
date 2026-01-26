import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { 
  Rocket, 
  ArrowRight, 
  ArrowLeft,
  Check,
  Shield,
  TrendingUp,
  Zap,
  Settings2,
  Play,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickStartWizardProps {
  onComplete: (config: WizardConfig) => void;
  onSkip: () => void;
}

interface WizardConfig {
  strategy: 'conservative' | 'moderate' | 'aggressive';
  capital: number;
  stopLoss: number;
  takeProfit: number;
  aiAssist: boolean;
}

const STRATEGIES = [
  {
    id: 'conservative' as const,
    name: 'Safe & Steady',
    icon: Shield,
    description: 'Lower risk, consistent returns',
    stopLoss: 2,
    takeProfit: 4,
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
  },
  {
    id: 'moderate' as const,
    name: 'Balanced',
    icon: TrendingUp,
    description: 'Risk-reward balance',
    stopLoss: 3,
    takeProfit: 6,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/30',
  },
  {
    id: 'aggressive' as const,
    name: 'Growth',
    icon: Zap,
    description: 'Higher risk, higher potential',
    stopLoss: 5,
    takeProfit: 10,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
  },
];

export const QuickStartWizard = ({ onComplete, onSkip }: QuickStartWizardProps) => {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<WizardConfig>({
    strategy: 'moderate',
    capital: 10000,
    stopLoss: 3,
    takeProfit: 6,
    aiAssist: true,
  });

  const selectedStrategy = STRATEGIES.find(s => s.id === config.strategy)!;

  const handleStrategySelect = (strategyId: 'conservative' | 'moderate' | 'aggressive') => {
    const strategy = STRATEGIES.find(s => s.id === strategyId)!;
    setConfig({
      ...config,
      strategy: strategyId,
      stopLoss: strategy.stopLoss,
      takeProfit: strategy.takeProfit,
    });
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else onComplete(config);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-lg glass-panel border-border/50 animate-scale-in">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto p-3 rounded-2xl bg-gradient-to-br from-primary to-accent w-fit mb-4">
            <Rocket className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl gradient-text">Quick Start</CardTitle>
          <CardDescription>Get trading in 3 simple steps</CardDescription>
          
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  s === step ? "w-8 bg-primary" : s < step ? "w-2 bg-primary" : "w-2 bg-muted"
                )}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 1: Strategy Selection */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-semibold text-center">Choose Your Style</h3>
              <div className="grid gap-3">
                {STRATEGIES.map((strategy) => {
                  const Icon = strategy.icon;
                  const isSelected = config.strategy === strategy.id;
                  return (
                    <button
                      key={strategy.id}
                      onClick={() => handleStrategySelect(strategy.id)}
                      className={cn(
                        "w-full p-4 rounded-xl border-2 transition-all duration-200 text-left",
                        "hover:scale-[1.02] active:scale-[0.98]",
                        isSelected 
                          ? `${strategy.borderColor} ${strategy.bgColor}` 
                          : "border-border/50 hover:border-border"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn("p-2 rounded-xl", strategy.bgColor)}>
                          <Icon className={cn("h-6 w-6", strategy.color)} />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{strategy.name}</div>
                          <div className="text-sm text-muted-foreground">{strategy.description}</div>
                        </div>
                        {isSelected && (
                          <Check className={cn("h-5 w-5", strategy.color)} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Capital & Risk */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-lg font-semibold text-center">Set Your Limits</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="capital">Starting Capital</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="capital"
                      type="number"
                      value={config.capital}
                      onChange={(e) => setConfig({ ...config, capital: Number(e.target.value) })}
                      className="pl-7 text-lg h-12"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Stop Loss</Label>
                    <Badge variant="outline" className="text-destructive">-{config.stopLoss}%</Badge>
                  </div>
                  <Slider
                    value={[config.stopLoss]}
                    onValueChange={(v) => setConfig({ ...config, stopLoss: v[0] })}
                    min={1}
                    max={10}
                    step={0.5}
                    className="py-2"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Take Profit</Label>
                    <Badge variant="outline" className="text-success">+{config.takeProfit}%</Badge>
                  </div>
                  <Slider
                    value={[config.takeProfit]}
                    onValueChange={(v) => setConfig({ ...config, takeProfit: v[0] })}
                    min={2}
                    max={20}
                    step={0.5}
                    className="py-2"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">AI Assistant</div>
                      <div className="text-xs text-muted-foreground">Get smart trade suggestions</div>
                    </div>
                  </div>
                  <Switch
                    checked={config.aiAssist}
                    onCheckedChange={(checked) => setConfig({ ...config, aiAssist: checked })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review & Launch */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-lg font-semibold text-center">Ready to Trade!</h3>
              
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-3 mb-3">
                    <selectedStrategy.icon className={cn("h-5 w-5", selectedStrategy.color)} />
                    <span className="font-medium">{selectedStrategy.name} Strategy</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Capital</span>
                      <span className="font-mono">${config.capital.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stop Loss</span>
                      <span className="font-mono text-destructive">-{config.stopLoss}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Take Profit</span>
                      <span className="font-mono text-success">+{config.takeProfit}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AI Assist</span>
                      <span>{config.aiAssist ? '✓ On' : '✗ Off'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-warning/10 border border-warning/30 text-center">
                  <p className="text-sm text-warning">
                    <Shield className="h-4 w-4 inline mr-1" />
                    Starting in <strong>Paper Trading</strong> mode (no real money)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-3 pt-4">
            {step > 1 ? (
              <Button variant="outline" onClick={handleBack} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={onSkip} className="flex-1">
                Skip for now
              </Button>
            )}
            
            <Button onClick={handleNext} className="flex-1 gap-2">
              {step === 3 ? (
                <>
                  <Play className="h-4 w-4" />
                  Start Trading
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
