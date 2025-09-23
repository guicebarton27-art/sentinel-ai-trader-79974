import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Position {
  symbol: string;
  size: number;
  value: number;
  pnl: number;
  pnlPercentage: number;
}

interface PortfolioData {
  totalValue: number;
  pnl: number;
  pnlPercentage: number;
  availableBalance: number;
  positions: Position[];
}

interface PortfolioOverviewProps {
  data: PortfolioData;
}

export const PortfolioOverview = ({ data }: PortfolioOverviewProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Balance Summary */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Total Portfolio</p>
            <p className="text-2xl font-bold">${data.totalValue.toLocaleString()}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Available Balance</p>
            <p className="text-2xl font-bold">${data.availableBalance.toLocaleString()}</p>
          </div>
        </div>

        {/* P&L Summary */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total P&L</span>
            <Badge variant={data.pnl > 0 ? 'default' : 'destructive'}>
              {data.pnl > 0 ? '+' : ''}{data.pnlPercentage}%
            </Badge>
          </div>
          <div className={`flex items-center gap-1 text-lg font-bold ${
            data.pnl > 0 ? 'text-success' : 'text-destructive'
          }`}>
            {data.pnl > 0 ? 
              <TrendingUp className="h-4 w-4" /> : 
              <TrendingDown className="h-4 w-4" />
            }
            {data.pnl > 0 ? '+' : ''}${data.pnl.toLocaleString()}
          </div>
        </div>

        {/* Active Positions */}
        <div className="space-y-3">
          <h4 className="font-medium">Active Positions</h4>
          <div className="space-y-2">
            {data.positions.map((position, index) => (
              <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-1">
                  <div className="font-medium">{position.symbol}</div>
                  <div className="text-sm text-muted-foreground">
                    Size: {position.size} | Value: ${position.value.toLocaleString()}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className={`font-medium ${
                    position.pnl > 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    {position.pnl > 0 ? '+' : ''}${position.pnl.toLocaleString()}
                  </div>
                  <div className={`text-sm flex items-center gap-1 ${
                    position.pnl > 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    {position.pnl > 0 ? 
                      <TrendingUp className="h-3 w-3" /> : 
                      <TrendingDown className="h-3 w-3" />
                    }
                    {position.pnl > 0 ? '+' : ''}{position.pnlPercentage}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};