import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Route, ArrowUpRight, Clock, TrendingDown } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExecutionRouterProps {
  symbol: string;
}

export const ExecutionRouter = ({ symbol }: ExecutionRouterProps) => {
  const [loading, setLoading] = useState(false);
  const [routing, setRouting] = useState<any>(null);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [size, setSize] = useState('0.1');
  const [orderType, setOrderType] = useState('market');

  const getRouting = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ml-execution-router', {
        body: { symbol, side, size: parseFloat(size), order_type: orderType, urgency: 'normal' }
      });

      if (error) throw error;
      setRouting(data);
      toast.success('Execution routing calculated');
    } catch (error: any) {
      console.error('Execution routing error:', error);
      toast.error('Failed to calculate routing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Route className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Smart Execution Router</h3>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Side</Label>
            <Select value={side} onValueChange={(v: any) => setSide(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Size</Label>
            <Input
              type="number"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              step="0.01"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Order Type</Label>
          <Select value={orderType} onValueChange={setOrderType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="market">Market</SelectItem>
              <SelectItem value="limit">Limit</SelectItem>
              <SelectItem value="twap">TWAP</SelectItem>
              <SelectItem value="vwap">VWAP</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={getRouting} disabled={loading} className="w-full">
          {loading ? 'Calculating...' : 'Calculate Optimal Route'}
        </Button>

        {routing && (
          <div className="space-y-4 pt-4 border-t">
            <div className="bg-accent/50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <Badge variant="default">{routing.recommended_venue}</Badge>
                <Badge variant="outline">{routing.execution_strategy}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Slices</p>
                  <p className="font-semibold">{routing.slice_count}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-semibold">{routing.time_window}m</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Risk</p>
                  <p className="font-semibold">{routing.risk_score}/100</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <ArrowUpRight className="h-4 w-4 text-warning mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Price Impact</p>
                  <p className="font-semibold">{routing.price_impact?.toFixed(3)}%</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <TrendingDown className="h-4 w-4 text-destructive mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Slippage</p>
                  <p className="font-semibold">{routing.expected_slippage?.toFixed(3)}%</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-primary mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Fill Time</p>
                  <p className="font-semibold">{routing.expected_fill_time?.toFixed(1)}m</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Est. Cost</p>
                <p className="font-semibold">${routing.cost_estimate?.toFixed(2)}</p>
              </div>
            </div>

            {routing.execution_tips && (
              <div className="text-sm">
                <p className="font-semibold mb-1">Execution Tips</p>
                <p className="text-muted-foreground">{routing.execution_tips}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
