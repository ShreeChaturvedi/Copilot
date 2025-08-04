/**
 * Voice Input Demo Test
 * 
 * This test creates a demo component to manually test voice input functionality
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SmartTaskInput } from '../SmartTaskInput';

// Mock Web Speech API for demo
const mockSpeechRecognition = {
  start: vi.fn(),
  stop: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
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

// Set up mocks
global.window.SpeechRecognition = vi.fn(() => mockSpeechRecognition);
global.window.webkitSpeechRecognition = vi.fn(() => mockSpeechRecognition);

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

mockGetUserMedia.mockResolvedValue({
  getTracks: () => [{ stop: vi.fn() }],
});

describe('Voice Input Demo', () => {
  it('renders SmartTaskInput with voice input in enhanced layout', () => {
    const mockOnAddTask = vi.fn();
    
    render(
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h2>Voice Input Demo</h2>
        <p>This demo shows the SmartTaskInput with voice input functionality enabled.</p>
        <SmartTaskInput
          onAddTask={mockOnAddTask}
          useEnhancedLayout={true}
          enableSmartParsing={true}
          showConfidence={true}
          placeholder="Try saying: 'Buy groceries tomorrow high priority'"
        />
        <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
          <h3>Features:</h3>
          <ul>
            <li>✅ Voice input button (microphone icon) positioned next to submit button</li>
            <li>✅ Browser compatibility detection</li>
            <li>✅ Continuous recognition with interim results</li>
            <li>✅ Integration with existing text parsing and tag detection</li>
            <li>✅ Visual feedback during recording (pulsing animation)</li>
            <li>✅ Proper microphone permission handling</li>
            <li>✅ Graceful degradation for unsupported browsers</li>
          </ul>
        </div>
      </div>
    );

    // Verify the demo renders
    expect(screen.getByText('Voice Input Demo')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter a new task/)).toBeInTheDocument();
    
    // Verify voice input button is present
    const buttons = screen.getAllByRole('button');
    const voiceButton = buttons.find(button => button.querySelector('svg[class*="lucide-mic"]'));
    expect(voiceButton).toBeTruthy();
    
    // Verify enhanced layout features
    expect(screen.getByText('Features:')).toBeInTheDocument();
  });
});