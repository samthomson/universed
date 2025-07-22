import { useSeoMeta } from '@unhead/react';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LoginArea } from '@/components/auth/LoginArea';

const Search = () => {
  const { user } = useCurrentUser();

  useSeoMeta({
    title: 'Search - NostrCord',
    description: 'Search across messages, users, and communities on NostrCord.',
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto text-center space-y-8 p-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Search NostrCord
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Log in to search across messages, users, and communities
            </p>
          </div>

          <div className="flex justify-center">
            <LoginArea className="max-w-60" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-800 text-gray-100">
      <div className="container mx-auto px-4 py-8">
        <GlobalSearch 
          onUserSelect={(pubkey) => {
            // TODO: Navigate to user profile or start DM
            console.log('Selected user:', pubkey);
          }}
          onCommunitySelect={(communityId) => {
            // TODO: Navigate to community
            console.log('Selected community:', communityId);
          }}
          onMessageSelect={(message) => {
            // TODO: Navigate to message thread
            console.log('Selected message:', message);
          }}
        />
      </div>
    </div>
  );
};

export default Search;