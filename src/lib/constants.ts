// Loading phase constants
export const LOADING_PHASES = {
  IDLE: 'idle',
  CACHE: 'cache',
  RELAYS: 'relays',
  SUBSCRIPTIONS: 'subscriptions',
  READY: 'ready'
} as const;

export type LoadingPhase = typeof LOADING_PHASES[keyof typeof LOADING_PHASES];
