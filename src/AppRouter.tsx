import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import Index from "./pages/Index";
import Search from "./pages/Search";
import Profile from "./pages/Profile";
import { Communities } from "./pages/Communities";
import { CommunityManagement } from "./pages/CommunityManagement";
import { EmojiReactionsDemo } from "./pages/EmojiReactionsDemo";
import NotFound from "./pages/NotFound";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/search" element={<Search />} />
        <Route path="/communities" element={<Communities />} />
        <Route path="/communities/:communityId/manage" element={<CommunityManagement />} />
        <Route path="/join/:naddr" element={<Index />} />
        <Route path="/profile/:npub" element={<Profile />} />
        <Route path="/emoji-demo" element={<EmojiReactionsDemo />} />
        {/* Catch-all route for naddr and other patterns */}
        <Route path="/:identifier" element={<Index />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;