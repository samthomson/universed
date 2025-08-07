import type { MessageItemConfig } from "../BaseMessageItem";

export const groupMessageItemConfig: MessageItemConfig = {
  showContextMenu: true,
  showReactions: true,
  showThreadReply: true,
  showPin: true,
  showDelete: true,
  showBan: false, // Will be controlled by role-based logic
  showReport: true, // Add report option
};

export const groupMessageListConfig = {
  showPinnedMessages: true,
  showAvatars: true,
};

export const groupMessageInputConfig = {
  allowMentions: true,
  allowFileUpload: true,
  allowEmoji: true,
};
