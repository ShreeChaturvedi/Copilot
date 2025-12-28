/**
 * VoiceInputButton - Native Web Speech API voice input component
 *
 * Implements voice input functionality using the native Web Speech API
 * (webkitSpeechRecognition/SpeechRecognition) with browser compatibility
 * detection and graceful degradation.
 *
 * Features:
 * - Native Web Speech API integration
 * - Browser compatibility detection
 * - Continuous recognition with interim results
 * - Visual feedback during recording (pulsing animation)
 * - Proper microphone permission handling
 * - Integration with existing text parsing
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Web Speech API types are defined in src/types/webSpeechAPI.d.ts

export interface VoiceInputButtonProps {
  /** Callback when transcript is updated (final results) */
  onTranscriptChange?: (transcript: string) => void;
  /** Callback when interim transcript is updated (real-time feedback) */
  onInterimTranscript?: (interim: string) => void;
  /** Callback when recording state changes */
  onRecordingStateChange?: (isRecording: boolean) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Whether to enable continuous recognition (default: false to avoid permission issues) */
  continuous?: boolean;
  /** Custom className */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'default' | 'lg';
}

/**
 * Check if Web Speech API is supported in the current browser
 */
const isSpeechRecognitionSupported = (): boolean => {
  return !!(
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  );
};

/**
 * Get the SpeechRecognition constructor
 */
type SpeechRecognitionCtor = new () => SpeechRecognition;
const getSpeechRecognition = (): SpeechRecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  return (
    (
      window as unknown as Window & {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
      }
    ).SpeechRecognition ||
    (
      window as unknown as Window & {
        webkitSpeechRecognition?: SpeechRecognitionCtor;
      }
    ).webkitSpeechRecognition ||
    null
  );
};

/**
 * VoiceInputButton component using native Web Speech API
 */
export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscriptChange,
  onInterimTranscript,
  onRecordingStateChange,
  disabled = false,
  continuous = false, // Default to false to avoid multiple permission requests
  className,
  size = 'sm',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');

  // Use refs to avoid stale closure issues with callbacks
  const onTranscriptChangeRef = useRef(onTranscriptChange);
  const onInterimTranscriptRef = useRef(onInterimTranscript);
  const onRecordingStateChangeRef = useRef(onRecordingStateChange);

  // Keep refs updated with current callbacks
  useEffect(() => {
    onTranscriptChangeRef.current = onTranscriptChange;
  }, [onTranscriptChange]);

  useEffect(() => {
    onInterimTranscriptRef.current = onInterimTranscript;
  }, [onInterimTranscript]);

  useEffect(() => {
    onRecordingStateChangeRef.current = onRecordingStateChange;
  }, [onRecordingStateChange]);

  // Check browser support on mount
  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported());
  }, []);

  // Initialize speech recognition
  const initializeSpeechRecognition = useCallback(() => {
    const SpeechRecognitionConstructor = getSpeechRecognition();
    if (!SpeechRecognitionConstructor) return null;

    const recognition = new SpeechRecognitionConstructor();

    // Configure recognition settings for optimal task input
    recognition.continuous = continuous; // Use provided continuous setting
    recognition.interimResults = true; // Show real-time feedback
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    // Handle results (both interim and final)
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = finalTranscriptRef.current;

      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Send final results immediately
      if (finalTranscript && finalTranscript !== finalTranscriptRef.current) {
        finalTranscriptRef.current = finalTranscript;
        onTranscriptChangeRef.current?.(finalTranscript);
      }

      // Send interim results for real-time feedback
      if (interimTranscript) {
        onInterimTranscriptRef.current?.(interimTranscript);
      }
    };

    // Handle start event
    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      setPermissionDenied(false);
      finalTranscriptRef.current = '';
      onRecordingStateChangeRef.current?.(true);
    };

    // Handle end event
    recognition.onend = () => {
      setIsListening(false);
      onRecordingStateChangeRef.current?.(false);
    };

    // Handle errors
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      switch (event.error as string) {
        case 'not-allowed':
          setPermissionDenied(true);
          setError(
            'Microphone access denied. Please allow microphone access and try again.'
          );
          break;
        case 'no-speech':
          // Don't show error for no speech - this is normal
          break;
        case 'audio-capture':
          setError(
            'No microphone found. Please check your microphone connection.'
          );
          break;
        case 'network':
          setError(
            'Network error occurred. Please check your internet connection.'
          );
          break;
        case 'service-not-allowed':
          setError('Speech recognition service not allowed. Please try again.');
          break;
        case 'aborted':
          // Don't show error for aborted - user stopped it
          break;
        default:
          setError(`Speech recognition error: ${event.error}`);
      }

      setIsListening(false);
      onRecordingStateChangeRef.current?.(false);
    };

    return recognition;
  }, [continuous]);

  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported || disabled) return;

    try {
      const recognition = initializeSpeechRecognition();
      if (!recognition) {
        setError('Failed to initialize speech recognition');
        return;
      }

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setError('Failed to start voice input. Please try again.');
    }
  }, [isSupported, disabled, initializeSpeechRecognition]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Size classes
  const sizeClasses = {
    sm: 'h-8 w-8',
    default: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  // If not supported, show disabled button with tooltip
  if (!isSupported) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled
            className={cn(
              sizeClasses[size],
              'p-0 text-muted-foreground',
              className
            )}
          >
            <MicOff className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Voice input not supported in this browser</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={isListening ? 'default' : 'ghost'}
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleListening}
          disabled={disabled}
          className={cn(
            sizeClasses[size],
            'p-0 transition-all duration-200',
            isListening && [
              'bg-red-500 hover:bg-red-600 text-white',
              'animate-pulse shadow-lg shadow-red-500/25',
            ],
            permissionDenied && 'text-destructive',
            className
          )}
        >
          {isListening ? (
            <Square className="w-4 h-4" />
          ) : permissionDenied ? (
            <MicOff className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-center">
          {permissionDenied ? (
            <p>Microphone access denied</p>
          ) : error ? (
            <p>Voice input error</p>
          ) : isListening ? (
            <p>Stop recording</p>
          ) : (
            <p>Start voice input</p>
          )}
          {error && (
            <p className="text-xs text-muted-foreground mt-1 max-w-48">
              {error}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export default VoiceInputButton;
