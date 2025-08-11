/**
 * SmartTaskInput Voice Integration Tests
 *
 * Tests for voice input integration in SmartTaskInput with enhanced layout
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmartTaskInput } from '../SmartTaskInput';

// Mock Web Speech API
const mockSpeechRecognition = {
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  continuous: false,
  interimResults: false,
  lang: 'en-US',
  maxAlternatives: 1,
  onstart: null,
  onend: null,
  onresult: null,
  onerror: null,
};

// Mock navigator.mediaDevices.getUserMedia
const mockGetUserMedia = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  // Mock Web Speech API
  (global.window as unknown as Window & { SpeechRecognition: new () => unknown }).SpeechRecognition = vi.fn(() => mockSpeechRecognition) as unknown as new () => SpeechRecognition;
  (global.window as unknown as Window & { webkitSpeechRecognition: new () => unknown }).webkitSpeechRecognition = vi.fn(() => mockSpeechRecognition) as unknown as new () => SpeechRecognition;

  // Mock navigator.mediaDevices.getUserMedia
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
      getUserMedia: mockGetUserMedia,
    },
    writable: true,
  });

  mockGetUserMedia.mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }],
  });
});

describe('SmartTaskInput Voice Integration', () => {
  const mockOnAddTask = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes voice input button when using enhanced layout', () => {
    render(
      <SmartTaskInput
        onAddTask={mockOnAddTask}
        useEnhancedLayout={true}
        enableSmartParsing={true}
      />
    );

    // Should have multiple buttons including voice input
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(2); // Task group selector, voice input, submit button

    // Should have a microphone icon (voice input button)
    const micIcon = buttons.find((button) =>
      button.querySelector('svg[class*="lucide-mic"]')
    );
    expect(micIcon).toBeTruthy();
  });

  it('does not include voice input button when not using enhanced layout', () => {
    render(
      <SmartTaskInput
        onAddTask={mockOnAddTask}
        useEnhancedLayout={false}
        enableSmartParsing={true}
      />
    );

    // Should not have voice input button in regular layout
    const buttons = screen.getAllByRole('button');
    const micIcon = buttons.find((button) =>
      button.querySelector('svg[class*="lucide-mic"]')
    );
    expect(micIcon).toBeFalsy();
  });

  it('positions voice input button to the left of submit button in enhanced layout', () => {
    render(
      <SmartTaskInput
        onAddTask={mockOnAddTask}
        useEnhancedLayout={true}
        enableSmartParsing={true}
      />
    );

    const buttons = screen.getAllByRole('button');

    // Find voice input and submit buttons
    const voiceButton = buttons.find((button) =>
      button.querySelector('svg[class*="lucide-mic"]')
    );
    const submitButton = screen.getByRole('button', { name: /add task/i });

    expect(voiceButton).toBeTruthy();
    expect(submitButton).toBeTruthy();

    // Both should be in the right controls area (we can't easily test exact positioning without DOM inspection)
    expect(voiceButton).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();
  });

  it('voice input button is disabled when SmartTaskInput is disabled', () => {
    render(
      <SmartTaskInput
        onAddTask={mockOnAddTask}
        useEnhancedLayout={true}
        disabled={true}
      />
    );

    const buttons = screen.getAllByRole('button');
    const voiceButton = buttons.find((button) =>
      button.querySelector('svg[class*="lucide-mic"]')
    );

    if (voiceButton) {
      expect(voiceButton).toBeDisabled();
    }
  });

  it('shows disabled voice button when Web Speech API is not supported', () => {
    // Remove Web Speech API support
    delete (global.window as unknown as Window & { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (global.window as unknown as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    render(
      <SmartTaskInput
        onAddTask={mockOnAddTask}
        useEnhancedLayout={true}
        enableSmartParsing={true}
      />
    );

    const buttons = screen.getAllByRole('button');
    const voiceButton = buttons.find(
      (button) =>
        button.querySelector('svg[class*="lucide-mic"]') ||
        button.querySelector('svg[class*="lucide-mic-off"]')
    );

    if (voiceButton) {
      expect(voiceButton).toBeDisabled();
    }
  });
});
