import { logger } from './logger';

/**
 * DataManager - Centralized data management singleton
 * 
 * This class provides a centralized data layer that sits above the React component tree,
 * managing persistent subscriptions, complex data processing, and cross-component coordination
 * while working alongside React Query for caching and UI state management.
 */
// DataManager state interface
export interface DataManagerState {
  isLoadingApp: boolean;
  communities: unknown[]; // TODO: Replace with proper Community type
  // TODO: Add more data types as needed:
  // messages: Message[];
  // notifications: Notification[];
  // channels: Channel[];
}

// Generic state emitter for DataManager state changes
class StateEmitter<T> {
  private listeners: Set<(state: T) => void> = new Set();

  subscribe(callback: (state: T) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit(state: T) {
    this.listeners.forEach(callback => callback(state));
  }
}

export class DataManager {
  private static instance: DataManager | null = null;
  
  // Debug flag - set to true to enable debug features
  public static readonly IS_DEBUGGING = true;
  
  // Unified state management
  private state: DataManagerState = {
    isLoadingApp: true,
    communities: [],
  };
  private loadingPromise: Promise<void> | null = null;
  private stateEmitter = new StateEmitter<DataManagerState>();

  // Private constructor to prevent direct instantiation
  private constructor() {
    // Initialize any base properties here when we add them
  }

  /**
   * Update state and notify all subscribers
   */
  private updateState(updates: Partial<DataManagerState>): void {
    this.state = { ...this.state, ...updates };
    this.stateEmitter.emit(this.state);
  }

  /**
   * Initialize the DataManager and start loading app data
   * This should be called once when the app starts
   */
  public async startLoadingApp(): Promise<void> {
    if (this.loadingPromise) {
      // Already loading, return existing promise
      return this.loadingPromise;
    }

    logger.log('[DataManager] Starting app initialization...');
    this.updateState({ isLoadingApp: true });

    this.loadingPromise = this.performInitialLoading();
    
    try {
      await this.loadingPromise;
      this.updateState({ isLoadingApp: false });
      logger.log('[DataManager] App initialization completed!');
    } catch (error) {
      logger.error('[DataManager] App initialization failed:', error);
      this.updateState({ isLoadingApp: false });
      throw error;
    }
  }

  /**
   * Perform the actual initial loading tasks
   */
  private async performInitialLoading(): Promise<void> {
    logger.log('[DataManager] Performing initial data loading...');
    
    // TODO: Load initial app data in parallel
    await Promise.all([
      this.loadCommunities(),
      // TODO: Add more loading tasks:
      // this.loadRecentMessages(),
      // this.loadFriendLists(),
      // this.initializeNIP17Processing(),
      // this.loadCachedEvents(),
      // this.setupPersistentSubscriptions(),
    ]);
    
    logger.log('[DataManager] Initial data loading completed');
  }

  /**
   * Load user communities
   */
  private async loadCommunities(): Promise<void> {
    logger.log('[DataManager] Loading communities...');
    
    // Placeholder: Simulate loading with delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // TODO: Replace with actual community loading logic
    const mockCommunities = [
      { id: '1', name: 'General', memberCount: 42 },
      { id: '2', name: 'Development', memberCount: 15 },
      { id: '3', name: 'Random', memberCount: 28 },
    ];
    
    this.updateState({ communities: mockCommunities });
    logger.log('[DataManager] Communities loaded:', mockCommunities.length);
  }

  /**
   * Get current DataManager state
   */
  public getState(): DataManagerState {
    return { ...this.state }; // Return a copy to prevent mutations
  }

  /**
   * Get current app loading state (convenience method)
   */
  public getIsLoadingApp(): boolean {
    return this.state.isLoadingApp;
  }

  /**
   * Subscribe to all state changes
   */
  public subscribeToState(callback: (state: DataManagerState) => void): () => void {
    return this.stateEmitter.subscribe(callback);
  }

  /**
   * Handle NIP17 enabled setting change
   * This will be called by the DataManagerProvider when settings change
   */
  public onNIP17EnabledChanged(enabled: boolean) {
    logger.log(`[DataManager] NIP17 enabled changed to: ${enabled}`);
    
    if (enabled) {
      this.startNIP17Processing();
    } else {
      this.stopNIP17Processing();
    }
  }

  /**
   * Start NIP17 message processing
   */
  private startNIP17Processing() {
    logger.log('[DataManager] Starting NIP17 processing...');
    // TODO: Implement NIP17 subscription startup
  }

  /**
   * Stop NIP17 message processing
   */
  private stopNIP17Processing() {
    logger.log('[DataManager] Stopping NIP17 processing...');
    // TODO: Implement NIP17 subscription cleanup
  }

  /**
   * Get the singleton instance of DataManager
   * Creates the instance if it doesn't exist
   */
  public static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   * @internal
   */
  public static resetInstance(): void {
    DataManager.instance = null;
  }

  /**
   * Check if the singleton instance exists
   */
  public static hasInstance(): boolean {
    return DataManager.instance !== null;
  }

  /**
   * Cleanup DataManager resources
   * Called when app unmounts (mainly for development)
   */
  public cleanup(): void {
    logger.log('[DataManager] Cleaning up resources...');
    // TODO: Cleanup subscriptions, close connections, clear caches
    // - Close WebSocket connections
    // - Clear React Query caches
    // - Cancel pending promises
    // - Remove event listeners
  }

  /**
   * Get debug information about the DataManager state
   * @returns Debug information object
   */
  public getDebugInfo(): Record<string, unknown> {
    return {
      status: this.state.isLoadingApp ? "loading" : "initialized",
      timestamp: new Date().toISOString(),
      message: this.state.isLoadingApp ? "DataManager is loading app data..." : "DataManager singleton is working!",
      state: this.state,
      hasLoadingPromise: this.loadingPromise !== null,
      activeSubscriptions: 0,
      cachedMessages: 0,
      processedNIP17Events: 0,
    };
  }
}
