import { useState } from "react";
import { Search, Plus, MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DMConversationList } from "./DMConversationList";
import { DMChatArea } from "./DMChatArea";
import { NewDMDialog } from "./NewDMDialog";
import { FriendsPanel } from "@/components/social/FriendsPanel";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function DirectMessages() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showNewDM, setShowNewDM] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { user } = useCurrentUser();
  const { data: conversations } = useDirectMessages();

  const handleStartDM = (pubkey: string) => {
    setSelectedConversation(pubkey);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <p>You must be logged in to view direct messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-60 bg-gray-700 flex flex-col border-r border-gray-600">
        {/* Header */}
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white">Messages & Friends</h2>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6"
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
              className="pl-9 bg-gray-600 border-gray-500 text-gray-100 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="messages" className="flex-1 flex flex-col">
          <div className="px-4 pt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="messages" className="text-xs">
                <MessageCircle className="w-3 h-3 mr-1" />
                Messages
              </TabsTrigger>
              <TabsTrigger value="friends" className="text-xs">
                <Users className="w-3 h-3 mr-1" />
                Friends
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="messages" className="flex-1 mt-2 overflow-hidden">
            <ScrollArea className="h-full">
              <DMConversationList
                conversations={conversations || []}
                selectedConversation={selectedConversation}
                onSelectConversation={setSelectedConversation}
                searchQuery={searchQuery}
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="friends" className="flex-1 mt-2 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="px-2">
                <FriendsPanel onStartDM={handleStartDM} />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Chat Area */}
      <div className="flex-1">
        {selectedConversation ? (
          <DMChatArea
            conversationId={selectedConversation}
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
          setSelectedConversation(pubkey);
          setShowNewDM(false);
        }}
      />
    </div>
  );
}