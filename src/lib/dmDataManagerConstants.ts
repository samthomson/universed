// Constants for DataManager operations
export const DATA_MANAGER_CONSTANTS = {
  // Logging prefixes
  LOG_PREFIX: 'DMS: DataManager:',
  CONVERSATION_LOG_PREFIX: 'DMS: useConversationMessages:',

  // Timing constants (in milliseconds)
  DEBOUNCED_WRITE_DELAY: 15000, // 15 seconds
  RECENT_MESSAGE_THRESHOLD: 5000, // 5 seconds
  SUBSCRIPTION_OVERLAP_SECONDS: 60, // 60 seconds
  NIP17_SETTING_CHANGE_DELAY: 500, // 500ms

  // Scanning limits
  SCAN_TOTAL_LIMIT: 20000,
  SCAN_BATCH_SIZE: 1000,

  // Query timeouts (in milliseconds)
  NIP4_QUERY_TIMEOUT: 15000, // 15 seconds
  NIP17_QUERY_TIMEOUT: 30000, // 30 seconds

  // Message limits
  MESSAGES_PER_PAGE: 25,

  // Error logging debounce
  ERROR_LOG_DEBOUNCE_DELAY: 2000, // 2 seconds
} as const;

// Status messages for scan progress
export const SCAN_STATUS_MESSAGES = {
  NIP4_STARTING: 'Starting NIP-4 scan...',
  NIP17_STARTING: 'Starting NIP-17 scan...',
  BATCH_COMPLETE: (batchNumber: number, messageCount: number) =>
    `Batch ${batchNumber} complete: ${messageCount} messages`,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NO_USER_PUBKEY: 'No user pubkey available',
  NO_DECRYPTION_AVAILABLE: 'No decryption available',
  DECRYPTION_FAILED: 'Decryption failed',
  INVALID_SEAL_FORMAT: (expected: number, actual: number) =>
    `Invalid Seal format - expected kind ${expected}, got ${actual}`,
  INVALID_MESSAGE_FORMAT: (expected: number, actual: number) =>
    `Invalid message format - expected kind ${expected}, got ${actual}`,
  INVALID_RECIPIENT: 'Invalid recipient - malformed p tag',
  NIP17_PROCESSING_FAILED: 'Failed to decrypt or parse NIP-17 message',
} as const;
