import React, { useRef } from 'react';
import { NostrEvent, NPool, NRelay1 } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import { useAppContext } from '@/hooks/useAppContext';

interface NostrProviderProps {
  children: React.ReactNode;
}

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children } = props;
  const { config, presetRelays } = useAppContext();

  // Create NPool instance only once
  const pool = useRef<NPool | undefined>(undefined);

  // Use ref so the pool always has the latest relay URL
  // Note: Relay change side effects (cache clearing) are handled by RelayChangeHandler component
  const relayUrl = useRef<string>(config.relayUrl);
  relayUrl.current = config.relayUrl;

  // Initialize NPool only once
  if (!pool.current) {
    pool.current = new NPool({
      open(url: string) {
        return new NRelay1(url);
      },
      reqRouter(filters) {
        // Read from the selected relay and all preset relays
        const readRelays = new Set<string>([relayUrl.current]);

        // Add preset relays for reading
        for (const { url } of (presetRelays ?? [])) {
          readRelays.add(url);
        }

        // Create a map with all relays using the same filters
        const relayMap = new Map<string, typeof filters>();
        for (const url of readRelays) {
          relayMap.set(url, filters);
        }

        return relayMap;
      },
      eventRouter(_event: NostrEvent) {
        // Publish to the selected relay
        const allRelays = new Set<string>([relayUrl.current]);

        // Also publish to the preset relays, capped to 5
        for (const { url } of (presetRelays ?? [])) {
          allRelays.add(url);

          if (allRelays.size >= 5) {
            break;
          }
        }

        return [...allRelays];
      },
    });
  }

  return (
    <NostrContext.Provider value={{ nostr: pool.current }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;