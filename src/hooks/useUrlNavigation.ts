import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';

export interface UrlNavigationState {
  communityId: string | null;
  isJoinRequest: boolean;
  naddr: string | null;
}

/**
 * Hook to handle URL-based navigation for communities and join requests
 */
export function useUrlNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [navigationState, setNavigationState] = useState<UrlNavigationState>({
    communityId: null,
    isJoinRequest: false,
    naddr: null,
  });

  useEffect(() => {
    const path = location.pathname;

    // Handle join requests: /join/{naddr}
    if (path.startsWith('/join/')) {
      const naddr = path.substring(6); // Remove '/join/'
      try {
        const decoded = nip19.decode(naddr);
        if (decoded.type === 'naddr' && decoded.data.kind === 34550) {
          const { kind, pubkey, identifier } = decoded.data;
          const communityId = `${kind}:${pubkey}:${identifier}`;
          setNavigationState({
            communityId,
            isJoinRequest: true,
            naddr,
          });
          return;
        }
      } catch {
        // Invalid naddr, will be handled by 404
      }
    }

    // Handle direct community links: /{naddr}
    if (path.length > 1 && !path.startsWith('/join/') && !path.startsWith('/communities') && !path.startsWith('/profile/') && !path.startsWith('/search') && !path.startsWith('/emoji-demo')) {
      const naddr = path.substring(1); // Remove leading '/'
      try {
        const decoded = nip19.decode(naddr);
        if (decoded.type === 'naddr' && decoded.data.kind === 34550) {
          const { kind, pubkey, identifier } = decoded.data;
          const communityId = `${kind}:${pubkey}:${identifier}`;
          setNavigationState({
            communityId,
            isJoinRequest: false,
            naddr,
          });
          return;
        }
      } catch {
        // Invalid naddr, will be handled by 404
      }
    }

    // Reset state for other routes
    if (path === '/' || path === '/communities' || path.startsWith('/profile/')) {
      setNavigationState({
        communityId: null,
        isJoinRequest: false,
        naddr: null,
      });
    }
  }, [location.pathname]);

  const clearNavigation = () => {
    setNavigationState({
      communityId: null,
      isJoinRequest: false,
      naddr: null,
    });
    navigate('/', { replace: true });
  };

  const navigateToCommunity = (_communityId: string) => {
    // For now, just clear the URL and let the app handle community selection internally
    navigate('/', { replace: true });
  };

  return {
    ...navigationState,
    clearNavigation,
    navigateToCommunity,
  };
}