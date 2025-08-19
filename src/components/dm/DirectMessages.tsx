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
import { ProtocolIndicator } from "./ProtocolIndicator";
import { UserPanel } from "@/components/layout/UserPanel";
import { type DMTabType } from "@/types/dm";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { DMTabs } from "./DMTabs";
import { nip19 } from "nostr-tools";
import { MESSAGE_PROTOCOL } from "@/hooks/useDirectMessages";


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
  // Use the NEW system for all conversation data
  const { conversations: newConversations, progress: discoveryProgress } = useDirectMessages();

  // Use controlled state if provided, otherwise use internal state
  const selectedConversation = propSelectedConversation !== undefined ? propSelectedConversation : internalSelectedConversation;





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

  // Consolidated responsive item content function
  const conversationItemContent = useCallback((index: number, conversation) => {
    const dmConversation = {
      id: conversation.id,
      pubkey: conversation.id,
      lastMessage: conversation.lastMessage,
      lastMessageTime: conversation.lastActivity,
      unreadCount: conversation.unreadCount || 0,
      isKnown: conversation.isKnown,
      isRequest: conversation.isRequest,
      lastMessageFromUser: conversation.lastMessageFromUser,
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
            <ProtocolIndicator protocol={MESSAGE_PROTOCOL.NIP04} />
          )}
          {conversation.hasNIP17Messages && (
            <ProtocolIndicator protocol={MESSAGE_PROTOCOL.NIP17} />
          )}
        </div>
      </div>
    );
  }, [selectedConversation, searchQuery, propSelectedConversation, onConversationSelect]);

  // Consolidated components object with responsive design
  const virtuosoComponents = useMemo(() => ({
    EmptyPlaceholder: () => (
      <div className="flex-1 md:flex-none flex items-center justify-center bg-gray-800 md:bg-transparent p-8">
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
          <Button onClick={handleNewDM} className={isMobile ? "mobile-touch" : ""}>
            <Plus className="w-4 h-4 mr-2" />
            Start New Conversation
          </Button>
        </div>
      </div>
    ),
    Footer: () => <div className="h-2 md:h-0" />,
  }), [activeTab, handleNewDM, isMobile]);

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
      .filter(conv => {
        // Filter conversations based on active tab
        if (activeTab === 'known') {
          return conv.isKnown; // Show conversations where user has sent messages
        } else {
          return conv.isRequest; // Show conversations where user hasn't replied yet
        }
      })
      .sort((a, b) => b.lastActivity - a.lastActivity); // Sort by most recent message first
  }, [newConversations.conversations, activeTab]);

  // Calculate counts for tabs
  const knownCount = useMemo(() => {
    return newConversations.conversations.filter(conv => conv.isKnown).length;
  }, [newConversations.conversations]);

  const requestsCount = useMemo(() => {
    return newConversations.conversations.filter(conv => conv.isRequest).length;
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
            onMessageSent={(_recipientPubkey) => {
              // TODO: Implement new request handling with new system if needed
            }}
          />
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-600 bg-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1">
                  <h2 className="font-semibold text-white">Messages</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 hover:bg-gray-800/60 mobile-touch"
                    onClick={() => setShowMessagingSettings(true)}
                  >
                    <Settings className="w-3 h-3" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 hover:bg-gray-800/60 mobile-touch"
                  onClick={handleNewDM}
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </div>

              {/* Tabs */}
              <DMTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                knownCount={knownCount}
                requestsCount={requestsCount}
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
                data={filteredDiscoveredConversations}
                itemContent={conversationItemContent}
                components={virtuosoComponents}
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


  // Desktop layout
  return (
    <div className="flex h-full">


      {/* sidebar 2? */}
      <div className="w-60 bg-gray-700 flex flex-col border-r border-gray-600">
        {/* Header */}
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              <h2 className="font-semibold text-white">Messages</h2>
              <Button
                variant="ghost"
                size="icon"
                className="w-5 h-5 hover:bg-gray-800/60"
                onClick={() => setShowMessagingSettings(true)}
              >
                <Settings className="w-3 h-3" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 hover:bg-gray-800/60"
              onClick={handleNewDM}
            >
              <Plus className="w-4 h-4" />
            </Button>
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
            knownCount={knownCount}
            requestsCount={requestsCount}
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
            itemContent={conversationItemContent}
            components={virtuosoComponents}
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
            onMessageSent={(_recipientPubkey) => {
              // TODO: Implement new request handling with new system if needed
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