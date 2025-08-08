import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from './useCommunitySettings';

describe('useCommunitySettings', () => {
  it('has correct default settings', () => {
    expect(DEFAULT_SETTINGS.requireApproval).toBe(true);
    expect(DEFAULT_SETTINGS.allowAnonymous).toBe(true);
    expect(DEFAULT_SETTINGS.moderationPolicy).toBe('moderate');
    expect(DEFAULT_SETTINGS.maxPostLength).toBe(280);
  });

  it('has proper auto-moderation defaults', () => {
    expect(DEFAULT_SETTINGS.autoModeration.enabled).toBe(false);
    expect(DEFAULT_SETTINGS.autoModeration.spamDetection).toBe(true);
    expect(DEFAULT_SETTINGS.autoModeration.profanityFilter).toBe(false);
    expect(DEFAULT_SETTINGS.autoModeration.linkValidation).toBe(true);
  });

  it('has proper notification defaults', () => {
    expect(DEFAULT_SETTINGS.notifications.newMembers).toBe(true);
    expect(DEFAULT_SETTINGS.notifications.newPosts).toBe(false);
    expect(DEFAULT_SETTINGS.notifications.reports).toBe(true);
    expect(DEFAULT_SETTINGS.notifications.mentions).toBe(true);
  });
});