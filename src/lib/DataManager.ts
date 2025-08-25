/**
 * DataManager - Centralized data management singleton
 * 
 * This class provides a centralized data layer that sits above the React component tree,
 * managing persistent subscriptions, complex data processing, and cross-component coordination
 * while working alongside React Query for caching and UI state management.
 */
export class DataManager {
  private static instance: DataManager | null = null;
  
  // Debug flag - set to true to enable debug features
  public static readonly IS_DEBUGGING = true;

  // Private constructor to prevent direct instantiation
  private constructor() {
    // Initialize any base properties here when we add them
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
   * Get debug information about the DataManager state
   * @returns Debug information object
   */
  public getDebugInfo(): Record<string, unknown> {
    return {
      status: "initialized",
      timestamp: new Date().toISOString(),
      message: "DataManager singleton is working!",
      activeSubscriptions: 0,
      cachedMessages: 0,
      processedNIP17Events: 0,
    };
  }
}
