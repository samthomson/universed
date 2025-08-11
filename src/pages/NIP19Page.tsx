import { nip19 } from 'nostr-tools';
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import NotFound from './NotFound';
import { naddrToCommunityId } from '@/lib/utils';

export function NIP19Page() {
  const { nip19: identifier } = useParams<{ nip19: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!identifier) {
      return;
    }

    let decoded;
    try {
      decoded = nip19.decode(identifier);
    } catch {
      navigate('/', { replace: true });
      return;
    }

    const { type, data } = decoded;

    // Handle different NIP-19 identifier types
    switch (type) {
      case 'npub':
      case 'nprofile':
        // Navigate to profile page
        navigate(`/profile/${identifier}`, { replace: true });
        break;

      case 'note':
        // Navigate to note view (would need to be implemented)
        navigate(`/?note=${identifier}`, { replace: true });
        break;

      case 'nevent':
        // Navigate to event view (would need to be implemented)
        navigate(`/?event=${identifier}`, { replace: true });
        break;

      case 'naddr':
        // Check if this is a community (kind 34550)
        if (data.kind === 34550) {
          // Convert naddr to community ID format and navigate to space route
          try {
            naddrToCommunityId(identifier); // Validate the naddr
            navigate(`/space/${identifier}`, { replace: true });
          } catch (error) {
            console.error('Failed to decode naddr:', error);
            navigate('/', { replace: true });
          }
        } else {
          // Handle other addressable event types
          navigate(`/?addr=${identifier}`, { replace: true });
        }
        break;

      default:
        navigate('/', { replace: true });
        break;
    }
  }, [identifier, navigate]);

  if (!identifier) {
    return <NotFound />;
  }

  return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
}