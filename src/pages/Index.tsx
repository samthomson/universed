import { useSeoMeta } from '@unhead/react';
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { LoginArea } from "@/components/auth/LoginArea";
import { DiscordLayout } from "@/components/layout/DiscordLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Users, MessageCircle, Globe } from "lucide-react";
import { useEffect } from "react";
import { nip19 } from "nostr-tools";
import { communityIdToNaddr, naddrToCommunityId } from "@/lib/utils";

interface IndexProps {
  dmTargetPubkey?: string;
  spaceCommunityId?: string;
}

const Index = ({ dmTargetPubkey, spaceCommunityId }: IndexProps) => {
  const { user } = useCurrentUser();

  useSeoMeta({
    title: 'Universes - Discover Communities on Nostr',
    description: 'Explore infinite universes of communities, conversations, and connections on the decentralized Nostr protocol.',
  });

  // If dmTargetPubkey is provided, ensure user is logged in and handle URL updates
  useEffect(() => {
    if (dmTargetPubkey && user) {
      // Update URL to remove the npub parameter after handling
      // This prevents the parameter from persisting in the URL unnecessarily
      const url = new URL(window.location.href);
      url.pathname = '/dm';
      window.history.replaceState({}, '', url.toString());
    }
  }, [dmTargetPubkey, user]);

  // If spaceCommunityId is provided, ensure user is logged in and handle URL updates
  useEffect(() => {
    if (spaceCommunityId && user) {
      // Check if the communityId is already in naddr format
      if (spaceCommunityId.startsWith('naddr1')) {
        // Already in naddr format, check if URL needs to be updated
        const currentPath = window.location.pathname;
        const expectedPath = `/space/${spaceCommunityId}`;

        // Only update URL if it's not already correct (prevents unnecessary redirects)
        if (currentPath !== expectedPath) {
          const url = new URL(window.location.href);
          url.pathname = expectedPath;
          window.history.replaceState({}, '', url.toString());
        }
      } else {
        // Convert community ID to naddr format for the URL
        try {
          const naddr = communityIdToNaddr(spaceCommunityId);
          const url = new URL(window.location.href);
          url.pathname = `/space/${naddr}`;
          window.history.replaceState({}, '', url.toString());
        } catch {
          console.error('Failed to encode community ID as naddr');
          // Fallback to original format
          const url = new URL(window.location.href);
          url.pathname = `/space/${spaceCommunityId}`;
          window.history.replaceState({}, '', url.toString());
        }
      }
    }
  }, [spaceCommunityId, user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Animated background stars */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="stars"></div>
          <div className="stars2"></div>
          <div className="stars3"></div>
        </div>

        <div className="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8 md:space-y-12">
            {/* Hero Section */}
            <div className="space-y-3 sm:space-y-4 md:space-y-6">
              <div className="flex items-center justify-center space-x-2 mb-3 sm:mb-4">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-purple-400" />
                <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs sm:text-sm">
                  Powered by Nostr
                </Badge>
              </div>

              <h1 className="relative text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold z-50">
                <span className="relative z-50 inline-block" style={{ color: '#8B5CF6' }}>🌌</span>
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent ml-2">Welcome to Universes</span>
              </h1>

              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-slate-300 max-w-3xl mx-auto leading-relaxed px-2 sm:px-4">
                <span className="text-purple-400 font-semibold">Where your Space is truly yours.</span>
              </p>
              
              <p className="text-sm sm:text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed px-2 sm:px-4 mt-4">
                Why settle for a backyard when you can explore the galaxy? In Universes, you can build your own <span className="text-purple-300 font-medium">Spaces</span> — or discover ones that match your vibe. Every Space is decentralized, truly yours, and free from corporate overlords. Your Space, your rules.
              </p>
            </div>

            {/* Features Introduction */}
            <div className="space-y-4 px-2 sm:px-4">
              <p className="text-base sm:text-lg text-slate-200 max-w-3xl mx-auto leading-relaxed font-medium">
                Each Space has three powerful tools:
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 gap-4 sm:gap-6 max-w-4xl mx-auto px-2 sm:px-4">
              <Card className="bg-slate-800/80 border-slate-700/60 backdrop-blur-sm hover:bg-slate-800/90 transition-colors duration-300">
                <CardContent className="p-6 sm:p-8 text-center space-y-4 sm:space-y-5">
                  <div className="relative">
                    <MessageCircle className="h-12 w-12 sm:h-16 sm:w-16 text-blue-400 mx-auto drop-shadow-lg" />
                  </div>
                  <h3 className="font-semibold text-slate-200 text-lg sm:text-xl md:text-2xl">💬 Community</h3>
                  <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-md mx-auto">Connect with your people through text chats, voice channels, and live events. Build meaningful relationships, share ideas, and create the conversations that matter most to your community.</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/80 border-slate-700/60 backdrop-blur-sm hover:bg-slate-800/90 transition-colors duration-300">
                <CardContent className="p-6 sm:p-8 text-center space-y-4 sm:space-y-5">
                  <div className="relative">
                    <Users className="h-12 w-12 sm:h-16 sm:w-16 text-green-400 mx-auto drop-shadow-lg" />
                  </div>
                  <h3 className="font-semibold text-slate-200 text-lg sm:text-xl md:text-2xl">🛒 Marketplace</h3>
                  <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-md mx-auto">Turn your passion into profit with integrated commerce tools. Sell digital art, physical products, services, or exclusive content directly to your community members in a trusted, seamless environment.</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/80 border-slate-700/60 backdrop-blur-sm hover:bg-slate-800/90 transition-colors duration-300">
                <CardContent className="p-6 sm:p-8 text-center space-y-4 sm:space-y-5">
                  <div className="relative">
                    <Globe className="h-12 w-12 sm:h-16 sm:w-16 text-yellow-400 mx-auto drop-shadow-lg" />
                  </div>
                  <h3 className="font-semibold text-slate-200 text-lg sm:text-xl md:text-2xl">📂 Resources</h3>
                  <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-md mx-auto">A shared library for your community. Easily upload, organize, and access files, documents, and media in one place, so everyone stays connected and informed.</p>
                </CardContent>
              </Card>
            </div>

            {/* Call to Action */}
            <div className="space-y-4 px-2 sm:px-4">
              <p className="text-base sm:text-lg text-slate-200 max-w-3xl mx-auto leading-relaxed font-medium">
                No gatekeepers. No random shutdowns. Just your people, your rules, <span className="whitespace-nowrap">your Space.</span>
              </p>
            </div>

            {/* Login Section */}
            <div className="space-y-3 sm:space-y-4 md:space-y-6 px-2 sm:px-4">
              <div className="flex justify-center">
                <LoginArea className="w-full max-w-60" />
              </div>

              <p className="text-xs sm:text-sm text-slate-400">
                🚀 <span className="text-purple-300 font-medium">Start your Space today and make it yours forever.</span>
              </p>
            </div>

            {/* Footer */}
            <div className="pt-4 sm:pt-6 md:pt-8 border-t border-slate-700/50 px-2 sm:px-4">
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-6 text-xs text-slate-500">
                <a
                  href="https://gitlab.com/soapbox-pub/universes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 hover:text-purple-400 transition-colors"
                >
                  <MessageCircle className="h-3 w-3" />
                  <span>Open Source</span>
                </a>
                <a
                  href="https://soapbox.pub/mkstack"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-purple-400 transition-colors"
                >
                  Vibed with MKStack
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Decode spaceCommunityId if it's in naddr format
  let decodedSpaceCommunityId: string | null = null;
  if (spaceCommunityId) {
    if (spaceCommunityId.startsWith('naddr1')) {
      try {
        decodedSpaceCommunityId = naddrToCommunityId(spaceCommunityId);
      } catch {
        console.error('Failed to decode naddr');
        decodedSpaceCommunityId = null;
      }
    } else {
      decodedSpaceCommunityId = spaceCommunityId;
    }
  }

  // Check if we're in DM mode
  if (dmTargetPubkey !== undefined) {
    // We're in DM mode - either /dm or /dm/:npub was accessed
    let targetHexPubkey: string | null = null;

    if (dmTargetPubkey) {
      try {
        // Try to decode the npub to get the hex pubkey
        const decoded = nip19.decode(dmTargetPubkey);
        if (decoded.type === 'npub') {
          targetHexPubkey = decoded.data;
        }
      } catch (error) {
        console.error('Invalid npub format:', error);
        // Fallback: treat as hex pubkey if it's 64 hex characters
        if (dmTargetPubkey.match(/^[a-f0-9]{64}$/i)) {
          targetHexPubkey = dmTargetPubkey;
        }
      }
    }

    return <DiscordLayout initialDMTargetPubkey={targetHexPubkey} initialSpaceCommunityId={decodedSpaceCommunityId} />;
  }

  return <DiscordLayout initialSpaceCommunityId={decodedSpaceCommunityId} />;
};

export default Index;
