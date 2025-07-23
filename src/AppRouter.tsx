import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import Index from "./pages/Index";
import Search from "./pages/Search";
import Profile from "./pages/Profile";
import { Communities } from "./pages/Communities";
import { CommunityManagement } from "./pages/CommunityManagement";
import { NIP19Page } from "./pages/NIP19Page";
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
        <Route path="/profile/:npub" element={<Profile />} />
        {/* NIP-19 route for npub1, note1, naddr1, nevent1, nevent1, nprofile1 */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;