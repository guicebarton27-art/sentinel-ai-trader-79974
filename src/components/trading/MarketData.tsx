import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TrendingUp, TrendingDown, Search, Star } from 'lucide-react';

const mockMarketData = [
  { 
    symbol: 'BTC/USD', 
    price: 64309.25, 
    change: 1234.56, 
    changePercent: 1.96, 
    volume: 2847329847, 
    high24h: 65100.00, 
    low24h: 62800.50 
  },
  { 
    symbol: 'ETH/USD', 
    price: 2498.75, 
    change: -45.23, 
    changePercent: -1.78, 
    volume: 1293847563, 
    high24h: 2550.00, 
    low24h: 2420.10 
  },
  { 
    symbol: 'XRP/USD', 
    price: 0.6204, 
    change: 0.0234, 
    changePercent: 3.91, 
    volume: 894736251, 
    high24h: 0.6350, 
    low24h: 0.5980 
  },
  { 
    symbol: 'ADA/USD', 
    price: 0.4567, 
    change: -0.0123, 
    changePercent: -2.62, 
    volume: 534829174, 
    high24h: 0.4720, 
    low24h: 0.4450 
  },
  { 
    symbol: 'SOL/USD', 
    price: 148.32, 
    change: 5.67, 
    changePercent: 3.98, 
    volume: 743291847, 
    high24h: 152.50, 
    low24h: 141.20 
  }
];

export const MarketData = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [watchlist, setWatchlist] = useState<string[]>(['BTC/USD', 'ETH/USD']);

  const filteredData = mockMarketData.filter(item => 
    item.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  return (
    <div className="space-y-6">
      {/* Market Search */}
      <Card>
        <CardHeader>
          <CardTitle>Market Data</CardTitle>
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
                {filteredData.map((market, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-4">
                      <div className="font-medium">{market.symbol}</div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="font-mono">${market.price.toLocaleString()}</div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="space-y-1">
                        <div className={`font-mono ${
                          market.change > 0 ? 'text-success' : 'text-destructive'
                        }`}>
                          {market.change > 0 ? '+' : ''}${market.change.toFixed(2)}
                        </div>
                        <Badge 
                          variant={market.change > 0 ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          <div className="flex items-center gap-1">
                            {market.change > 0 ? 
                              <TrendingUp className="h-3 w-3" /> : 
                              <TrendingDown className="h-3 w-3" />
                            }
                            {market.change > 0 ? '+' : ''}{market.changePercent}%
                          </div>
                        </Badge>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="font-mono text-muted-foreground">
                        ${(market.volume / 1000000).toFixed(1)}M
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="space-y-1 text-sm">
                        <div className="text-success">${market.high24h.toFixed(2)}</div>
                        <div className="text-destructive">${market.low24h.toFixed(2)}</div>
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
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};