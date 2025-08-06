import type { MessageItemConfig } from "../BaseMessageItem";

export const groupMessageItemConfig: MessageItemConfig = {
  showContextMenu: true,
  showReactions: true,
  showThreadReply: true,
  showPin: true,
  showDelete: true,
  showBan: true,
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
