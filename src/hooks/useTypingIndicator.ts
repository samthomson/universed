export function useTypingManager(_channelId: string) {
  return {
    startTyping: () => {},
    stopTyping: () => {},
    isCurrentlyTyping: false,
  };
}