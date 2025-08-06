import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';

export interface DMUrlState {
  targetPubkey: string | null;
  isDMRoute: boolean;
}

/**
 * Hook to handle URL-based navigation for direct messages
 */
export function useDMUrlNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [dmState, setDMState] = useState<DMUrlState>({
    targetPubkey: null,
    isDMRoute: false,
  });

  useEffect(() => {
    const path = location.pathname;

    // Handle DM routes: /dm or /dm/:npub
    if (path.startsWith('/dm')) {
      if (path === '/dm') {
        // Just /dm - open DM section without specific target
        setDMState({
          targetPubkey: null,
          isDMRoute: true,
        });
      } else {
        // /dm/:npub - extract the npub
        const npub = path.substring(4); // Remove '/dm/'
        try {
          const decoded = nip19.decode(npub);
          if (decoded.type === 'npub') {
            setDMState({
              targetPubkey: decoded.data,
              isDMRoute: true,
            });
          } else {
            // Invalid npub, redirect to /dm
            navigate('/dm', { replace: true });
          }
        } catch {
          // Invalid npub, redirect to /dm
          navigate('/dm', { replace: true });
        }
      }
    } else {
      // Reset state for non-DM routes
      setDMState({
        targetPubkey: null,
        isDMRoute: false,
      });
    }
  }, [location.pathname, navigate]);

  const navigateToDM = (pubkey?: string) => {
    if (pubkey) {
      navigate(`/dm/${pubkey}`, { replace: true });
    } else {
      navigate('/dm', { replace: true });
    }
  };

  return {
    ...dmState,
    navigateToDM,
  };
}
