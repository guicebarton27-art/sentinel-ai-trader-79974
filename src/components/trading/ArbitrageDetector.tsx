import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Zap, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ArbitrageOpportunity {
  path: string[];
  profitPercentage: number;
  volume: number;
  timestamp: number;
}

export const ArbitrageDetector = () => {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchArbitrage = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-arbitrage', {
        body: {}
      });

      if (error) throw error;
      
      if (data.success) {
        setOpportunities(data.opportunities);
      }
    } catch (error: any) {
      toast({
        title: "Error detecting arbitrage",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArbitrage();
    const interval = setInterval(fetchArbitrage, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="bg-gradient-to-br from-card via-card to-execution/5 border-execution/20 shadow-performance">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-execution" />
            Arbitrage Opportunities
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-execution/30 text-execution">
              {opportunities.length} Active
            </Badge>
            <RefreshCw 
              className={`h-4 w-4 text-muted-foreground cursor-pointer hover:text-execution transition-colors ${loading ? 'animate-spin' : ''}`}
              onClick={fetchArbitrage}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {loading && opportunities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Scanning for opportunities...</div>
          ) : opportunities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No profitable opportunities found</div>
          ) : (
            opportunities.map((opp, idx) => (
              <div key={idx} className="p-4 rounded-lg bg-gradient-to-r from-secondary/60 to-secondary/30 border border-border/50 hover:border-execution/30 transition-all space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    {opp.path.map((asset, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="font-mono font-medium">{asset}</span>
                        {i < opp.path.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    ))}
                  </div>
                  <Badge variant="default" className="gap-1 bg-execution/20 text-execution border-execution/30">
                    <TrendingUp className="h-3 w-3" />
                    +{opp.profitPercentage.toFixed(2)}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Est. Volume: ${opp.volume.toLocaleString()}
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-execution/30 hover:bg-execution/10">
                    Execute
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
          Scanning triangular arbitrage paths every 60 seconds
        </div>
      </CardContent>
    </Card>
  );
};
