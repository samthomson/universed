import type { DecryptedMessage } from './nostr';
import type { MessageProtocol } from '@/lib/dmConstants';

// Core participant data structure used throughout DataManager
export interface ParticipantData {
	messages: DecryptedMessage[];
	lastActivity: number;
	lastMessage: DecryptedMessage | null;
	hasNIP4: boolean;
	hasNIP17: boolean;
}

// Messages state structure
export type MessagesState = Map<string, ParticipantData>;

// Last sync timestamps for each protocol
export interface LastSyncData {
	nip4: number | null;
	nip17: number | null;
}

// Subscription status for each protocol
export interface SubscriptionStatus {
	nip4: boolean;
	nip17: boolean;
}

// Scan progress tracking
export interface ScanProgress {
	current: number;
	status: string;
}

export interface ScanProgressState {
	nip4: ScanProgress | null;
	nip17: ScanProgress | null;
}

// Debug information structure
export interface DebugInfo {
	messageCount: number;
	nip4Count: number;
	nip17Count: number;
	nip4Sync: Date | null;
	nip17Sync: Date | null;
	nip17Enabled: boolean;
}

// Conversation summary structure
export interface ConversationSummary {
	id: string;
	pubkey: string;
	lastMessage: DecryptedMessage | null;
	lastActivity: number;
	hasNIP4Messages: boolean;
	hasNIP17Messages: boolean;
	recentMessages: DecryptedMessage[];
	isKnown: boolean;
	isRequest: boolean;
	lastMessageFromUser: boolean;
}

// Message processing result
export interface MessageProcessingResult {
	lastMessageTimestamp?: number;
	messageCount: number;
}

// Decryption result
export interface DecryptionResult {
	decryptedContent: string;
	error?: string;
}

// NIP-17 processing result
export interface NIP17ProcessingResult {
	processedMessage: DecryptedMessage;
	conversationPartner: string;
	error?: string;
}
