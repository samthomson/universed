import { logger } from './logger';

/**
 * DataManager - Centralized data management singleton
 * 
 * This class provides a centralized data layer that sits above the React component tree,
 * managing persistent subscriptions, complex data processing, and cross-component coordination
 * while working alongside React Query for caching and UI state management.
 */
// Simple event emitter for loading state changes
class LoadingStateEmitter {
  private listeners: Set<(isLoading: boolean) => void> = new Set();

  subscribe(callback: (isLoading: boolean) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit(isLoading: boolean) {
    this.listeners.forEach(callback => callback(isLoading));
  }
}

export class DataManager {
  private static instance: DataManager | null = null;
  
  // Debug flag - set to true to enable debug features
  public static readonly IS_DEBUGGING = true;
  
  // App loading state
  private isLoadingApp: boolean = true;
  private loadingPromise: Promise<void> | null = null;
  private loadingEmitter = new LoadingStateEmitter();

  // Private constructor to prevent direct instantiation
  private constructor() {
    // Initialize any base properties here when we add them
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
    this.isLoadingApp = true;

    this.loadingPromise = this.performInitialLoading();
    
    try {
      await this.loadingPromise;
      this.isLoadingApp = false;
      this.loadingEmitter.emit(false);
      logger.log('[DataManager] App initialization completed!');
    } catch (error) {
      logger.error('[DataManager] App initialization failed:', error);
      this.isLoadingApp = false;
      this.loadingEmitter.emit(false);
      throw error;
    }
  }

  /**
   * Perform the actual initial loading tasks
   */
  private async performInitialLoading(): Promise<void> {
    logger.log('[DataManager] Performing initial data loading...');
    
    // TODO: Load initial app data
    // - Load user communities
    // - Load recent messages
    // - Load friend lists
    // - Initialize NIP17 processing if enabled
    // - Load cached events
    // - Set up persistent subscriptions
    
    // Placeholder: Simulate heavy loading with 1.5 second delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    logger.log('[DataManager] Initial data loading completed');
  }

  /**
   * Get current app loading state
   */
  public getIsLoadingApp(): boolean {
    return this.isLoadingApp;
  }

  /**
   * Subscribe to loading state changes
   */
  public subscribeToLoadingState(callback: (isLoading: boolean) => void): () => void {
    return this.loadingEmitter.subscribe(callback);
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
      status: this.isLoadingApp ? "loading" : "initialized",
      timestamp: new Date().toISOString(),
      message: this.isLoadingApp ? "DataManager is loading app data..." : "DataManager singleton is working!",
      isLoadingApp: this.isLoadingApp,
      hasLoadingPromise: this.loadingPromise !== null,
      activeSubscriptions: 0,
      cachedMessages: 0,
      processedNIP17Events: 0,
    };
  }
}
