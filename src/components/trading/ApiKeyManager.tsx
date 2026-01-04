import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Key, 
  Plus, 
  Trash2, 
  Shield, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ApiKeyEntry {
  id: string;
  exchange: string;
  key_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const ApiKeyManager = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState({ 
    exchange: 'kraken', 
    label: '', 
    apiKey: '', 
    secret: ''
  });
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const { toast } = useToast();

  const exchanges = [
    { value: 'kraken', label: 'Kraken Pro', icon: '🐙' },
    { value: 'binance', label: 'Binance', icon: '🔶' },
    { value: 'coinbase', label: 'Coinbase Pro', icon: '🔵' }
  ];

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        body: { action: 'list' }
      });

      if (error) throw error;
      if (data?.keys) {
        setApiKeys(data.keys);
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast({
        title: "Error",
        description: "Failed to load API keys",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const handleAddApiKey = async () => {
    if (!newKey.label || !newKey.apiKey || !newKey.secret) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Basic validation
    if (newKey.label.length > 100) {
      toast({
        title: "Invalid Input",
        description: "Label must be less than 100 characters",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        body: {
          action: 'add',
          exchange: newKey.exchange,
          key_name: newKey.label,
          api_key: newKey.apiKey,
          api_secret: newKey.secret
        }
      });

      if (error) throw error;
      
      if (data?.key) {
        setApiKeys([data.key, ...apiKeys]);
        setNewKey({ exchange: 'kraken', label: '', apiKey: '', secret: '' });
        setShowAddForm(false);

        toast({
          title: "API Key Added",
          description: `Successfully added ${newKey.label} for ${newKey.exchange}. Key is encrypted and stored securely.`,
        });
      }
    } catch (error) {
      console.error('Error adding API key:', error);
      toast({
        title: "Error",
        description: "Failed to add API key. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteApiKey = async (id: string, keyName: string) => {
    try {
      const { error } = await supabase.functions.invoke('manage-api-keys', {
        body: { action: 'delete', key_id: id }
      });

      if (error) throw error;
      
      setApiKeys(apiKeys.filter(key => key.id !== id));
      
      toast({
        title: "API Key Deleted",
        description: `${keyName} has been securely removed`,
      });
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast({
        title: "Error", 
        description: "Failed to delete API key",
        variant: "destructive"
      });
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        body: { action: 'toggle', key_id: id, is_active: !currentStatus }
      });

      if (error) throw error;
      
      setApiKeys(apiKeys.map(key => 
        key.id === id ? { ...key, is_active: !currentStatus } : key
      ));
      
      toast({
        title: "Status Updated",
        description: `API key is now ${!currentStatus ? 'active' : 'inactive'}`,
      });
    } catch (error) {
      console.error('Error toggling API key:', error);
      toast({
        title: "Error", 
        description: "Failed to update API key status",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-success text-success-foreground' 
      : 'bg-muted text-muted-foreground';
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
                  Securely manage exchange API keys with AES-256 encryption
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                size="sm"
                onClick={fetchApiKeys}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add API Key
              </Button>
            </div>
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
                  maxLength={100}
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
                autoComplete="off"
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
                autoComplete="off"
              />
            </div>

            <div className="bg-success/10 border border-success/20 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-success mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-success">Secure Storage</p>
                  <p className="text-muted-foreground">
                    API keys are encrypted using AES-256-GCM before storage. 
                    Keys are never stored in plain text or browser memory.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowAddForm(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleAddApiKey} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Key className="h-4 w-4 mr-2" />
                )}
                {saving ? 'Encrypting...' : 'Add API Key'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Loading API keys...</p>
          </CardContent>
        </Card>
      )}

      {/* API Keys List */}
      {!loading && (
        <div className="space-y-4">
          {apiKeys.map((key) => (
            <Card key={key.id} className="transition-all hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">{getExchangeIcon(key.exchange)}</div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{key.key_name}</h3>
                        <Badge className={getStatusColor(key.is_active)}>
                          {key.is_active ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <AlertCircle className="h-3 w-3 mr-1" />
                          )}
                          {key.is_active ? 'active' : 'inactive'}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground capitalize">
                        {key.exchange} Exchange
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          AES-256 Encrypted
                        </span>
                        <span>•</span>
                        <span>Created: {new Date(key.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(key.id, key.is_active)}
                    >
                      {key.is_active ? 'Disable' : 'Enable'}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteApiKey(key.id, key.key_name)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
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
      )}
    </div>
  );
};
