import { useCallback } from 'react';
import { useNWC } from '@/contexts/NWCContext';

export interface NWCConnection {
  id: string;
  name: string;
  connectionString: string;
  isConnected: boolean;
  walletInfo?: {
    name: string;
    icon: string;
    color: string;
    network: string;
    methods: string[];
  };
}

export function useNWCInternal() {
  const {
    connections,
    addConnection,
    removeConnection,
    updateConnection,
    getActiveConnection,
    sendPayment,
    isLoading
  } = useNWC();

  const connect = useCallback(async (connectionString: string, name?: string) => {
    try {
      // Test the connection by trying to get info
      const { NWCClient } = await import('@getalby/sdk');
      const nwc = new NWCClient({
        nostrWalletConnectUrl: connectionString,
      });

      const info = await nwc.getWalletServiceInfo();

      const infoRecord = info as Record<string, unknown>;
      const newConnection: Omit<NWCConnection, 'id'> = {
        name: name || (infoRecord.name as string) || 'NWC Wallet',
        connectionString,
        isConnected: true,
        walletInfo: {
          name: (infoRecord.name as string) || 'Unknown Wallet',
          icon: (infoRecord.icon as string) || '',
          color: (infoRecord.color as string) || '',
          network: (infoRecord.network as string) || 'bitcoin',
          methods: (infoRecord.methods as string[]) || [],
        },
      };

      addConnection(newConnection);
      return true;
    } catch (error) {
      console.error('Failed to connect NWC:', error);
      return false;
    }
  }, [addConnection]);

  const disconnect = useCallback((id: string) => {
    updateConnection(id, { isConnected: false });
  }, [updateConnection]);

  const reconnect = useCallback(async (id: string) => {
    const connection = connections.find(conn => conn.id === id);
    if (!connection) return false;

    try {
      const { NWCClient } = await import('@getalby/sdk');
      const nwc = new NWCClient({
        nostrWalletConnectUrl: connection.connectionString,
      });

      await nwc.getWalletServiceInfo();
      updateConnection(id, { isConnected: true });
      return true;
    } catch (error) {
      console.error('Failed to reconnect NWC:', error);
      return false;
    }
  }, [connections, updateConnection]);

  return {
    connections,
    connect,
    disconnect,
    reconnect,
    removeConnection,
    updateConnection,
    getActiveConnection,
    sendPayment,
    isLoading,
  };
}