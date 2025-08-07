import { useState } from 'react';
import { Wallet, Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useNWC } from '@/hooks/useNWCContext';
import type { NWCConnection } from '@/contexts/NWCContext';

interface WalletConfigDialogProps {
  trigger?: React.ReactNode;
}

export function WalletConfigDialog({ trigger }: WalletConfigDialogProps) {
  const { connections, addConnection, removeConnection, updateConnection, getActiveConnection } = useNWC();
  const [isOpen, setIsOpen] = useState(false);
  const [newConnectionString, setNewConnectionString] = useState('');
  const [newConnectionName, setNewConnectionName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeConnection = getActiveConnection();

  const handleAddConnection = async () => {
    if (!newConnectionString.trim() || !newConnectionName.trim()) {
      setError('Please provide both a name and connection string');
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      // Basic validation of NWC connection string format
      if (!newConnectionString.startsWith('nostr+walletconnect://')) {
        throw new Error('Invalid NWC connection string format');
      }

      const newConnection: Omit<NWCConnection, 'id'> = {
        name: newConnectionName.trim(),
        connectionString: newConnectionString.trim(),
        isConnected: false,
      };

      addConnection(newConnection);

      // Reset form
      setNewConnectionString('');
      setNewConnectionName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add connection');
    } finally {
      setIsAdding(false);
    }
  };

  const handleSetActive = (id: string) => {
    // Deactivate all connections first
    connections.forEach(conn => {
      updateConnection(conn.id, { isConnected: false });
    });

    // Activate the selected connection
    updateConnection(id, { isConnected: true });
  };

  const handleRemoveConnection = (id: string) => {
    removeConnection(id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="w-full">
            <Wallet className="mr-2 h-4 w-4" />
            Wallet Config
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Wallet Configuration</DialogTitle>
          <DialogDescription>
            Manage your Nostr Wallet Connect (NWC) connections for Lightning payments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add New Connection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add New Wallet</CardTitle>
              <CardDescription>
                Connect a new Lightning wallet using Nostr Wallet Connect
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wallet-name">Wallet Name</Label>
                <Input
                  id="wallet-name"
                  placeholder="My Lightning Wallet"
                  value={newConnectionName}
                  onChange={(e) => setNewConnectionName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="connection-string">NWC Connection String</Label>
                <Input
                  id="connection-string"
                  placeholder="nostr+walletconnect://..."
                  value={newConnectionString}
                  onChange={(e) => setNewConnectionString(e.target.value)}
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                onClick={handleAddConnection}
                disabled={isAdding || !newConnectionString.trim() || !newConnectionName.trim()}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                {isAdding ? 'Adding...' : 'Add Wallet'}
              </Button>
            </CardContent>
          </Card>

          {/* Existing Connections */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connected Wallets</CardTitle>
              <CardDescription>
                Manage your existing wallet connections
              </CardDescription>
            </CardHeader>
            <CardContent>
              {connections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wallet className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No wallets connected yet</p>
                  <p className="text-sm">Add your first wallet above</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {connections.map((connection) => (
                    <div
                      key={connection.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <Wallet className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{connection.name}</span>
                            {connection.id === activeConnection?.id && (
                              <Badge variant="default" className="text-xs">
                                Active
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {connection.connectionString.substring(0, 30)}...
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {connection.id !== activeConnection?.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetActive(connection.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveConnection(connection.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nostr Wallet Connect (NWC) allows you to make Lightning payments through your wallet without exposing your private keys.
              Get your connection string from your wallet's NWC settings.
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
}