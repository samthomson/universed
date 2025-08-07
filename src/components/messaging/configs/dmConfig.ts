import type { MessageItemConfig } from "../BaseMessageItem";

export const dmMessageItemConfig: MessageItemConfig = {
  showContextMenu: true,
  showReactions: true,
  showThreadReply: false,
  showPin: false,
  showDelete: true,
  showBan: false,
  showReport: true,
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
