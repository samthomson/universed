import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import Index from "./pages/Index";
import Search from "./pages/Search";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import { Communities } from "./pages/Communities";
import { CommunityManagement } from "./pages/CommunityManagement";
import { EmojiReactionsDemo } from "./pages/EmojiReactionsDemo";
import { VoiceDemo } from "./pages/VoiceDemo";
import NotFound from "./pages/NotFound";


// Wrapper component to extract npub parameter and pass it to Index
function DMWrapper() {
  const { npub } = useParams<{ npub?: string }>();
  return <Index dmTargetPubkey={npub} />;
}

// Wrapper component to extract community-id parameter and pass it to Index
// Handles both "kind:pubkey:d-tag" format and naddr format
function SpacesWrapper() {
  const { communityId } = useParams<{ communityId?: string }>();

  if (!communityId) {
    return <Index />;
  }

  // Pass the communityId as-is to Index - it will handle both formats
  return <Index spaceCommunityId={communityId} />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/search" element={<Search />} />
        <Route path="/communities" element={<Communities />} />
        <Route
          path="/communities/:communityId/manage"
          element={<CommunityManagement />}
        />
        <Route path="/join/:naddr" element={<Index />} />
        <Route path="/profile/:npub" element={<Profile />} />
        <Route path="/profile/:npub/edit" element={<EditProfile />} />
        <Route path="/emoji-demo" element={<EmojiReactionsDemo />} />
        <Route path="/voice-demo" element={<VoiceDemo />} />

        {/* DM Routes - always at /dm */}
        <Route path="/dm" element={<Index dmTargetPubkey={undefined} />} />
        <Route path="/dm/:npub" element={<DMWrapper />} />

        {/* Space Routes - show /space/community-id when joining communities */}
        <Route path="/space/:communityId" element={<SpacesWrapper />} />

        {/* Catch-all route for naddr and other patterns */}
        <Route path="/:identifier" element={<Index />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
