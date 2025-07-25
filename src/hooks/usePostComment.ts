import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { NKinds, type NostrEvent } from '@nostrify/nostrify';

interface PostCommentParams {
  root: NostrEvent | URL; // The root event to comment on
  reply?: NostrEvent | URL; // Optional reply to another comment
  content: string;
  attachments?: Array<{
    url: string;
    mimeType: string;
    size: number;
    name: string;
    tags: string[][];
  }>;
}

/** Post a NIP-22 (kind 1111) comment on an event. */
export function usePostComment() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ root, reply, content, attachments = [] }: PostCommentParams) => {
      const tags: string[][] = [];

      // d-tag identifiers
      const dRoot = root instanceof URL ? '' : root.tags.find(([name]) => name === 'd')?.[1] ?? '';
      const dReply = reply instanceof URL ? '' : reply?.tags.find(([name]) => name === 'd')?.[1] ?? '';

      // Root event tags
      if (root instanceof URL) {
        tags.push(['I', root.toString()]);
      } else if (NKinds.addressable(root.kind)) {
        tags.push(['A', `${root.kind}:${root.pubkey}:${dRoot}`]);
      } else if (NKinds.replaceable(root.kind)) {
        tags.push(['A', `${root.kind}:${root.pubkey}:`]);
      } else {
        tags.push(['E', root.id]);
      }
      if (root instanceof URL) {
        tags.push(['K', root.hostname]);
      } else {
        tags.push(['K', root.kind.toString()]);
        tags.push(['P', root.pubkey]);
      }

      // Parent event tags (for replies, this is the reply target; for top-level comments, this is the root)
      const parent = reply || root;
      const dParent = reply ? dReply : dRoot;

      if (parent instanceof URL) {
        tags.push(['i', parent.toString()]);
      } else if (NKinds.addressable(parent.kind)) {
        tags.push(['a', `${parent.kind}:${parent.pubkey}:${dParent}`]);
        // When the parent event is addressable, also include an 'e' tag referencing its id
        tags.push(['e', parent.id]);
      } else if (NKinds.replaceable(parent.kind)) {
        tags.push(['a', `${parent.kind}:${parent.pubkey}:`]);
        // When the parent event is replaceable, also include an 'e' tag referencing its id
        tags.push(['e', parent.id]);
      } else {
        tags.push(['e', parent.id]);
      }
      if (parent instanceof URL) {
        tags.push(['k', parent.hostname]);
      } else {
        tags.push(['k', parent.kind.toString()]);
        tags.push(['p', parent.pubkey]);
      }

      // Add imeta tags for attached files
      attachments.forEach(file => {
        const imetaTag = ["imeta"];
        imetaTag.push(`url ${file.url}`);
        if (file.mimeType) imetaTag.push(`m ${file.mimeType}`);
        if (file.size) imetaTag.push(`size ${file.size}`);
        if (file.name) imetaTag.push(`alt ${file.name}`);

        // Add any additional tags from the upload response
        file.tags.forEach(tag => {
          if (tag[0] === 'x') imetaTag.push(`x ${tag[1]}`); // hash
          if (tag[0] === 'ox') imetaTag.push(`ox ${tag[1]}`); // original hash
        });

        tags.push(imetaTag);
      });

      // Prepare content with file URLs if there are attachments
      let messageContent = content;
      if (attachments.length > 0) {
        const fileUrls = attachments.map(file => file.url).join('\n');
        messageContent = content ? `${content}\n\n${fileUrls}` : fileUrls;
      }

      const event = await publishEvent({
        kind: 1111,
        content: messageContent,
        tags,
      });

      return event;
    },
    onMutate: async ({ root, content, attachments = [] }) => {
      if (!user) return;

      const rootId = root instanceof URL ? root.toString() : root.id;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['comments', rootId] });

      // Snapshot the previous value
      const previousComments = queryClient.getQueryData<NostrEvent[]>(['comments', rootId]);

      // Prepare content with file URLs if there are attachments
      let messageContent = content;
      if (attachments.length > 0) {
        const fileUrls = attachments.map(file => file.url).join('\n');
        messageContent = content ? `${content}\n\n${fileUrls}` : fileUrls;
      }

      // Create optimistic comment
      const optimisticComment: NostrEvent = {
        id: `optimistic-comment-${Date.now()}`,
        pubkey: user.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1111,
        tags: [], // Tags would be built same as above
        content: messageContent,
        sig: '',
      };

      // Optimistically update to the new value
      queryClient.setQueryData<NostrEvent[]>(['comments', rootId], old => {
        return [...(old || []), optimisticComment];
      });

      // Return a context object with the snapshotted value
      return { previousComments, optimisticComment, rootId };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousComments && context?.rootId) {
        queryClient.setQueryData(['comments', context.rootId], context.previousComments);
      }
    },
    onSuccess: (data, variables, context) => {
      if (context?.rootId) {
        // Replace optimistic comment with real one
        queryClient.setQueryData<NostrEvent[]>(['comments', context.rootId], old => {
          if (!old) return [data];
          return old.map(comment =>
            comment.id === context.optimisticComment.id ? data : comment
          );
        });
      }
    },
    onSettled: (_, __, { root }) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: ['comments', root instanceof URL ? root.toString() : root.id]
      });
    },
  });
}