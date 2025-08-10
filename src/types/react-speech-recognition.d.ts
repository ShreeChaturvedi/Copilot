declare module 'react-speech-recognition' {
  export interface SpeechRecognitionOptions {
    transcribing?: boolean;
    clearTranscriptOnListen?: boolean;
    commands?: Array<{
      command: string | string[];
      callback: (command: string, ...args: any[]) => void;
      isFuzzyMatch?: boolean;
      matchInterim?: boolean;
      fuzzyMatchingThreshold?: number;
    }>;
  }

  export interface SpeechRecognitionResult {
    transcript: string;
    interimTranscript: string;
    finalTranscript: string;
    listening: boolean;
    resetTranscript: () => void;
    browserSupportsSpeechRecognition: boolean;
    isMicrophoneAvailable: boolean;
  }

  const useSpeechRecognition: (options?: SpeechRecognitionOptions) => SpeechRecognitionResult;
  
  const SpeechRecognition: {
    startListening: (options?: { continuous?: boolean; language?: string; interimResults?: boolean }) => Promise<void>;
    stopListening: () => void;
    abortListening: () => void;
    browserSupportsSpeechRecognition: () => boolean;
  };

  export default SpeechRecognition;
  export { useSpeechRecognition };
}