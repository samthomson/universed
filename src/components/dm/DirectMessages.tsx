import { useState, useEffect } from "react";
import { Search, Plus, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Virtuoso } from "react-virtuoso";
import { DMConversationList } from "./DMConversationList";
import { DMChatArea } from "./DMChatArea";
import { NewDMDialog } from "./NewDMDialog";
import { NewDMDrawer } from "./NewDMDrawer";
import { UserPanel } from "@/components/layout/UserPanel";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsMobile } from "@/hooks/useIsMobile";
import { nip19 } from "nostr-tools";

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
  const [searchQuery, setSearchQuery] = useState("");

  const isMobile = useIsMobile();
  const { user } = useCurrentUser();
  const { data: conversations, isLoading } = useDirectMessages();

  // Use controlled state if provided, otherwise use internal state
  const selectedConversation = propSelectedConversation !== undefined ? propSelectedConversation : internalSelectedConversation;

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
          />
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-600 bg-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-white">Messages</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 hover:bg-gray-800/60 mobile-touch"
                  onClick={() => setShowNewDM(true)}
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </div>

              {/* Search */}
              <div className="relative">
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
            <div className="flex-1 overflow-hidden bg-gray-700">
              <Virtuoso
                data={conversations || []}
                itemContent={(index, conversation) => (
                  <DMConversationList
                    conversations={[conversation]}
                    selectedConversation={selectedConversation || null}
                    onSelectConversation={(pubkey) => {
                  if (propSelectedConversation !== undefined) {
                    onConversationSelect?.(pubkey);
                  } else {
                    setInternalSelectedConversation(pubkey);
                  }
                }}
                    searchQuery={searchQuery}
                    isLoading={isLoading}
                    isVirtualized={true}
                  />
                )}
                components={{
                  EmptyPlaceholder: () => (
                    <div className="flex-1 flex items-center justify-center bg-gray-800 p-8">
                      <div className="text-center text-gray-400">
                        <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">No conversations yet</h3>
                        <p className="text-sm mb-4">Start a new conversation to get chatting!</p>
                        <Button onClick={() => setShowNewDM(true)} className="mobile-touch">
                          <Plus className="w-4 h-4 mr-2" />
                          Start New Conversation
                        </Button>
                      </div>
                    </div>
                  ),
                  Footer: () => <div className="h-2" />,
                }}
                className="h-full scrollbar-thin"
              />
            </div>
          </>
        )}

        {/* New DM Drawer for mobile */}
        <NewDMDrawer
          open={showNewDM}
          onOpenChange={setShowNewDM}
          onConversationCreated={(pubkey) => {
            if (propSelectedConversation !== undefined) {
              onConversationSelect?.(pubkey);
            } else {
              setInternalSelectedConversation(pubkey);
            }
            setShowNewDM(false);
          }}
        />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-60 bg-gray-700 flex flex-col border-r border-gray-600">
        {/* Header */}
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white">Messages</h2>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 hover:bg-gray-800/60"
              onClick={() => setShowNewDM(true)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search conversations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-600 border-gray-500 text-gray-100 placeholder:text-gray-400 focus:bg-gray-800/60 transition-colors"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-hidden">
          <Virtuoso
            data={conversations || []}
            itemContent={(index, conversation) => (
              <DMConversationList
                conversations={[conversation]}
                selectedConversation={selectedConversation || null}
                onSelectConversation={(pubkey) => {
                  if (propSelectedConversation !== undefined) {
                    onConversationSelect?.(pubkey);
                  } else {
                    setInternalSelectedConversation(pubkey);
                  }
                }}
                searchQuery={searchQuery}
                isLoading={isLoading}
                isVirtualized={true}
              />
            )}
            components={{
              EmptyPlaceholder: () => (
                <div className="flex items-center justify-center p-8">
                  <div className="text-center text-gray-400">
                    <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">No conversations yet</h3>
                    <p className="text-sm mb-4">Start a new conversation to get chatting!</p>
                    <Button onClick={() => setShowNewDM(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Start New Conversation
                    </Button>
                  </div>
                </div>
              ),
              Footer: () => <div className="h-2" />,
            }}
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
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
              <p className="text-sm mb-4">Choose a conversation to start messaging!</p>
              <Button onClick={() => setShowNewDM(true)}>
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
        onConversationCreated={(pubkey) => {
          if (propSelectedConversation !== undefined) {
            onConversationSelect?.(pubkey);
          } else {
            setInternalSelectedConversation(pubkey);
          }
          setShowNewDM(false);
        }}
      />
    </div>
  );
}