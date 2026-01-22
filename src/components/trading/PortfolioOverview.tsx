import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Wallet, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBotController } from '@/hooks/useBotController';

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
  data?: PortfolioData; // Optional prop for backwards compatibility
}

export const PortfolioOverview = ({ data: propData }: PortfolioOverviewProps) => {
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(!propData);
  const { activeBot, positions } = useBotController();

  useEffect(() => {
    // If prop data is provided, use it
    if (propData) {
      setPortfolioData(propData);
      setLoading(false);
      return;
    }

    // Otherwise, calculate from real data
    const calculatePortfolio = async () => {
      try {
        // Get open positions from hook
        const openPositions = positions.filter(p => p.status === 'open');
        
        // Calculate position values
        const positionData: Position[] = openPositions.map(p => {
          const currentPrice = p.current_price || p.entry_price;
          const value = p.quantity * currentPrice;
          const pnl = p.unrealized_pnl || 0;
          const pnlPercentage = p.entry_price > 0 
            ? ((currentPrice - p.entry_price) / p.entry_price * 100) 
            : 0;
          
          return {
            symbol: p.symbol,
            size: p.quantity,
            value,
            pnl,
            pnlPercentage
          };
        });

        // Calculate total position value
        const totalPositionValue = positionData.reduce((sum, p) => sum + p.value, 0);
        const totalPnl = positionData.reduce((sum, p) => sum + p.pnl, 0);

        // Get bot capital if available
        const botCapital = activeBot?.current_capital || 10000;
        const startingCapital = activeBot?.starting_capital || 10000;
        
        setPortfolioData({
          totalValue: botCapital,
          pnl: activeBot?.daily_pnl || totalPnl,
          pnlPercentage: startingCapital > 0 
            ? ((botCapital - startingCapital) / startingCapital * 100) 
            : 0,
          availableBalance: botCapital - totalPositionValue,
          positions: positionData
        });
      } catch (error) {
        console.error('Error calculating portfolio:', error);
      } finally {
        setLoading(false);
      }
    };

    calculatePortfolio();
  }, [propData, activeBot, positions]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Portfolio Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const data = portfolioData || {
    totalValue: 0,
    pnl: 0,
    pnlPercentage: 0,
    availableBalance: 0,
    positions: []
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Portfolio Overview
          </CardTitle>
          <Badge variant="outline" className="gap-1">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Balance Summary */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 p-3 rounded-lg bg-secondary/30">
            <p className="text-sm text-muted-foreground">Total Portfolio</p>
            <p className="text-2xl font-bold">${data.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="space-y-2 p-3 rounded-lg bg-secondary/30">
            <p className="text-sm text-muted-foreground">Available Balance</p>
            <p className="text-2xl font-bold">${data.availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* P&L Summary */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total P&L</span>
            <Badge variant={data.pnl > 0 ? 'default' : 'destructive'}>
              {data.pnl > 0 ? '+' : ''}{data.pnlPercentage.toFixed(2)}%
            </Badge>
          </div>
          <div className={`flex items-center gap-1 text-lg font-bold ${
            data.pnl > 0 ? 'text-success' : 'text-destructive'
          }`}>
            {data.pnl > 0 ? 
              <TrendingUp className="h-4 w-4" /> : 
              <TrendingDown className="h-4 w-4" />
            }
            {data.pnl > 0 ? '+' : ''}${data.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Active Positions */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            Active Positions
            <Badge variant="outline" className="text-xs">{data.positions.length}</Badge>
          </h4>
          {data.positions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No open positions</p>
          ) : (
            <div className="space-y-2">
              {data.positions.map((position, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border p-3 hover:bg-secondary/20 transition-colors">
                  <div className="space-y-1">
                    <div className="font-medium">{position.symbol}</div>
                    <div className="text-sm text-muted-foreground">
                      Size: {position.size.toFixed(6)} | Value: ${position.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className={`font-medium ${
                      position.pnl > 0 ? 'text-success' : 'text-destructive'
                    }`}>
                      {position.pnl > 0 ? '+' : ''}${position.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={`text-sm flex items-center justify-end gap-1 ${
                      position.pnl > 0 ? 'text-success' : 'text-destructive'
                    }`}>
                      {position.pnl > 0 ? 
                        <TrendingUp className="h-3 w-3" /> : 
                        <TrendingDown className="h-3 w-3" />
                      }
                      {position.pnl > 0 ? '+' : ''}{position.pnlPercentage.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
