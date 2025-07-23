import { useSeoMeta } from '@unhead/react';
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { LoginArea } from "@/components/auth/LoginArea";
import { DiscordLayout } from "@/components/layout/DiscordLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Users, MessageCircle, Shield, Zap, Globe } from "lucide-react";

const Index = () => {
  const { user } = useCurrentUser();

  useSeoMeta({
    title: 'Universes - Discover Communities on Nostr',
    description: 'Explore infinite universes of communities, conversations, and connections on the decentralized Nostr protocol.',
  });

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

              <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                Universes
              </h1>

              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-slate-300 max-w-2xl mx-auto leading-relaxed px-2 sm:px-4">
                Explore infinite universes of communities, conversations, and connections on the
                <span className="text-purple-400 font-semibold"> decentralized web</span>
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6 max-w-3xl mx-auto px-2 sm:px-4">
              <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
                <CardContent className="p-3 sm:p-4 md:p-6 text-center space-y-2 sm:space-y-3">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-blue-400 mx-auto" />
                  <h3 className="font-semibold text-slate-200 text-xs sm:text-sm md:text-base">Communities</h3>
                  <p className="text-xs text-slate-400">Join vibrant communities across infinite universes</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
                <CardContent className="p-3 sm:p-4 md:p-6 text-center space-y-2 sm:space-y-3">
                  <Shield className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-green-400 mx-auto" />
                  <h3 className="font-semibold text-slate-200 text-xs sm:text-sm md:text-base">Decentralized</h3>
                  <p className="text-xs text-slate-400">Own your data, control your experience</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm sm:col-span-2 md:col-span-1">
                <CardContent className="p-3 sm:p-4 md:p-6 text-center space-y-2 sm:space-y-3">
                  <Zap className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-yellow-400 mx-auto" />
                  <h3 className="font-semibold text-slate-200 text-xs sm:text-sm md:text-base">Lightning Fast</h3>
                  <p className="text-xs text-slate-400">Real-time conversations across the network</p>
                </CardContent>
              </Card>
            </div>

            {/* Login Section */}
            <div className="space-y-3 sm:space-y-4 md:space-y-6 px-2 sm:px-4">
              <div className="flex justify-center">
                <LoginArea className="w-full max-w-60" />
              </div>

              <p className="text-xs sm:text-sm text-slate-400">
                New to Nostr? No problem! Create your identity and start exploring.
              </p>
            </div>

            {/* Footer */}
            <div className="pt-4 sm:pt-6 md:pt-8 border-t border-slate-700/50 px-2 sm:px-4">
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-6 text-xs text-slate-500">
                <div className="flex items-center space-x-2">
                  <Globe className="h-3 w-3" />
                  <span>Decentralized</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MessageCircle className="h-3 w-3" />
                  <span>Open Source</span>
                </div>
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

  return <DiscordLayout />;
};

export default Index;
