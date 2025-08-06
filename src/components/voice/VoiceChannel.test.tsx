import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { VoiceChannel } from './VoiceChannel';

describe('VoiceChannel', () => {
  it('renders channel name and join button', () => {
    render(
      <TestApp>
        <VoiceChannel 
          channelId="test-channel" 
          channelName="Test Voice Channel" 
        />
      </TestApp>
    );

    expect(screen.getByText('Test Voice Channel')).toBeInTheDocument();
    expect(screen.getByText('Join')).toBeInTheDocument();
  });

  it('shows member count when no members are present', () => {
    render(
      <TestApp>
        <VoiceChannel 
          channelId="test-channel" 
          channelName="Test Voice Channel" 
        />
      </TestApp>
    );

    expect(screen.getByText(/0 members/)).toBeInTheDocument();
  });

  it('applies correct styling classes', () => {
    const { container } = render(
      <TestApp>
        <VoiceChannel 
          channelId="test-channel" 
          channelName="Test Voice Channel" 
        />
      </TestApp>
    );

    // Check for backdrop blur and Discord-like styling
    const voiceChannelContainer = container.firstChild as HTMLElement;
    expect(voiceChannelContainer).toHaveClass('backdrop-blur-sm');
    expect(voiceChannelContainer).toHaveClass('rounded-lg');
  });
});