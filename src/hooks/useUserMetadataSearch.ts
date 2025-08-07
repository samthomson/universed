import { useState, useEffect } from 'react';
import { genUserName } from '@/lib/genUserName';
import type { NostrMetadata } from '@nostrify/nostrify';

export interface UserWithMetadata {
  pubkey: string;
  displayName: string;
  role?: 'owner' | 'moderator' | 'member';
  isOnline?: boolean;
  metadata?: NostrMetadata;
}

export function useUserMetadataSearch(users: UserWithMetadata[], query: string) {
  const [filteredUsers, setFilteredUsers] = useState<UserWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setFilteredUsers(users.slice(0, 10));
      return;
    }

    const searchUsers = async () => {
      setIsLoading(true);
      const queryLower = query.toLowerCase();

      // Filter users based on available display names and generated usernames
      const matchingUsers: UserWithMetadata[] = [];

      for (const user of users) {
        try {
          // Check all available name fields for matching
          const searchFields = [
            user.metadata?.display_name,
            user.metadata?.name,
            user.displayName,
            genUserName(user.pubkey)
          ].filter(Boolean); // Remove undefined/null values

          // Check if any field contains the query
          const hasMatch = searchFields.some(field =>
            field!.toLowerCase().includes(queryLower)
          );

          if (hasMatch) {
            matchingUsers.push(user);
          }
        } catch (error) {
          console.warn(`Error searching user ${user.pubkey}:`, error);
          // Fallback to basic filtering
          const searchText = (user.displayName || genUserName(user.pubkey)).toLowerCase();
          if (searchText.includes(queryLower)) {
            matchingUsers.push(user);
          }
        }
      }

      setFilteredUsers(matchingUsers.slice(0, 10)); // Limit to 10 results
      setIsLoading(false);
    };

    searchUsers();
  }, [users, query]);

  return {
    filteredUsers,
    isLoading
  };
}