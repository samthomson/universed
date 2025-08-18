import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Plus, MessageCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Virtuoso } from "react-virtuoso";
import { DMConversationList } from "./DMConversationList";
import { DMChatArea } from "./DMChatArea";
import { NewDMDialog } from "./NewDMDialog";
import { NewDMDrawer } from "./NewDMDrawer";
import { MessagingSettingsDialog } from "./MessagingSettingsDialog";
import { UserPanel } from "@/components/layout/UserPanel";
import { useDMCategories, type DMTabType } from "@/hooks/useDMCategories";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { DMTabs } from "./DMTabs";
import { nip19 } from "nostr-tools";
import { MESSAGE_PROTOCOL, PROTOCOL_CONFIG } from "@/hooks/useDirectMessages";
import type { DMConversation } from "@/hooks/useAllDMs";

interface DirectMessagesProps {
  targetPubkey?: string | null;
  selectedConversation?: string | null;
  onTargetHandled?: () => void;
  onNavigateToDMs?: (targetPubkey: string) => void;
  onConversationSelect?: (pubkey: string | null) => void;
}

export function DirectMessages({ targetPubkey, selectedConversation: propSelectedConversation, onTargetHandled, onNavigateToDMs, onConversationSelect }: DirectMessagesProps = {}) {
  const [internalSelectedConversation, setInternalSelectedConversation] = useState<string | null>(null);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showMessagingSettings, setShowMessagingSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<DMTabType>('known');

  const isMobile = useIsMobile();
  const { user } = useCurrentUser();
  // OLD system for main conversation list (keep this working)
  const { data: categories, isLoading } = useDMCategories();
  
  // NEW system for discovery section only
  const { conversations: newConversations, progress: discoveryProgress } = useDirectMessages();

  // Use controlled state if provided, otherwise use internal state
  const selectedConversation = propSelectedConversation !== undefined ? propSelectedConversation : internalSelectedConversation;

  // Get conversations for the active tab (OLD system) - memoized to prevent unnecessary re-renders
  const conversations = useMemo(() => {
    return categories ?
      (activeTab === 'known' ? categories.known : categories.newRequests) :
      [];
  }, [categories, activeTab]);

  // Memoize all handlers to prevent unnecessary re-renders (like ChatArea.tsx)
  const handleConversationSelect = useCallback((pubkey: string) => {
    if (propSelectedConversation !== undefined) {
      onConversationSelect?.(pubkey);
    } else {
      setInternalSelectedConversation(pubkey);
    }
  }, [propSelectedConversation, onConversationSelect]);

  const handleNewDM = useCallback(() => {
    setShowNewDM(true);
  }, []);

  const handleConversationCreated = useCallback((pubkey: string) => {
    if (propSelectedConversation !== undefined) {
      onConversationSelect?.(pubkey);
    } else {
      setInternalSelectedConversation(pubkey);
    }
    setShowNewDM(false);
  }, [propSelectedConversation, onConversationSelect]);

  // Memoize Virtuoso itemContent functions to prevent re-renders (must be at top level)
  const mobileItemContent = useCallback((index: number, conversation: DMConversation) => (
    <DMConversationList
      conversations={[conversation]}
      selectedConversation={selectedConversation || null}
      onSelectConversation={handleConversationSelect}
      searchQuery={searchQuery}
      isLoading={isLoading}
      isVirtualized={true}
    />
  ), [selectedConversation, handleConversationSelect, searchQuery, isLoading]);

  const desktopItemContent = useCallback((index: number, conversation: DMConversation) => (
    <DMConversationList
      conversations={[conversation]}
      selectedConversation={selectedConversation || null}
      onSelectConversation={handleConversationSelect}
      searchQuery={searchQuery}
      isLoading={isLoading}
      isVirtualized={true}
    />
  ), [selectedConversation, handleConversationSelect, searchQuery, isLoading]);

  const desktopItemContenNew = useCallback((index: number, conversation) => {
    
    const dmConversation = {
      id: conversation.id,
      pubkey: conversation.id,
      lastMessage: conversation.lastMessage,
      lastMessageTime: conversation.lastActivity,
      unreadCount: conversation.unreadCount || 0,
    };

    return (
    <div key={conversation.id} className="relative">
    <DMConversationList
      conversations={[dmConversation]}
      selectedConversation={selectedConversation || null}
      onSelectConversation={(pubkey) => {
        if (propSelectedConversation !== undefined) {
          onConversationSelect?.(pubkey);
        } else {
          setInternalSelectedConversation(pubkey);
        }
      }}
      searchQuery={searchQuery}
      isLoading={false}
      isVirtualized={true}
    />
      <div className="absolute bottom-4 right-3 flex items-center space-x-1 pointer-events-none">
        {conversation.hasNIP4Messages && (
          <div 
            className={`w-2 h-2 ${PROTOCOL_CONFIG[MESSAGE_PROTOCOL.NIP04].color} rounded-full border border-gray-700`}
            title={PROTOCOL_CONFIG[MESSAGE_PROTOCOL.NIP04].title}
          />
        )}
        {conversation.hasNIP17Messages && (
          <div 
            className={`w-2 h-2 ${PROTOCOL_CONFIG[MESSAGE_PROTOCOL.NIP17].color} rounded-full border border-gray-700`}
            title={PROTOCOL_CONFIG[MESSAGE_PROTOCOL.NIP17].title}
          />
        )}
      </div>
    </div>
  )}, [selectedConversation, searchQuery, propSelectedConversation, onConversationSelect]);

  // Memoize components objects
  const mobileComponents = useMemo(() => ({
    EmptyPlaceholder: () => (
      <div className="flex-1 flex items-center justify-center bg-gray-800 p-8">
        <div className="text-center text-gray-400">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">
            {activeTab === 'known' ? 'No known conversations' : 'No requests'}
          </h3>
          <p className="text-sm mb-4">
            {activeTab === 'known'
              ? 'Conversations from people you follow will appear here.'
              : 'Message requests from people you don\'t follow will appear here.'
            }
          </p>
          <Button onClick={handleNewDM} className="mobile-touch">
            <Plus className="w-4 h-4 mr-2" />
            Start New Conversation
          </Button>
        </div>
      </div>
    ),
    Footer: () => <div className="h-2" />,
  }), [activeTab, handleNewDM]);

  const desktopComponents = useMemo(() => ({
    EmptyPlaceholder: () => (
      <div className="flex items-center justify-center p-8">
        <div className="text-center text-gray-400">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">
            {activeTab === 'known' ? 'No known conversations' : 'No requests'}
          </h3>
          <p className="text-sm mb-4">
            {activeTab === 'known'
              ? 'Conversations from people you follow will appear here.'
              : 'Message requests from people you don\'t follow will appear here.'
            }
          </p>
          <Button onClick={handleNewDM}>
            <Plus className="w-4 h-4 mr-2" />
            Start New Conversation
          </Button>
        </div>
      </div>
    ),
  }), [activeTab, handleNewDM]);

  // Auto-select conversation when targetPubkey is provided
  useEffect(() => {
    if (targetPubkey) {
      // If controlled, notify parent, otherwise set internal state
      if (propSelectedConversation !== undefined) {
        onConversationSelect?.(targetPubkey);
      } else {
        setInternalSelectedConversation(targetPubkey);
      }
      // Mark the target as handled
      onTargetHandled?.();
    }
  }, [targetPubkey, onTargetHandled, onConversationSelect, propSelectedConversation]);

  // Update URL when a conversation is selected (only for manual selections, not initial ones)
  useEffect(() => {
    if (selectedConversation && !targetPubkey && user) {
      // Only update URL if this is a manual selection (not from initial targetPubkey)
      try {
        // Convert hex pubkey to npub for URL
        const npub = nip19.npubEncode(selectedConversation);
        const url = new URL(window.location.href);
        url.pathname = `/dm/${npub}`;
        window.history.replaceState({}, '', url.toString());
      } catch (error) {
        console.error('Failed to encode pubkey:', error);
      }
    }
  }, [selectedConversation, targetPubkey, user]);

  // Update URL when no conversation is selected
  useEffect(() => {
    if (!selectedConversation && !targetPubkey) {
      const url = new URL(window.location.href);
      url.pathname = '/dm';
      window.history.replaceState({}, '', url.toString());
    }
  }, [selectedConversation, targetPubkey]);

  // Memoize the expensive filtering and sorting operations (must be before early return)
  const filteredDiscoveredConversations = useMemo(() => {
    return newConversations.conversations
      // .filter(_conv => {
      //   // For discovered conversations, show all in "known" tab for now
      //   // "Requests" tab is empty until we implement contact categorization
      //   if (discoveredTab === 'known') {
      //     return true; // Show all discovered conversations in Known tab
      //   } else {
      //     return false; // Requests tab is empty for discovered conversations
      //   }
      // })
      .sort((a, b) => b.lastActivity - a.lastActivity); // Sort by most recent message first
  }, [newConversations.conversations]);
  

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <p>You must be logged in to view direct messages</p>
        </div>
      </div>
    );
  }

  if (isMobile) {
    // Mobile: Show either conversation list or chat, not both
    return (
      <div className="flex flex-col h-full">
        {selectedConversation ? (
          <DMChatArea
            conversationId={selectedConversation}
            onNavigateToDMs={onNavigateToDMs}
            onBack={() => {
              if (propSelectedConversation !== undefined) {
                onConversationSelect?.(null);
              } else {
                setInternalSelectedConversation(null);
              }
            }}
            onMessageSent={(recipientPubkey) => {
              // Check if this conversation is currently in New Requests
              const isNewRequest = categories?.newRequests.some(conv => conv.pubkey === recipientPubkey);

              // If this was a new request, mark it as responded to move it to Known
              if (isNewRequest && categories?.markAsResponded) {
                categories.markAsResponded(recipientPubkey);
              }
            }}
          />
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-600 bg-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-white">Messages</h2>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 hover:bg-gray-800/60 mobile-touch"
                    onClick={() => setShowMessagingSettings(true)}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 hover:bg-gray-800/60 mobile-touch"
                    onClick={handleNewDM}
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <DMTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />

              {/* Search */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search conversations"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-gray-600 border-gray-500 text-gray-100 placeholder:text-gray-400 focus:bg-gray-800/60 transition-colors text-base"
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-hidden bg-gray-700 px-2">
              <Virtuoso
                data={conversations || []}
                itemContent={mobileItemContent}
                components={mobileComponents}
                className="h-full scrollbar-thin"
              />
            </div>
          </>
        )}

        {/* New DM Drawer for mobile */}
        <NewDMDrawer
          open={showNewDM}
          onOpenChange={setShowNewDM}
          onConversationCreated={handleConversationCreated}
        />

        {/* Messaging Settings Dialog */}
        <MessagingSettingsDialog
          open={showMessagingSettings}
          onOpenChange={setShowMessagingSettings}
        />
      </div>
    );
  }
  const hideOldSidebar = true;

  // Desktop layout
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      {!hideOldSidebar && (
        <>       
          <div className="w-60 bg-gray-700 flex flex-col border-r border-gray-600">
            {/* Header */}
            <div className="p-4 border-b border-gray-600">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-white">Messages</h2>
                                <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 hover:bg-gray-800/60"
                      onClick={handleNewDM}
                    >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Tabs */}
              <DMTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />

              {/* Search */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search conversations"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-gray-600 border-gray-500 text-gray-100 placeholder:text-gray-400 focus:bg-gray-800/60 transition-colors"
                />
              </div>
            </div>

            {/* Current Conversation List */}
            <div className="flex-1 overflow-hidden px-1">
              <Virtuoso
                data={conversations}
                itemContent={desktopItemContent}
                components={desktopComponents}
                className="h-full scrollbar-thin"
              />
            </div>

            {/* User Panel at the bottom */}
            <UserPanel />
          </div>
        </>
      )}

      {/* sidebar 2? */}
      <div className="w-60 bg-gray-700 flex flex-col border-r border-gray-600">
        {/* Header */}
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white">Messages</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 hover:bg-gray-800/60"
                onClick={() => setShowMessagingSettings(true)}
              >
                <Settings className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 hover:bg-gray-800/60"
                onClick={handleNewDM}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="px-2 mb-3">
            <h3 className="text-sm font-medium text-blue-300 mb-1">
              🔍 Discovered Conversations
            </h3>
            {newConversations.isLoading && (
              <div className="space-y-1">
                {/* Friend-based discovery progress */}
                {discoveryProgress.friendsTotalToProcess > 0 && (
                  <p className="text-xs text-gray-400">
                    Checking friends... ({discoveryProgress.friendsProcessedCount}/{discoveryProgress.friendsTotalToProcess})
                  </p>
                )}
                {/* Comprehensive scanning status */}
                {newConversations.isLoadingComprehensive && (
                  <p className="text-xs text-gray-500">
                    🔍 Scanning all messages for additional conversations...
                  </p>
                )}
              </div>
            )}
            {!newConversations.isLoading && newConversations.conversations.length > 0 && (
              <p className="text-xs text-gray-400">
                Found {newConversations.conversations.length} conversations
              </p>
            )}
          </div>

          {/* Tabs */}
          <DMTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search conversations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-600 border-gray-500 text-gray-100 placeholder:text-gray-400 focus:bg-gray-800/60 transition-colors"
            />
          </div>
        </div>

        {/* Current Conversation List */}
        <div className="flex-1 overflow-hidden px-1">
          <Virtuoso
            data={filteredDiscoveredConversations}
            itemContent={desktopItemContenNew}
            components={desktopComponents}
            className="h-full scrollbar-thin"
          />
        </div>

        {/* User Panel at the bottom */}
        <UserPanel />
      </div>

      {/* Chat Area */}
      <div className="flex-1">
        {selectedConversation ? (
          <DMChatArea
            conversationId={selectedConversation}
            onNavigateToDMs={onNavigateToDMs}
            onMessageSent={(recipientPubkey) => {
              // Check if this conversation is currently in New Requests
              const isNewRequest = categories?.newRequests.some(conv => conv.pubkey === recipientPubkey);

              // If this was a new request, mark it as responded to move it to Known
              if (isNewRequest && categories?.markAsResponded) {
                categories.markAsResponded(recipientPubkey);
              }
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
              <p className="text-sm mb-4">Choose a conversation to start messaging!</p>
                                  <Button onClick={handleNewDM}>
                      <Plus className="w-4 h-4 mr-2" />
                      Start New Conversation
                    </Button>
            </div>
          </div>
        )}
      </div>

      {/* New DM Dialog */}
      <NewDMDialog
        open={showNewDM}
        onOpenChange={setShowNewDM}
        onConversationCreated={handleConversationCreated}
      />

      {/* Messaging Settings Dialog */}
      <MessagingSettingsDialog
        open={showMessagingSettings}
        onOpenChange={setShowMessagingSettings}
      />
    </div>
  );


}