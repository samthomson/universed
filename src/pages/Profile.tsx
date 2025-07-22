import { useSeoMeta } from '@unhead/react';
import { useParams } from 'react-router-dom';
import { UserProfile } from '@/components/profile/UserProfile';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LoginArea } from '@/components/auth/LoginArea';
import { nip19 } from 'nostr-tools';

const Profile = () => {
  const { npub } = useParams<{ npub: string }>();
  const { user } = useCurrentUser();

  let pubkey: string | null = null;
  let error: string | null = null;

  // Decode npub to get pubkey
  if (npub) {
    try {
      if (npub.startsWith('npub1')) {
        const decoded = nip19.decode(npub);
        if (decoded.type === 'npub') {
          pubkey = decoded.data;
        } else {
          error = 'Invalid npub format';
        }
      } else {
        error = 'Invalid npub format';
      }
    } catch {
      error = 'Invalid npub format';
    }
  } else {
    error = 'No npub provided';
  }

  useSeoMeta({
    title: pubkey ? `Profile - NostrCord` : 'Profile Not Found - NostrCord',
    description: 'View user profile on NostrCord.',
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto text-center space-y-8 p-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              View Profile
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Log in to view user profiles on NostrCord
            </p>
          </div>

          <div className="flex justify-center">
            <LoginArea className="max-w-60" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !pubkey) {
    return (
      <div className="min-h-screen bg-gray-800 text-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h1 className="text-2xl font-bold text-white">Profile Not Found</h1>
            <p className="text-gray-400">{error || 'Invalid profile URL'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-800 text-gray-100">
      <div className="container mx-auto px-4 py-8">
        <UserProfile pubkey={pubkey} />
      </div>
    </div>
  );
};

export default Profile;