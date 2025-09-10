import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { decodeNaddrFromUrl } from "./lib/utils";
import { useCurrentUser } from "./hooks/useCurrentUser";

import LandingPage from "./pages/LandingPage";
import JoinPage from "./pages/JoinPage";
import DirectMessagesPage from "./pages/DirectMessagesPage";
import CommunityPage from "./pages/CommunityPage";
import CommunityListPage from "./pages/CommunityListPage";
import Search from "./pages/Search";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import { Communities } from "./pages/Communities";
import { CommunityManagement } from "./pages/CommunityManagement";
import { EmojiReactionsDemo } from "./pages/EmojiReactionsDemo";
import { VoiceDemo } from "./pages/VoiceDemo";
import { CommunitiesDebug } from "./pages/CommunitiesDebug";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";


// Simple root redirecter - shows landing page or redirects to /space
function RootRedirecter() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      // Logged in - redirect to space
      navigate('/space', { replace: true });
    }
  }, [user, navigate]);

  // Show landing page for logged-out users
  if (!user) {
    return <LandingPage />;
  }

  // Show brief loading while redirecting
  return null;
}

// Wrapper component to extract npub parameter and pass it to DirectMessagesPage
function DMWrapper() {
  const { npub } = useParams<{ npub?: string }>();
  return <DirectMessagesPage targetPubkey={npub} />;
}

// Wrapper component to extract community-id and channel parameters and pass them to CommunityPage
// Handles both "kind:pubkey:d-tag" format and naddr format (URL-encoded)
function SpacesWrapper() {
  const { communityId, channelId } = useParams<{ communityId?: string; channelId?: string }>();

  if (!communityId) {
    return <CommunityListPage />;
  }

  // Decode URL-encoded naddr if needed
  let decodedCommunityId = communityId;
  try {
    decodedCommunityId = decodeNaddrFromUrl(communityId);
  } catch {
    // Use original ID if decoding fails
    decodedCommunityId = communityId;
  }

  // Pass the decoded communityId and channelId to CommunityPage
  return <CommunityPage communityId={decodedCommunityId} channelId={channelId} />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<RootRedirecter />} />
        <Route path="/search" element={<Search />} />
        <Route path="/communities" element={<Communities />} />
        <Route
          path="/communities/:communityId/manage"
          element={<CommunityManagement />}
        />
        <Route path="/join/:naddr" element={<JoinPage />} />
        <Route path="/profile/:npub" element={<Profile />} />
        <Route path="/profile/:npub/edit" element={<EditProfile />} />
        <Route path="/emoji-demo" element={<EmojiReactionsDemo />} />
        <Route path="/voice-demo" element={<VoiceDemo />} />
        <Route path="/communities-debug" element={<CommunitiesDebug />} />

        {/* DM Routes - always at /dm */}
        <Route path="/dm" element={<DirectMessagesPage />} />
        <Route path="/dm/:npub" element={<DMWrapper />} />

        {/* Space Routes - show /space/community-id when joining communities */}
        <Route path="/space" element={<CommunityListPage />} />
        <Route path="/space/:communityId" element={<SpacesWrapper />} />
        <Route path="/space/:communityId/:channelId" element={<SpacesWrapper />} />

        {/* NIP-19 identifier routes - handle at root level */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
