# Optimistic Updates & Loading Skeletons Checklist

This document tracks all areas in the Universes app that need optimistic updates and loading skeletons for better user experience.

## 🔄 Optimistic Updates Needed

### Chat & Messaging
- [x] **MessageInput.tsx** - Message sending ✅
  - Show message immediately in UI before server confirmation
  - Handle failure with rollback and retry option
  - Update message status indicator (sending → sent → delivered)

- [x] **DMMessageInput.tsx** - Direct message sending ✅
  - Optimistically add DM to conversation
  - Show sending indicator
  - Handle encryption failures gracefully

- [x] **MessageReactions.tsx** - Emoji reactions ✅
  - Immediately show reaction with user's selection
  - Update count optimistically
  - Handle toggle/remove reactions

- [ ] **ThreadReplyInput.tsx** - Thread replies
  - Show reply immediately in thread
  - Update thread count optimistically

### Comments
- [x] **CommentForm.tsx** - Comment posting ✅
  - Show comment immediately after submission
  - Add "posting..." state to submitted comment
  - Handle failures with retry option

### Community Management
- [x] **CreateCommunityDialog.tsx** - Community creation ✅
  - Add community to list immediately
  - Show "creating..." state on new community card
  - Navigate to community on success

- [ ] **CreateChannelDialog.tsx** - Channel creation
  - Add channel to sidebar immediately
  - Show creating indicator

- [ ] **JoinRequestDialog.tsx** - Join requests
  - Update UI immediately when approving/rejecting
  - Show pending state during processing

### Moderation
- [x] **ModerationQueue.tsx** - Moderation actions ✅
  - Optimistically update queue when approving/deleting/banning
  - Remove items from queue immediately
  - Show undo option for accidental actions

- [ ] **BulkModerationActions.tsx** - Bulk actions
  - Update UI for all selected items immediately
  - Show progress indicator for bulk operations

### Social Features
- [x] **FriendsPanel.tsx** - Friend management ✅
  - Add/remove friends optimistically
  - Update petnames immediately
  - Show pending state for friend requests

- [ ] **UserProfile.tsx** - Follow actions
  - Update follow button state immediately
  - Update follower count optimistically

### Marketplace
- [ ] **CreateMarketplaceItemDialog.tsx** - Item creation
  - Add item to marketplace grid immediately
  - Show "publishing..." state on new item

- [ ] **MarketplaceSpace.tsx** - Item interactions
  - Optimistic updates for favoriting/bookmarking items
  - Immediate UI feedback for purchase initiation

### File Uploads
- [ ] **FileUploadDialog.tsx** - File uploads
  - Show upload progress immediately
  - Display file preview before upload completes
  - Handle upload failures with retry

## 💀 Loading Skeletons Needed

### Lists & Feeds
- [x] **MessageList.tsx** - Has skeleton ✅
- [x] **ModerationQueue.tsx** - Has skeleton ✅
- [x] **MarketplaceSpace.tsx** - Has skeleton ✅
- [x] **FriendsPanel.tsx** - Has skeleton ✅
- [x] **DMConversationList.tsx** - Has skeleton ✅
- [x] **MemberList.tsx** - Has skeleton ✅
- [x] **PinnedMessages.tsx** - Has skeleton ✅

### Profile & User Data
- [x] **UserProfile.tsx** - Has skeleton for posts ✅
- [ ] **UserProfileDialog.tsx** - Needs skeleton for profile data
- [ ] **EditProfileForm.tsx** - Needs skeleton for form fields

### Comments & Threads
- [x] **CommentsSection.tsx** - Has skeleton ✅
- [ ] **MessageThread.tsx** - Needs skeleton for thread messages

### Discovery & Search
- [x] **CommunityDiscovery.tsx** - Has skeleton ✅
- [ ] **GlobalSearch.tsx** - Needs skeleton for search results
- [ ] **UserSearch.tsx** - Needs skeleton for user results

### Notifications
- [x] **NotificationCenter.tsx** - Has skeleton ✅

### Resources & Spaces
- [ ] **ResourcesSpace.tsx** - Needs skeleton for resource grid
- [ ] **SpacesNavigator.tsx** - Needs skeleton for space list

### Moderation Panels
- [ ] **ModerationLogs.tsx** - Needs skeleton for log entries
- [ ] **ModerationAnalytics.tsx** - Needs skeleton for charts/stats
- [ ] **ReportsPanel.tsx** - Needs skeleton for reports list
- [ ] **UserManagement.tsx** - Needs skeleton for user list

### Settings & Forms
- [ ] **CommunitySettings.tsx** - Needs skeleton for settings sections
- [ ] **AutoModerationSettings.tsx** - Needs skeleton for rule list
- [ ] **UserSettingsDialog.tsx** - Needs skeleton for settings

## 📋 Implementation Guidelines

### Optimistic Updates Pattern
```typescript
// Example pattern for optimistic updates
const { mutate } = useMutation({
  mutationFn: async (data) => {
    // Actual API call
    return await createEvent(data);
  },
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['messages'] });

    // Snapshot previous value
    const previousMessages = queryClient.getQueryData(['messages']);

    // Optimistically update
    queryClient.setQueryData(['messages'], old => [...old, newData]);

    // Return context with snapshot
    return { previousMessages };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    queryClient.setQueryData(['messages'], context.previousMessages);
    toast.error('Failed to send message');
  },
  onSettled: () => {
    // Always refetch after error or success
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  },
});
```

### Skeleton Pattern
```typescript
// Skeleton matching component structure
if (isLoading) {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

## 🎯 Priority Order

1. **High Priority** (Core user actions)
   - Message sending (all types)
   - Comment posting
   - Reaction adding
   - Friend management

2. **Medium Priority** (Content creation)
   - Community/channel creation
   - Marketplace item creation
   - Resource uploads
   - Profile updates

3. **Low Priority** (Administrative)
   - Moderation actions
   - Settings updates
   - Analytics loading

## 📊 Progress Tracking

- Total Optimistic Updates Needed: 20
- Total Optimistic Updates Completed: 8 (40%)
- Total Skeletons Needed: 24
- Total Skeletons Completed: 13 (54%)

Last Updated: December 2024