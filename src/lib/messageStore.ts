import { openDB, IDBPDatabase } from 'idb';
import { logger } from './logger';

// Match the in-memory structure exactly
interface StoredMessage {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
  kind: number;
  tags: string[][];
  sig: string;
}

interface StoredParticipant {
  messages: StoredMessage[];
  lastActivity: number;
  hasNIP4: boolean;
  hasNIP17: boolean;
}

// Store structure: Map<participantPubkey, StoredParticipant>
interface MessageStore {
  participants: Record<string, StoredParticipant>;
  lastSync: {
    nip4: number | null;
    nip17: number | null;
  };
}

// IndexedDB configuration
const DB_NAME = 'nostr-messages';
const DB_VERSION = 1;

// Initialize IndexedDB
async function initDB(userNpub: string): Promise<IDBPDatabase> {
  const storeName = `messages-${userNpub}`;
  
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create store for this user if it doesn't exist
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
        logger.log(`Created store ${storeName} in IndexedDB`);
      }
    },
  });
}

// Read all messages from IndexedDB for a specific user
export async function readMessagesFromDB(userNpub: string): Promise<MessageStore | null> {
  try {
    const db = await initDB(userNpub);
    const storeName = `messages-${userNpub}`;
    
    // Read the entire store as one object
    const storeData = await db.get(storeName, 'messageStore');
    
    if (storeData) {
      logger.log(`Read message store from IndexedDB for user ${userNpub.slice(0, 8)}...`);
      return storeData as MessageStore;
    } else {
      logger.log(`No message store found in IndexedDB for user ${userNpub.slice(0, 8)}...`);
      return null;
    }
  } catch (error) {
    logger.error('Error reading messages from IndexedDB:', error);
    return null;
  }
}

// Write messages to IndexedDB for a specific user
export async function writeMessagesToDB(userNpub: string, messageStore: MessageStore): Promise<void> {
  try {
    const db = await initDB(userNpub);
    const storeName = `messages-${userNpub}`;
    
    // Store the entire message store as one object
    await db.put(storeName, { id: 'messageStore', ...messageStore });
    
    logger.log(`Wrote message store to IndexedDB for user ${userNpub.slice(0, 8)}... (${Object.keys(messageStore.participants).length} participants)`);
  } catch (error) {
    logger.error('Error writing messages to IndexedDB:', error);
    throw error;
  }
}
