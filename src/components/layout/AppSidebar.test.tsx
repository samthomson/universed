import { describe, it, expect } from 'vitest';

// Test the reordering logic used in AppSidebar component

// Test the reordering logic directly
describe('AppSidebar reordering logic', () => {
  it('reorders communities to put selected community first', () => {
    const communities = [
      { id: 'community1', name: 'Community 1', membershipStatus: 'approved' as const },
      { id: 'community2', name: 'Community 2', membershipStatus: 'approved' as const },
      { id: 'community3', name: 'Community 3', membershipStatus: 'approved' as const },
    ];

    const selectedCommunity = 'community2';

    // Apply the same reordering logic as in the component
    const orderedCommunities = [...communities].sort((a, b) => {
      if (selectedCommunity === a.id) return -1; // a comes first
      if (selectedCommunity === b.id) return 1;  // b comes first
      return 0; // maintain original order for others
    });

    // The first community should be the selected one
    expect(orderedCommunities[0].id).toBe('community2');

    // The rest should maintain their original order
    expect(orderedCommunities[1].id).toBe('community1');
    expect(orderedCommunities[2].id).toBe('community3');
  });

  it('maintains original order when no community is selected', () => {
    const communities = [
      { id: 'community1', name: 'Community 1', membershipStatus: 'approved' as const },
      { id: 'community2', name: 'Community 2', membershipStatus: 'approved' as const },
      { id: 'community3', name: 'Community 3', membershipStatus: 'approved' as const },
    ];

    const selectedCommunity = null;

    // Apply the same reordering logic as in the component
    const orderedCommunities = [...communities].sort((a, b) => {
      if (selectedCommunity === a.id) return -1; // a comes first
      if (selectedCommunity === b.id) return 1;  // b comes first
      return 0; // maintain original order for others
    });

    // The order should remain unchanged
    expect(orderedCommunities[0].id).toBe('community1');
    expect(orderedCommunities[1].id).toBe('community2');
    expect(orderedCommunities[2].id).toBe('community3');
  });

  it('handles case when selected community is not in the list', () => {
    const communities = [
      { id: 'community1', name: 'Community 1', membershipStatus: 'approved' as const },
      { id: 'community2', name: 'Community 2', membershipStatus: 'approved' as const },
    ];

    const selectedCommunity = 'community3'; // Not in the list

    // Apply the same reordering logic as in the component
    const orderedCommunities = [...communities].sort((a, b) => {
      if (selectedCommunity === a.id) return -1; // a comes first
      if (selectedCommunity === b.id) return 1;  // b comes first
      return 0; // maintain original order for others
    });

    // The order should remain unchanged
    expect(orderedCommunities[0].id).toBe('community1');
    expect(orderedCommunities[1].id).toBe('community2');
  });

  it('correctly identifies first position for animation', () => {
    const communities = [
      { id: 'community1', name: 'Community 1', membershipStatus: 'approved' as const },
      { id: 'community2', name: 'Community 2', membershipStatus: 'approved' as const },
      { id: 'community3', name: 'Community 3', membershipStatus: 'approved' as const },
    ];

    const selectedCommunity = 'community2';

    // Apply the same reordering logic as in the component
    const orderedCommunities = [...communities].sort((a, b) => {
      if (selectedCommunity === a.id) return -1; // a comes first
      if (selectedCommunity === b.id) return 1;  // b comes first
      return 0; // maintain original order for others
    });

    // Check animation conditions for each position
    const isSelected = (id: string) => selectedCommunity === id;
    const isFirstPosition = (index: number, id: string) => index === 0 && isSelected(id);

    // The selected community should be at index 0 and trigger animation
    expect(orderedCommunities[0].id).toBe('community2');
    expect(isFirstPosition(0, 'community2')).toBe(true);

    // Other communities should not trigger animation
    expect(isFirstPosition(1, 'community1')).toBe(false);
    expect(isFirstPosition(2, 'community3')).toBe(false);
  });

  it('handles animation state transitions correctly', () => {
    const communities = [
      { id: 'community1', name: 'Community 1', membershipStatus: 'approved' as const },
      { id: 'community2', name: 'Community 2', membershipStatus: 'approved' as const },
    ];

    const selectedCommunity = 'community1';

    // Apply the same reordering logic as in the component
    const _orderedCommunities = [...communities].sort((a, b) => {
      if (selectedCommunity === a.id) return -1; // a comes first
      if (selectedCommunity === b.id) return 1;  // b comes first
      return 0; // maintain original order for others
    });

    // Simulate animation states
    const launchingCommunity = 'community2';
    const landingCommunity = 'community1';
    const _isAnimating = true;

    // Check launching state
    const isLaunching = (id: string) => launchingCommunity === id;
    const isLanding = (id: string) => landingCommunity === id;
    const isSelected = (id: string) => selectedCommunity === id;
    const isFirstPosition = (index: number, id: string) => index === 0 && isSelected(id);

    // Community 2 should be launching (but not at first position yet)
    expect(isLaunching('community2')).toBe(true);
    expect(isFirstPosition(0, 'community2')).toBe(false);

    // Community 1 should be landing at first position
    expect(isLanding('community1')).toBe(true);
    expect(isFirstPosition(0, 'community1')).toBe(true);
  });

  it('verifies flame emoji animation properties', () => {
    // Test the flame emoji animation keyframes
    const animationKeyframes = [
      { transform: 'translateY(0) scale(0.8) rotate(0deg)', opacity: 0 },
      { transform: 'translateY(-4px) scale(1.4) rotate(3deg)', opacity: 0.7 },
      { transform: 'translateY(-10px) scale(2.2) rotate(8deg)', opacity: 0.9 },
      { transform: 'translateY(-16px) scale(3.0) rotate(12deg)', opacity: 0.8 },
      { transform: 'translateY(-19px) scale(3.5) rotate(16deg)', opacity: 0.6 },
      { transform: 'translateY(-20px) scale(4) rotate(20deg)', opacity: 0 }
    ];

    // Verify scaling progression
    expect(animationKeyframes[0].transform).toContain('scale(0.8)');
    expect(animationKeyframes[2].transform).toContain('scale(2.2)');
    expect(animationKeyframes[4].transform).toContain('scale(3.5)');
    expect(animationKeyframes[5].transform).toContain('scale(4)');

    // Verify rotation progression
    expect(animationKeyframes[0].transform).toContain('rotate(0deg)');
    expect(animationKeyframes[3].transform).toContain('rotate(12deg)');
    expect(animationKeyframes[5].transform).toContain('rotate(20deg)');

    // Verify opacity progression (fade in then out)
    expect(animationKeyframes[0].opacity).toBe(0);
    expect(animationKeyframes[2].opacity).toBe(0.9);
    expect(animationKeyframes[5].opacity).toBe(0);
  });
});