import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, TrendingUp, Activity, Target, AlertTriangle } from 'lucide-react';

export const BacktestPanel = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  
  // Set default dates - start date 30 days ago, end date today
  const getDefaultDates = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    return {
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
    };
  };

  const [config, setConfig] = useState({
    name: 'Momentum Strategy Test',
    symbol: 'BTC/USD',
    interval: '1h',
    ...getDefaultDates(),
    initialCapital: 100000,
    trendWeight: 0.35,
    meanRevWeight: 0.35,
    carryWeight: 0.30,
    signalThreshold: 0.15,
    stopLoss: 0.02,
    takeProfit: 0.05,
    maxPositionSize: 0.30,
  });

  const handleFetchHistoricalData = async () => {
    setFetchingData(true);
    try {
      const startTimestamp = Math.floor(new Date(config.startDate).getTime() / 1000);
      
      toast({
        title: 'Fetching historical data',
        description: 'This may take a minute...',
      });

      const { data, error } = await supabase.functions.invoke('fetch-historical-data', {
        body: {
          symbol: config.symbol,
          interval: config.interval,
          since: startTimestamp,
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Fetched ${data.count} candles from Kraken`,
      });
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch historical data',
        variant: 'destructive',
      });
    } finally {
      setFetchingData(false);
    }
  };

  const handleRunBacktest = async () => {
    // Validate dates
    const startDate = new Date(config.startDate);
    const endDate = new Date(config.endDate);
    const today = new Date();
    
    if (endDate > today) {
      toast({
        title: 'Invalid date range',
        description: 'End date cannot be in the future',
        variant: 'destructive',
      });
      return;
    }
    
    if (startDate >= endDate) {
      toast({
        title: 'Invalid date range',
        description: 'Start date must be before end date',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);

      toast({
        title: 'Running backtest',
        description: 'Analyzing historical data...',
      });

      const { data, error } = await supabase.functions.invoke('run-backtest', {
        body: {
          name: config.name,
          symbol: config.symbol,
          interval: config.interval,
          startTimestamp,
          endTimestamp,
          initialCapital: config.initialCapital,
          strategyConfig: {
            trendWeight: config.trendWeight,
            meanRevWeight: config.meanRevWeight,
            carryWeight: config.carryWeight,
            signalThreshold: config.signalThreshold,
            stopLoss: config.stopLoss,
            takeProfit: config.takeProfit,
            maxPositionSize: config.maxPositionSize,
          },
        },
      });

      if (error) throw error;

      toast({
        title: 'Backtest complete!',
        description: `${data.trades_count} trades executed. Check Analytics tab for results.`,
      });
    } catch (error: any) {
      console.error('Error running backtest:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to run backtest',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LineChart className="h-5 w-5" />
          Backtest Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Settings */}
        <div className="space-y-4">
          <div>
            <Label>Backtest Name</Label>
            <Input
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Symbol</Label>
              <Select value={config.symbol} onValueChange={(value) => setConfig({ ...config, symbol: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BTC/USD">BTC/USD</SelectItem>
                  <SelectItem value="ETH/USD">ETH/USD</SelectItem>
                  <SelectItem value="XRP/USD">XRP/USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Interval</Label>
              <Select value={config.interval} onValueChange={(value) => setConfig({ ...config, interval: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">1 Minute</SelectItem>
                  <SelectItem value="5m">5 Minutes</SelectItem>
                  <SelectItem value="15m">15 Minutes</SelectItem>
                  <SelectItem value="1h">1 Hour</SelectItem>
                  <SelectItem value="4h">4 Hours</SelectItem>
                  <SelectItem value="1d">1 Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={config.startDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label>End Date (max: today)</Label>
              <Input
                type="date"
                value={config.endDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Initial Capital ($)</Label>
            <Input
              type="number"
              value={config.initialCapital}
              onChange={(e) => setConfig({ ...config, initialCapital: parseFloat(e.target.value) })}
            />
          </div>
        </div>

        {/* Strategy Parameters */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Strategy Weights
          </h3>

          <div className="space-y-4">
            <div>
              <Label>Trend Weight: {config.trendWeight.toFixed(2)}</Label>
              <Slider
                value={[config.trendWeight]}
                onValueChange={([value]) => setConfig({ ...config, trendWeight: value })}
                max={1}
                step={0.05}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Mean Reversion Weight: {config.meanRevWeight.toFixed(2)}</Label>
              <Slider
                value={[config.meanRevWeight]}
                onValueChange={([value]) => setConfig({ ...config, meanRevWeight: value })}
                max={1}
                step={0.05}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Carry Weight: {config.carryWeight.toFixed(2)}</Label>
              <Slider
                value={[config.carryWeight]}
                onValueChange={([value]) => setConfig({ ...config, carryWeight: value })}
                max={1}
                step={0.05}
                className="mt-2"
              />
            </div>
          </div>
        </div>

        {/* Risk Parameters */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4" />
            Risk Parameters
          </h3>

          <div className="space-y-4">
            <div>
              <Label>Signal Threshold: {config.signalThreshold.toFixed(2)}</Label>
              <Slider
                value={[config.signalThreshold]}
                onValueChange={([value]) => setConfig({ ...config, signalThreshold: value })}
                max={0.5}
                step={0.01}
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stop Loss: {(config.stopLoss * 100).toFixed(1)}%</Label>
                <Slider
                  value={[config.stopLoss]}
                  onValueChange={([value]) => setConfig({ ...config, stopLoss: value })}
                  max={0.1}
                  step={0.005}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Take Profit: {(config.takeProfit * 100).toFixed(1)}%</Label>
                <Slider
                  value={[config.takeProfit]}
                  onValueChange={([value]) => setConfig({ ...config, takeProfit: value })}
                  max={0.2}
                  step={0.01}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Max Position Size: {(config.maxPositionSize * 100).toFixed(0)}%</Label>
              <Slider
                value={[config.maxPositionSize]}
                onValueChange={([value]) => setConfig({ ...config, maxPositionSize: value })}
                max={1}
                step={0.05}
                className="mt-2"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleFetchHistoricalData}
            disabled={fetchingData}
            variant="outline"
            className="flex-1"
          >
            {fetchingData ? 'Fetching...' : 'Fetch Data'}
          </Button>
          <Button
            onClick={handleRunBacktest}
            disabled={loading}
            className="flex-1"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            {loading ? 'Running...' : 'Run Backtest'}
          </Button>
        </div>

        <div className="flex items-start gap-2 p-3 bg-muted rounded-md">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            First fetch historical data, then run the backtest. Results will appear in the Analytics tab.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
