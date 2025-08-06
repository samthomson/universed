import React, { createContext, useContext, useState, useEffect } from 'react';
import { NWCClient } from '@getalby/sdk';

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

interface NWCContextType {
  connections: NWCConnection[];
  addConnection: (connection: Omit<NWCConnection, 'id'>) => void;
  removeConnection: (id: string) => void;
  updateConnection: (id: string, updates: Partial<NWCConnection>) => void;
  getActiveConnection: () => NWCConnection | null;
  sendPayment: (connection: NWCConnection, invoice: string) => Promise<void>;
  isLoading: boolean;
}

const NWCContext = createContext<NWCContextType | null>(null);

export { NWCContext };

export function NWCProvider({ children }: { children: React.ReactNode }) {
  const [connections, setConnections] = useState<NWCConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load connections from localStorage on mount
  useEffect(() => {
    const savedConnections = localStorage.getItem('nwc-connections');
    if (savedConnections) {
      try {
        const parsed = JSON.parse(savedConnections);
        setConnections(parsed);
      } catch (error) {
        console.error('Failed to parse NWC connections:', error);
      }
    }
  }, []);

  // Save connections to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('nwc-connections', JSON.stringify(connections));
  }, [connections]);

  const addConnection = (connection: Omit<NWCConnection, 'id'>) => {
    const newConnection: NWCConnection = {
      ...connection,
      id: Date.now().toString(),
    };
    setConnections(prev => [...prev, newConnection]);
  };

  const removeConnection = (id: string) => {
    setConnections(prev => prev.filter(conn => conn.id !== id));
  };

  const updateConnection = (id: string, updates: Partial<NWCConnection>) => {
    setConnections(prev =>
      prev.map(conn =>
        conn.id === id ? { ...conn, ...updates } : conn
      )
    );
  };

  const getActiveConnection = (): NWCConnection | null => {
    return connections.find(conn => conn.isConnected) || null;
  };

  const sendPayment = async (connection: NWCConnection, invoice: string): Promise<void> => {
    if (!connection.connectionString) {
      throw new Error('No connection string available');
    }

    setIsLoading(true);
    try {
      const nwc = new NWCClient({
        nostrWalletConnectUrl: connection.connectionString,
      });

      const result = await nwc.payInvoice({ invoice });

      if (result && result.preimage) {
        // Payment successful
        return;
      } else {
        throw new Error('Payment failed');
      }
    } catch (error) {
      console.error('NWC payment error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value: NWCContextType = {
    connections,
    addConnection,
    removeConnection,
    updateConnection,
    getActiveConnection,
    sendPayment,
    isLoading,
  };

  return (
    <NWCContext.Provider value={value}>
      {children}
    </NWCContext.Provider>
  );
}

export function useNWC(): NWCContextType {
  const context = useContext(NWCContext);
  if (!context) {
    throw new Error('useNWC must be used within a NWCProvider');
  }
  return context;
}