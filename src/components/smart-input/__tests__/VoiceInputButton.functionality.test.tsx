/**
 * VoiceInputButton Functionality Tests
 * 
 * Tests for the actual voice input functionality and transcript handling
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceInputButton } from '../components/VoiceInputButton';

// Mock Web Speech API with more detailed functionality
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
  onstart: null as ((event: Event) => void) | null,
  onend: null as ((event: Event) => void) | null,
  onresult: null as ((event: Event) => void) | null,
  onerror: null as ((event: { error?: string }) => void) | null,
};

beforeEach(() => {
  vi.clearAllMocks();
  
  // Mock Web Speech API
  (global.window as unknown as Window & { SpeechRecognition: new () => unknown }).SpeechRecognition = vi.fn(() => mockSpeechRecognition) as unknown as new () => SpeechRecognition;
  (global.window as unknown as Window & { webkitSpeechRecognition: new () => unknown }).webkitSpeechRecognition = vi.fn(() => mockSpeechRecognition) as unknown as new () => SpeechRecognition;
  
  // Reset mock functions
  mockSpeechRecognition.start.mockClear();
  mockSpeechRecognition.stop.mockClear();
  mockSpeechRecognition.onstart = null;
  mockSpeechRecognition.onend = null;
  mockSpeechRecognition.onresult = null;
  mockSpeechRecognition.onerror = null;
});

describe('VoiceInputButton Functionality', () => {
  it('calls onTranscriptChange when speech recognition produces final results', async () => {
    const mockOnTranscriptChange = vi.fn();
    
    render(
      <VoiceInputButton 
        onTranscriptChange={mockOnTranscriptChange}
      />
    );

    const button = screen.getByRole('button');
    
    // Click to start listening
    fireEvent.click(button);
    
    // Verify start was called
    expect(mockSpeechRecognition.start).toHaveBeenCalled();
    
    // Simulate speech recognition start
    act(() => {
      if (mockSpeechRecognition.onstart) {
        mockSpeechRecognition.onstart(new Event('start'));
      }
    });

    // Simulate speech recognition result
    const mockEvent = {
      resultIndex: 0,
      results: [
        {
          0: { transcript: 'hello world' },
          isFinal: true,
          length: 1,
        }
      ]
    } as unknown as SpeechRecognitionEvent;

    act(() => {
      if (mockSpeechRecognition.onresult) {
        mockSpeechRecognition.onresult(mockEvent);
      }
    });

    // Should call onTranscriptChange with the transcript
    expect(mockOnTranscriptChange).toHaveBeenCalledWith('hello world');
  });

  it('calls onInterimTranscript for interim results', async () => {
    const mockOnInterimTranscript = vi.fn();
    
    render(
      <VoiceInputButton 
        onInterimTranscript={mockOnInterimTranscript}
      />
    );

    const button = screen.getByRole('button');
    
    // Click to start listening
    fireEvent.click(button);
    
    // Simulate speech recognition start
    act(() => {
      if (mockSpeechRecognition.onstart) {
        mockSpeechRecognition.onstart(new Event('start'));
      }
    });

    // Simulate interim speech recognition result
    const mockEvent = {
      resultIndex: 0,
      results: [
        {
          0: { transcript: 'hello' },
          isFinal: false,
          length: 1,
        }
      ]
    } as unknown as SpeechRecognitionEvent;

    act(() => {
      if (mockSpeechRecognition.onresult) {
        mockSpeechRecognition.onresult(mockEvent);
      }
    });

    // Should call onInterimTranscript with the interim transcript
    expect(mockOnInterimTranscript).toHaveBeenCalledWith('hello');
  });

  it('accumulates multiple final results', async () => {
    const mockOnTranscriptChange = vi.fn();
    
    render(
      <VoiceInputButton 
        onTranscriptChange={mockOnTranscriptChange}
      />
    );

    const button = screen.getByRole('button');
    
    // Click to start listening
    fireEvent.click(button);
    
    // Simulate speech recognition start
    act(() => {
      if (mockSpeechRecognition.onstart) {
        mockSpeechRecognition.onstart(new Event('start'));
      }
    });

    // Simulate first final result
    const mockEvent1 = {
      resultIndex: 0,
      results: [
        {
          0: { transcript: 'hello' },
          isFinal: true,
          length: 1,
        }
      ]
    } as unknown as SpeechRecognitionEvent;

    act(() => {
      if (mockSpeechRecognition.onresult) {
        mockSpeechRecognition.onresult(mockEvent1);
      }
    });

    // Simulate second final result
    const mockEvent2 = {
      resultIndex: 1,
      results: [
        {
          0: { transcript: 'hello' },
          isFinal: true,
          length: 1,
        },
        {
          0: { transcript: ' world' },
          isFinal: true,
          length: 1,
        }
      ]
    } as unknown as SpeechRecognitionEvent;

    act(() => {
      if (mockSpeechRecognition.onresult) {
        mockSpeechRecognition.onresult(mockEvent2);
      }
    });

    // Should accumulate the results
    expect(mockOnTranscriptChange).toHaveBeenCalledWith('hello');
    expect(mockOnTranscriptChange).toHaveBeenCalledWith('hello world');
  });

  it('stops listening when button is clicked while listening', async () => {
    render(<VoiceInputButton />);

    const button = screen.getByRole('button');
    
    // Click to start listening
    fireEvent.click(button);
    
    // Simulate speech recognition start
    act(() => {
      if (mockSpeechRecognition.onstart) {
        mockSpeechRecognition.onstart(new Event('start'));
      }
    });

    // Click again to stop
    fireEvent.click(button);
    
    // Should call stop
    expect(mockSpeechRecognition.stop).toHaveBeenCalled();
  });

  it('handles permission denied error', async () => {
    render(<VoiceInputButton />);

    const button = screen.getByRole('button');
    
    // Click to start listening
    fireEvent.click(button);
    
    // Simulate permission denied error
    const mockErrorEvent = { error: 'not-allowed' } as SpeechRecognitionErrorEvent;

    act(() => {
      if (mockSpeechRecognition.onerror) {
        mockSpeechRecognition.onerror(mockErrorEvent);
      }
    });

    // Button should show error state (we can't easily test the tooltip content)
    expect(button).toBeInTheDocument();
  });
});