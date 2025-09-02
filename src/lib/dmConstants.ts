
// Message protocol types
export const MESSAGE_PROTOCOL = {
	NIP04: 'NIP04',
	NIP17: 'NIP17',
	UNKNOWN: 'UNKNOWN'
} as const;

export type MessageProtocol = typeof MESSAGE_PROTOCOL[keyof typeof MESSAGE_PROTOCOL];

// Message sending parameters
export interface SendMessageParams {
	recipientPubkey: string;
	content: string;
	protocol?: MessageProtocol; // Optional - defaults to NIP-04 for now
}

// Helper function to determine message protocol
export function getMessageProtocol(kind: number): MessageProtocol {
	switch (kind) {
		case 4: return MESSAGE_PROTOCOL.NIP04;
		case 1059: return MESSAGE_PROTOCOL.NIP17; // Gift Wrap
		case 14: return MESSAGE_PROTOCOL.NIP17;   // Private DM (decrypted NIP-17)
		default: return MESSAGE_PROTOCOL.UNKNOWN;
	}
}

// Protocol indicator configuration
export const PROTOCOL_CONFIG = {
	[MESSAGE_PROTOCOL.NIP04]: {
		color: 'bg-orange-500',
		textColor: 'text-orange-600 dark:text-orange-400',
		label: 'NIP-04',
		title: 'NIP-04 encrypted message'
	},
	[MESSAGE_PROTOCOL.NIP17]: {
		color: 'bg-purple-500',
		textColor: 'text-purple-600 dark:text-purple-400',
		label: 'NIP-17',
		title: 'NIP-44/NIP-17 encrypted message'
	},
	[MESSAGE_PROTOCOL.UNKNOWN]: {
		color: 'bg-gray-400',
		textColor: 'text-gray-600 dark:text-gray-400',
		label: 'Unknown',
		title: 'Unknown message type'
	}
} as const;

// Constants for consistent naming across the app
export const PROTOCOL_CONSTANTS = {
	// localStorage keys
	NIP17_ENABLED_KEY: 'enableNIP17',

	// Query keys (legacy - these are no longer used but kept for reference)
	NIP4_MESSAGES_KEY: 'nip4-messages',
	NIP17_MESSAGES_KEY: 'nip17-all-messages',
	NIP4_CONVERSATIONS_KEY: 'nip4-all-conversations',

	// Logger prefixes
	NIP4_LOG_PREFIX: 'DMS: [NIP4]',
	NIP17_LOG_PREFIX: 'DMS: [NIP17]',
	DMCHAT_LOG_PREFIX: 'DMS: [DMCHAT]',
	DIRECT_MESSAGES_LOG_PREFIX: 'DMS: [DirectMessages]',
} as const;
