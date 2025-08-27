import { openDB, IDBPDatabase } from 'idb';
import { logger } from './logger';

// Basic message structure for storage
interface StoredMessage {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
  kind: number;
  tags: string[][];
  sig: string;
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
export async function readMessagesFromDB(userNpub: string): Promise<StoredMessage[]> {
  try {
    const db = await initDB(userNpub);
    const storeName = `messages-${userNpub}`;
    
    const messages = await db.getAll(storeName);
    logger.log(`Read ${messages.length} messages from IndexedDB for user ${userNpub.slice(0, 8)}...`);
    
    return messages;
  } catch (error) {
    logger.error('Error reading messages from IndexedDB:', error);
    return [];
  }
}

// Write messages to IndexedDB for a specific user
export async function writeMessagesToDB(userNpub: string, messages: StoredMessage[]): Promise<void> {
  try {
    const db = await initDB(userNpub);
    const storeName = `messages-${userNpub}`;
    
    // Clear existing messages first (simple approach for now)
    await db.clear(storeName);
    
    // Add new messages
    for (const message of messages) {
      await db.add(storeName, message);
    }
    
    logger.log(`Wrote ${messages.length} messages to IndexedDB for user ${userNpub.slice(0, 8)}...`);
  } catch (error) {
    logger.error('Error writing messages to IndexedDB:', error);
    throw error;
  }
}
