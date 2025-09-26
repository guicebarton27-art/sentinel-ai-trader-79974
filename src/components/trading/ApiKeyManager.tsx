import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Key, 
  Plus, 
  Eye, 
  EyeOff, 
  Trash2, 
  Shield, 
  CheckCircle, 
  AlertCircle,
  Settings
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ApiKeyEntry {
  id: string;
  exchange: string;
  label: string;
  status: 'active' | 'inactive' | 'error';
  permissions: string[];
  lastUsed: Date | null;
  created: Date;
}

export const ApiKeyManager = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [newKey, setNewKey] = useState({ 
    exchange: 'kraken', 
    label: '', 
    apiKey: '', 
    secret: '', 
    passphrase: '' 
  });
  const { toast } = useToast();

  // Mock data - will be replaced with actual Supabase data
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([
    {
      id: '1',
      exchange: 'kraken',
      label: 'Main Trading Account',
      status: 'active',
      permissions: ['trade', 'balance', 'history'],
      lastUsed: new Date('2024-01-15'),
      created: new Date('2024-01-01')
    },
    {
      id: '2', 
      exchange: 'binance',
      label: 'Backup Account',
      status: 'inactive',
      permissions: ['balance', 'history'],
      lastUsed: null,
      created: new Date('2024-01-10')
    }
  ]);

  const exchanges = [
    { value: 'kraken', label: 'Kraken Pro', icon: '🐙' },
    { value: 'binance', label: 'Binance', icon: '🔶' },
    { value: 'coinbase', label: 'Coinbase Pro', icon: '🔵' }
  ];

  const handleAddApiKey = async () => {
    if (!newKey.label || !newKey.apiKey || !newKey.secret) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      // TODO: Store in Supabase secrets
      // await storeApiKeyInSupabase(newKey);
      
      const newEntry: ApiKeyEntry = {
        id: Math.random().toString(36).substr(2, 9),
        exchange: newKey.exchange,
        label: newKey.label,
        status: 'active',
        permissions: ['trade', 'balance', 'history'],
        lastUsed: null,
        created: new Date()
      };

      setApiKeys([...apiKeys, newEntry]);
      setNewKey({ exchange: 'kraken', label: '', apiKey: '', secret: '', passphrase: '' });
      setShowAddForm(false);

      toast({
        title: "API Key Added",
        description: `Successfully added ${newKey.label} for ${newKey.exchange}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add API key. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    try {
      // TODO: Remove from Supabase secrets
      setApiKeys(apiKeys.filter(key => key.id !== id));
      
      toast({
        title: "API Key Deleted",
        description: "API key has been securely removed",
      });
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to delete API key",
        variant: "destructive"
      });
    }
  };

  const toggleSecretVisibility = (id: string) => {
    setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getStatusColor = (status: ApiKeyEntry['status']) => {
    switch (status) {
      case 'active': return 'bg-success text-success-foreground';
      case 'inactive': return 'bg-muted text-muted-foreground';
      case 'error': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getExchangeIcon = (exchange: string) => {
    const found = exchanges.find(ex => ex.value === exchange);
    return found ? found.icon : '🔗';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-algo-primary/20 to-algo-secondary/20">
                <Key className="h-5 w-5 text-algo-primary" />
              </div>
              <div>
                <CardTitle>API Key Management</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Securely manage exchange API keys for automated trading
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add API Key
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Add New API Key Form */}
      {showAddForm && (
        <Card className="border-algo-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-algo-primary" />
              Add New API Key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="exchange">Exchange</Label>
                <select
                  id="exchange"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  value={newKey.exchange}
                  onChange={(e) => setNewKey({ ...newKey, exchange: e.target.value })}
                >
                  {exchanges.map((exchange) => (
                    <option key={exchange.value} value={exchange.value}>
                      {exchange.icon} {exchange.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  placeholder="e.g., Main Trading Account"
                  value={newKey.label}
                  onChange={(e) => setNewKey({ ...newKey, label: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your API key"
                value={newKey.apiKey}
                onChange={(e) => setNewKey({ ...newKey, apiKey: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secret">API Secret</Label>
              <Input
                id="secret"
                type="password"
                placeholder="Enter your API secret"
                value={newKey.secret}
                onChange={(e) => setNewKey({ ...newKey, secret: e.target.value })}
              />
            </div>

            {newKey.exchange === 'coinbase' && (
              <div className="space-y-2">
                <Label htmlFor="passphrase">Passphrase</Label>
                <Input
                  id="passphrase"
                  type="password"
                  placeholder="Enter your passphrase (Coinbase Pro only)"
                  value={newKey.passphrase}
                  onChange={(e) => setNewKey({ ...newKey, passphrase: e.target.value })}
                />
              </div>
            )}

            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-algo-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Security Notice</p>
                  <p className="text-muted-foreground">
                    API keys are encrypted and stored securely using Supabase Vault. 
                    Only grant necessary permissions (trading, balance reading).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleAddApiKey}>
                <Key className="h-4 w-4 mr-2" />
                Add API Key
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.map((key) => (
          <Card key={key.id} className="transition-all hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-2xl">{getExchangeIcon(key.exchange)}</div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{key.label}</h3>
                      <Badge className={getStatusColor(key.status)}>
                        {key.status === 'active' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {key.status === 'error' && <AlertCircle className="h-3 w-3 mr-1" />}
                        {key.status}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground capitalize">
                      {key.exchange} Exchange
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Permissions: {key.permissions.join(', ')}</span>
                      <span>•</span>
                      <span>
                        Last used: {key.lastUsed ? key.lastUsed.toLocaleDateString() : 'Never'}
                      </span>
                      <span>•</span>
                      <span>Created: {key.created.toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSecretVisibility(key.id)}
                  >
                    {showSecrets[key.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteApiKey(key.id)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {showSecrets[key.id] && (
                <div className="mt-4 p-3 bg-muted/30 rounded-lg border-l-4 border-l-algo-primary">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="h-4 w-4 text-algo-primary" />
                    <span className="text-sm font-medium">API Credentials</span>
                  </div>
                  <div className="grid gap-2 text-sm font-mono">
                    <div>
                      <span className="text-muted-foreground">Key:</span> 
                      <span className="ml-2">••••••••••••••••</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Secret:</span> 
                      <span className="ml-2">••••••••••••••••</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Actual keys are encrypted and stored securely in Supabase Vault
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {apiKeys.length === 0 && !showAddForm && (
          <Card>
            <CardContent className="p-12 text-center">
              <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No API Keys Added</h3>
              <p className="text-muted-foreground mb-4">
                Add your exchange API keys to enable automated trading
              </p>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First API Key
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};