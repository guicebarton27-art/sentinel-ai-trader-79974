import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Activity,
  BarChart3,
  DollarSign
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BacktestRun {
  id: string;
  name: string;
  symbol: string;
  interval: string;
  total_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_trades: number;
  profit_factor: number;
  created_at: string;
}

export const BacktestResults = () => {
  const [backtests, setBacktests] = useState<BacktestRun[]>([]);
  const [selectedBacktest, setSelectedBacktest] = useState<string | null>(null);
  const [equityCurve, setEquityCurve] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBacktests();
  }, []);

  useEffect(() => {
    if (selectedBacktest) {
      loadEquityCurve(selectedBacktest);
    }
  }, [selectedBacktest]);

  const loadBacktests = async () => {
    try {
      const { data, error } = await supabase
        .from('backtest_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setBacktests(data || []);
      if (data && data.length > 0) {
        setSelectedBacktest(data[0].id);
      }
    } catch (error) {
      console.error('Error loading backtests:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEquityCurve = async (backtestId: string) => {
    try {
      const { data, error } = await supabase
        .from('backtest_equity_curve')
        .select('*')
        .eq('backtest_run_id', backtestId)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      setEquityCurve(data || []);
    } catch (error) {
      console.error('Error loading equity curve:', error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Loading backtest results...</p>
        </CardContent>
      </Card>
    );
  }

  if (backtests.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">No backtest results yet. Run a backtest to see results here.</p>
        </CardContent>
      </Card>
    );
  }

  const currentBacktest = backtests.find(b => b.id === selectedBacktest);

  return (
    <div className="space-y-4">
      {/* Backtest List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Backtests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {backtests.map((backtest) => (
              <div
                key={backtest.id}
                onClick={() => setSelectedBacktest(backtest.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedBacktest === backtest.id ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{backtest.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {backtest.symbol} • {backtest.interval} • {backtest.total_trades} trades
                    </p>
                  </div>
                  <Badge variant={backtest.total_return > 0 ? 'default' : 'destructive'}>
                    {backtest.total_return > 0 ? '+' : ''}
                    {backtest.total_return.toFixed(2)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {currentBacktest && (
        <>
          {/* Performance Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Total Return</p>
                </div>
                <p className={`text-2xl font-bold ${currentBacktest.total_return > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {currentBacktest.total_return > 0 ? '+' : ''}
                  {currentBacktest.total_return.toFixed(2)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Sharpe Ratio</p>
                </div>
                <p className="text-2xl font-bold">
                  {currentBacktest.sharpe_ratio?.toFixed(2) || 'N/A'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Max Drawdown</p>
                </div>
                <p className="text-2xl font-bold text-red-600">
                  -{currentBacktest.max_drawdown.toFixed(2)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                </div>
                <p className="text-2xl font-bold">
                  {currentBacktest.win_rate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Total Trades</p>
                </div>
                <p className="text-2xl font-bold">
                  {currentBacktest.total_trades}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Profit Factor</p>
                </div>
                <p className="text-2xl font-bold">
                  {currentBacktest.profit_factor?.toFixed(2) || 'N/A'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Equity Curve */}
          {equityCurve.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Equity Curve</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={equityCurve}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value * 1000).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value * 1000).toLocaleString()}
                      formatter={(value: any) => ['$' + value.toFixed(2), 'Equity']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="equity" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
