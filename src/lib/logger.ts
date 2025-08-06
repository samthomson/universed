/**
 * Centralized logging utility that only logs in development (except errors)
 */
export const logger = {
  log: (message: string, ...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.log(message, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.warn(message, ...args);
    }
  },
  error: (message: string, ...args: unknown[]) => {
    // Always log errors, even in production
    console.error(message, ...args);
  }
};