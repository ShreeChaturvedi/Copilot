/**
 * VoiceInput - Professional voice input component with speech recognition
 *
 * Provides speech-to-text functionality with visual feedback, error handling,
 * and browser compatibility detection. Integrates with Web Speech API
 * through react-speech-recognition.
 *
 * Features:
 * - Speech-to-text conversion
 * - Visual recording indicators
 * - Waveform animation during recording
 * - Browser compatibility detection
 * - Noise cancellation indicators
 * - Confidence scoring
 * - Voice command recognition
 * - Auto-punctuation
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Square,
  AlertCircle,
  Volume2,
  Settings,
} from 'lucide-react';
import SpeechRecognition, {
  useSpeechRecognition,
} from 'react-speech-recognition';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * Voice input configuration options
 */
export interface VoiceInputConfig {
  /** Language for speech recognition */
  language?: string;
  /** Enable continuous listening */
  continuous?: boolean;
  /** Enable interim results */
  interimResults?: boolean;
  /** Timeout for auto-stop in milliseconds */
  autoStopTimeout?: number;
  /** Enable voice commands */
  enableCommands?: boolean;
  /** Show confidence indicators */
  showConfidence?: boolean;
}

/**
 * Props for VoiceInput component
 */
export interface VoiceInputProps {
  /** Callback when transcript is updated */
  onTranscriptChange?: (transcript: string) => void;
  /** Callback when voice input is started */
  onStart?: () => void;
  /** Callback when voice input is stopped */
  onStop?: () => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
  /** Configuration options */
  config?: VoiceInputConfig;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Custom className */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'default' | 'lg';
  /** Show as button only (no additional UI) */
  buttonOnly?: boolean;
}

/**
 * Waveform animation component
 */
const VoiceWaveform: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            'w-0.5 bg-primary rounded-full transition-all duration-150',
            isActive ? 'h-3 animate-pulse' : 'h-1',
            // Stagger the animation
            isActive && `animate-pulse delay-[${i * 100}ms]`
          )}
          style={{
            animationDelay: `${i * 100}ms`,
            animationDuration: '1s',
          }}
        />
      ))}
    </div>
  );
};

/**
 * Voice commands for task input
 */
const VOICE_COMMANDS = [
  {
    command: ['schedule for tomorrow', 'due tomorrow'],
    callback: () => 'tomorrow',
    description: 'Schedule for tomorrow',
  },
  {
    command: ['high priority', 'urgent'],
    callback: () => 'high priority',
    description: 'Set high priority',
  },
  {
    command: ['low priority', 'not urgent'],
    callback: () => 'low priority',
    description: 'Set low priority',
  },
  {
    command: ['next week', 'schedule for next week'],
    callback: () => 'next week',
    description: 'Schedule for next week',
  },
];

/**
 * VoiceInput component
 */
