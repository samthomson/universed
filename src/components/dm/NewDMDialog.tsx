import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { useToast } from "@/hooks/useToast";
import { nip19 } from "nostr-tools";

interface NewDMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (pubkey: string) => void;
}

export function NewDMDialog({ open, onOpenChange, onConversationCreated }: NewDMDialogProps) {
  const [input, setInput] = useState("");
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const author = useAuthor(pubkey || '');
  const metadata = author.data?.metadata;
  const { toast } = useToast();

  const handleInputChange = (value: string) => {
    setInput(value);
    setError(null);

    if (!value.trim()) {
      setPubkey(null);
      return;
    }

    try {
      let extractedPubkey: string;

      // Check if it's a hex pubkey (64 characters)
      if (/^[0-9a-fA-F]{64}$/.test(value)) {
        extractedPubkey = value.toLowerCase();
      }
      // Check if it's an npub
      else if (value.startsWith('npub1')) {
        const decoded = nip19.decode(value);
        if (decoded.type === 'npub') {
          extractedPubkey = decoded.data;
        } else {
          throw new Error('Invalid npub format');
        }
      }
      // Check if it's an nprofile
      else if (value.startsWith('nprofile1')) {
        const decoded = nip19.decode(value);
        if (decoded.type === 'nprofile') {
          extractedPubkey = decoded.data.pubkey;
        } else {
          throw new Error('Invalid nprofile format');
        }
      }
      else {
        throw new Error('Invalid format');
      }

      setPubkey(extractedPubkey);
    } catch {
      setError('Invalid pubkey, npub, or nprofile');
      setPubkey(null);
    }
  };

  const handleStartConversation = () => {
    if (!pubkey) {
      toast({
        title: "Error",
        description: "Please enter a valid pubkey, npub, or nprofile",
        variant: "destructive",
      });
      return;
    }

    onConversationCreated(pubkey);
    onOpenChange(false);
    setInput("");
    setPubkey(null);
    setError(null);
  };

  const displayName = metadata?.name || (pubkey ? genUserName(pubkey) : '');
  const profileImage = metadata?.picture;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a Direct Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pubkey">User Pubkey, npub, or nprofile</Label>
            <Input
              id="pubkey"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="npub1... or nprofile1... or hex pubkey"
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          {/* User Preview */}
          {pubkey && !error && (
            <div className="border border-gray-600 rounded-lg p-3 bg-gray-700">
              <div className="flex items-center space-x-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={profileImage} alt={displayName} />
                  <AvatarFallback className="bg-indigo-600 text-white text-sm">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{displayName}</p>
                  <p className="text-sm text-gray-400 truncate">
                    {pubkey.slice(0, 16)}...
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartConversation}
              disabled={!pubkey || !!error}
            >
              Start Conversation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}