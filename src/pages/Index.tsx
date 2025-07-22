import { useSeoMeta } from '@unhead/react';
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { LoginArea } from "@/components/auth/LoginArea";
import { DiscordLayout } from "@/components/layout/DiscordLayout";

const Index = () => {
  const { user } = useCurrentUser();

  useSeoMeta({
    title: 'NostrCord - Discord on Nostr',
    description: 'A Discord-like chat platform built on the decentralized Nostr protocol.',
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto text-center space-y-8 p-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Welcome to NostrCord
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              A Discord-like chat platform built on the decentralized Nostr protocol
            </p>
          </div>

          <div className="flex justify-center">
            <LoginArea className="max-w-60" />
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            <p>
              Vibed with{" "}
              <a
                href="https://soapbox.pub/mkstack"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                MKStack
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <DiscordLayout />;
};

export default Index;
