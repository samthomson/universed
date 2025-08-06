import type { MessageItemConfig } from "../BaseMessageItem";

export const dmMessageItemConfig: MessageItemConfig = {
  showContextMenu: false,
  showReactions: false,
  showThreadReply: false,
  showPin: false,
  showDelete: false,
  showBan: false,
};

export const dmMessageListConfig = {
  showPinnedMessages: false,
  showAvatars: true,
};

export const dmMessageInputConfig = {
  allowMentions: false,
  allowFileUpload: true,
  allowEmoji: true,
};