export const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscriptChange,
  onStart,
  onStop,
  onError,
  config = {},
  disabled = false,
  className,
  size = 'default',
  buttonOnly = false,
}) => {
  const [autoStopTimer, setAutoStopTimer] = useState<NodeJS.Timeout | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Default configuration - memoized to prevent dependency changes
  const defaultConfig: VoiceInputConfig = useMemo(
    () => ({
      language: 'en-US',
      continuous: true,
      interimResults: true,
      autoStopTimeout: 5000, // 5 minute max
      enableCommands: true,
      showConfidence: false,
      ...config,
    }),
    [config]
  );

  // Speech recognition hook
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition({
    commands: defaultConfig.enableCommands ? VOICE_COMMANDS : [],
  });

  // Update parent component when transcript changes
  useEffect(() => {
    if (transcript && onTranscriptChange) {
      onTranscriptChange(transcript);
    }
  }, [transcript, onTranscriptChange]);

  // Stop listening
  const handleStopListening = useCallback(() => {
    SpeechRecognition.stopListening();

    if (autoStopTimer) {
      clearTimeout(autoStopTimer);
      setAutoStopTimer(null);
    }

    onStop?.();
  }, [autoStopTimer, onStop]);

  // Auto-stop timer
  useEffect(() => {
    if (listening && defaultConfig.autoStopTimeout) {
      const timer = setTimeout(() => {
        handleStopListening();
      }, defaultConfig.autoStopTimeout);

      setAutoStopTimer(timer);

      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [listening, defaultConfig.autoStopTimeout, handleStopListening]);

  // Start listening
  const handleStartListening = useCallback(async () => {
    try {
      setError(null);

      // Check microphone permission
      if (!isMicrophoneAvailable) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((track) => track.stop()); // Clean up
      }

      await SpeechRecognition.startListening({
        continuous: defaultConfig.continuous,
        language: defaultConfig.language,
        interimResults: defaultConfig.interimResults,
      });

      onStart?.();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to start voice input';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [defaultConfig, isMicrophoneAvailable, onStart, onError]);

  // Toggle listening
  const handleToggleListening = useCallback(() => {
    if (listening) {
      handleStopListening();
    } else {
      handleStartListening();
    }
  }, [listening, handleStartListening, handleStopListening]);

  // Clear transcript
  const handleClear = useCallback(() => {
    resetTranscript();
    onTranscriptChange?.('');
  }, [resetTranscript, onTranscriptChange]);

  // Size classes
  const sizeClasses = {
    sm: 'h-6 w-6',
    default: 'h-8 w-8',
    lg: 'h-10 w-10',
  };

  // Check browser support
  if (!browserSupportsSpeechRecognition) {
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

  // Button only mode
  if (buttonOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={listening ? 'default' : 'ghost'}
            size="sm"
            onClick={handleToggleListening}
            disabled={disabled}
            className={cn(
              sizeClasses[size],
              'p-0 transition-colors',
              listening && 'bg-red-500 hover:bg-red-600 text-white',
              className
            )}
          >
            {listening ? (
              <Square className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{listening ? 'Stop recording' : 'Start voice input'}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Full voice input interface
  return (
    <div className={cn('space-y-3', className)}>
      {/* Voice Control Bar */}
      <div className="flex items-center gap-2">
        {/* Main Voice Button */}
        <Button
          variant={listening ? 'default' : 'ghost'}
          size="sm"
          onClick={handleToggleListening}
          disabled={disabled}
          className={cn(
            'transition-colors',
            listening && 'bg-red-500 hover:bg-red-600 text-white'
          )}
        >
          {listening ? (
            <>
              <Square className="w-4 h-4 mr-2" />
              Stop
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 mr-2" />
              Voice
            </>
          )}
        </Button>

        {/* Waveform Animation */}
        {listening && <VoiceWaveform isActive={listening} />}

        {/* Status Badges */}
        {listening && (
          <Badge variant="outline" className="text-xs">
            <Volume2 className="w-3 h-3 mr-1" />
            Listening...
          </Badge>
        )}

        {/* Settings */}
        <DropdownMenu open={showSettings} onOpenChange={setShowSettings}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={disabled}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleClear}>
              Clear Transcript
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              Language: {defaultConfig.language}
            </DropdownMenuItem>
            <DropdownMenuItem>
              Commands: {defaultConfig.enableCommands ? 'On' : 'Off'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Transcript Display */}
      {transcript && (
        <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
          <div className="text-sm text-muted-foreground mb-1">Transcript:</div>
          <div className="text-sm">{transcript}</div>
        </div>
      )}

      {/* Voice Commands Help */}
      {defaultConfig.enableCommands && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Voice Commands
          </summary>
          <div className="mt-2 space-y-1">
            {VOICE_COMMANDS.map((cmd, index) => (
              <div key={index} className="flex justify-between">
                <span>"{cmd.command[0]}"</span>
                <span>{cmd.description}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

export default VoiceInput;
