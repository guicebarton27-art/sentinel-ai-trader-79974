import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Search, Star, RefreshCw, AlertCircle } from 'lucide-react';
import { useMultipleTickers } from '@/hooks/useMarketData';
import { SUPPORTED_SYMBOLS } from '@/services/marketDataService';

export const MarketData = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [watchlist, setWatchlist] = useState<string[]>(['BTC/USD', 'ETH/USD']);

  const { tickers, loading, error, refetch } = useMultipleTickers([...SUPPORTED_SYMBOLS]);

  const filteredData = tickers.filter(item => 
    item.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  if (loading && tickers.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Market Data</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full mb-4" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && tickers.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Market Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground text-center">
                Failed to load market data
                <br />
                <span className="text-sm">{error}</span>
              </p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Market Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Market Data</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Live from Kraken
              </Badge>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => refetch()}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search markets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              Watchlist ({watchlist.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Market Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium">Market</th>
                  <th className="text-right p-4 font-medium">Price</th>
                  <th className="text-right p-4 font-medium">24h Change</th>
                  <th className="text-right p-4 font-medium">Volume</th>
                  <th className="text-right p-4 font-medium">24h High/Low</th>
                  <th className="text-center p-4 font-medium">Watch</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((market, index) => {
                  const isPositive = market.change24h >= 0;
                  return (
                    <tr key={index} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <div className="font-medium">{market.symbol}</div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="font-mono">
                          ${market.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="space-y-1">
                          <Badge 
                            variant={isPositive ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            <div className="flex items-center gap-1">
                              {isPositive ? 
                                <TrendingUp className="h-3 w-3" /> : 
                                <TrendingDown className="h-3 w-3" />
                              }
                              {isPositive ? '+' : ''}{market.change24h.toFixed(2)}%
                            </div>
                          </Badge>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="font-mono text-muted-foreground">
                          ${(market.volume24h / 1000000).toFixed(1)}M
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="space-y-1 text-sm font-mono">
                          <div className="text-success">
                            ${market.high24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-destructive">
                            ${market.low24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleWatchlist(market.symbol)}
                          className="h-8 w-8 p-0"
                        >
                          <Star 
                            className={`h-4 w-4 ${
                              watchlist.includes(market.symbol) 
                                ? 'fill-yellow-400 text-yellow-400' 
                                : 'text-muted-foreground'
                            }`} 
                          />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No markets found matching "{searchTerm}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
