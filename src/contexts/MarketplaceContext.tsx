import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MarketplaceContextType {
  highlightedItemId: string | null;
  setHighlightedItemId: (itemId: string | null) => void;
  clearHighlight: () => void;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(undefined);

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  const clearHighlight = () => {
    setHighlightedItemId(null);
  };

  return (
    <MarketplaceContext.Provider value={{
      highlightedItemId,
      setHighlightedItemId,
      clearHighlight,
    }}>
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplaceContext() {
  const context = useContext(MarketplaceContext);
  if (context === undefined) {
    throw new Error('useMarketplaceContext must be used within a MarketplaceProvider');
  }
  return context;
}