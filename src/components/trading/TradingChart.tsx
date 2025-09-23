import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Calendar, BarChart3 } from 'lucide-react';

// Mock data for the chart
const chartData = [
  { time: '00:00', price: 64200, volume: 2400000 },
  { time: '04:00', price: 64500, volume: 1800000 },
  { time: '08:00', price: 63900, volume: 3200000 },
  { time: '12:00', price: 64800, volume: 2800000 },
  { time: '16:00', price: 64300, volume: 2100000 },
  { time: '20:00', price: 64900, volume: 2600000 },
  { time: '24:00', price: 65100, volume: 1900000 }
];

export const TradingChart = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            BTC/USD
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              +1.96%
            </Badge>
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Price Info */}
          <div className="flex items-baseline gap-4">
            <span className="text-3xl font-bold">$64,309.25</span>
            <span className="text-success font-medium">+$1,234.56</span>
          </div>

          {/* Chart */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="time" 
                  className="text-xs fill-muted-foreground" 
                />
                <YAxis 
                  className="text-xs fill-muted-foreground"
                  domain={['dataMin - 200', 'dataMax + 200']}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))'
                  }}
                  formatter={(value: number, name: string) => [
                    name === 'price' ? `$${value.toLocaleString()}` : value.toLocaleString(),
                    name === 'price' ? 'Price' : 'Volume'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Time Frame Buttons */}
          <div className="flex gap-2">
            {['1H', '4H', '1D', '1W', '1M'].map((timeframe) => (
              <Button 
                key={timeframe} 
                variant={timeframe === '1D' ? 'default' : 'outline'} 
                size="sm"
                className="text-xs"
              >
                {timeframe}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};