import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Flame, 
  Check, 
  X, 
  AlertTriangle,
  Play,
  Shield
} from 'lucide-react';

interface ChaosTestResult {
  type: string;
  passed: boolean;
  outcome: string;
  duration_ms: number;
}

export const ChaosRunnerPanel = () => {
  const [loading, setLoading] = useState(false);
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [result, setResult] = useState<{
    tests_run: number;
    passed: number;
    failed: number;
    resilience_score: number;
    overall_passed: boolean;
    results: ChaosTestResult[];
    recommendations: string[];
  } | null>(null);
  const { toast } = useToast();

  const runChaosTests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('chaos-runner', {
        body: { test_types: ['all'], intensity }
      });

      if (error) throw error;

      setResult(data);
      toast({
        title: data.overall_passed ? 'Chaos Tests Passed' : 'Chaos Tests Failed',
        description: `${data.passed}/${data.tests_run} tests passed (${data.resilience_score}% resilience)`,
        variant: data.overall_passed ? 'default' : 'destructive',
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

  const getTestIcon = (type: string) => {
    const icons: Record<string, string> = {
      exchange_failure: '🔌',
      latency_spike: '⏱️',
      data_gap: '📊',
      api_timeout: '⌛',
      connection_drop: '🔗',
      rate_limit: '🚦',
      invalid_response: '⚠️',
    };
    return icons[type] || '🔧';
  };

  const getResilienceColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-destructive" />
            Chaos Runner
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={intensity} onValueChange={(v: 'low' | 'medium' | 'high') => setIntensity(v)}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={runChaosTests} 
              disabled={loading}
              size="sm"
              variant="destructive"
              className="gap-2"
            >
              <Play className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
              Run Tests
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {result ? (
          <>
            {/* Resilience Score */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/30">
              <div className="flex items-center gap-3">
                <Shield className={`h-8 w-8 ${getResilienceColor(result.resilience_score)}`} />
                <div>
                  <div className="text-2xl font-bold">{result.resilience_score}%</div>
                  <div className="text-xs text-muted-foreground">System Resilience</div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Check className="h-3 w-3 text-success" />
                    {result.passed}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <X className="h-3 w-3 text-destructive" />
                    {result.failed}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {result.tests_run} tests run
                </div>
              </div>
            </div>

            {/* Test Results */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {result.results?.map((test, i) => (
                <div 
                  key={i}
                  className={`flex items-center justify-between p-2 rounded-lg border ${
                    test.passed 
                      ? 'bg-success/5 border-success/20' 
                      : 'bg-destructive/5 border-destructive/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getTestIcon(test.type)}</span>
                    <div>
                      <div className="text-sm font-medium capitalize">
                        {test.type.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                        {test.outcome}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {test.duration_ms}ms
                    </span>
                    {test.passed ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span className="text-sm font-medium">Recommendations</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Flame className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Run chaos tests to verify system resilience</p>
            <p className="text-xs mt-1">Simulates failures, latency, and data gaps</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
