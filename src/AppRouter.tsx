import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { useCurrentUser } from "./hooks/useCurrentUser";

import LandingPage from "./pages/LandingPage";
import { AppLayout } from "./components/layout/AppLayout";
import Search from "./pages/Search";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import { Communities } from "./pages/Communities";
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

// Remove old wrapper components - now handled in AppWithSidebar

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<RootRedirecter />} />
        <Route path="/search" element={<Search />} />
        <Route path="/communities" element={<Communities />} />
        <Route path="/profile/:npub" element={<Profile />} />
        <Route path="/profile/:npub/edit" element={<EditProfile />} />
        <Route path="/emoji-demo" element={<EmojiReactionsDemo />} />
        <Route path="/voice-demo" element={<VoiceDemo />} />
        <Route path="/communities-debug" element={<CommunitiesDebug />} />

        {/* App routes - with persistent sidebar */}
        <Route path="/dm/*" element={<AppLayout />} />
        <Route path="/space/*" element={<AppLayout />} />
        <Route path="/join/*" element={<AppLayout />} />

        {/* NIP-19 identifier routes - handle at root level */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
