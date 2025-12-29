import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  ShieldCheck, 
  ShieldX, 
  Check, 
  X, 
  AlertOctagon,
  Play
} from 'lucide-react';

interface ValidationResult {
  validation_passed: boolean;
  validation_results: {
    kill_switch_active: boolean;
    position_limit_exceeded: boolean;
    daily_loss_limit_exceeded: boolean;
    correlation_limit_exceeded: boolean;
    leverage_exceeded: boolean;
  };
  rejection_reasons: string[];
  risk_score: number;
  recommendation: string;
}

export const TradeValidatorPanel = () => {
  const [loading, setLoading] = useState(false);
  const [trade, setTrade] = useState({
    symbol: 'BTC/USD',
    side: 'buy',
    size: 0.1,
    order_type: 'market'
  });
  const [result, setResult] = useState<ValidationResult | null>(null);
  const { toast } = useToast();

  const validateTrade = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('trade-validator', {
        body: { 
          trade,
          account_balance: 100000,
          daily_pnl: -1200,
          current_positions: [
            { symbol: 'ETH/USD', size: 2.5, value: 8500 }
          ]
        }
      });

      if (error) throw error;

      setResult(data);
      toast({
        title: data.validation_passed ? 'Trade Approved' : 'Trade Rejected',
        description: data.recommendation,
        variant: data.validation_passed ? 'default' : 'destructive',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score <= 20) return 'text-success';
    if (score <= 50) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Trade Validator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trade Input Form */}
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Symbol</Label>
            <Select value={trade.symbol} onValueChange={(v) => setTrade({...trade, symbol: v})}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BTC/USD">BTC/USD</SelectItem>
                <SelectItem value="ETH/USD">ETH/USD</SelectItem>
                <SelectItem value="SOL/USD">SOL/USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Side</Label>
            <Select value={trade.side} onValueChange={(v) => setTrade({...trade, side: v})}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Size</Label>
            <Input 
              type="number" 
              step="0.01"
              value={trade.size}
              onChange={(e) => setTrade({...trade, size: parseFloat(e.target.value) || 0})}
              className="h-8"
            />
          </div>
          <div className="flex items-end">
            <Button 
              onClick={validateTrade} 
              disabled={loading}
              size="sm"
              className="w-full gap-2"
            >
              <Play className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
              Validate
            </Button>
          </div>
        </div>

        {result && (
          <>
            {/* Validation Result */}
            <div className={`flex items-center justify-between p-4 rounded-lg border ${
              result.validation_passed 
                ? 'bg-success/10 border-success/30' 
                : 'bg-destructive/10 border-destructive/30'
            }`}>
              <div className="flex items-center gap-3">
                {result.validation_passed ? (
                  <ShieldCheck className="h-8 w-8 text-success" />
                ) : (
                  <ShieldX className="h-8 w-8 text-destructive" />
                )}
                <div>
                  <div className="font-bold">
                    {result.validation_passed ? 'APPROVED' : 'REJECTED'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {result.recommendation}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${getRiskColor(result.risk_score)}`}>
                  {result.risk_score}
                </div>
                <div className="text-xs text-muted-foreground">Risk Score</div>
              </div>
            </div>

            {/* Validation Checks */}
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(result.validation_results).map(([key, failed]) => (
                <div 
                  key={key}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${
                    failed ? 'bg-destructive/10 border-destructive/20' : 'bg-secondary/30 border-border/30'
                  }`}
                >
                  {failed ? (
                    <X className="h-4 w-4 text-destructive" />
                  ) : (
                    <Check className="h-4 w-4 text-success" />
                  )}
                  <span className="text-xs capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>

            {/* Rejection Reasons */}
            {result.rejection_reasons.length > 0 && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertOctagon className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium">Rejection Reasons</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {result.rejection_reasons.map((reason, i) => (
                    <li key={i}>• {reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
