/**
 * VoiceInputDebug - Debug component for testing voice input functionality
 * 
 * This component provides detailed logging and state information
 * to help debug voice input issues in the browser.
 */

import React, { useState } from 'react';
import { VoiceInputButton } from './VoiceInputButton';

export const VoiceInputDebug: React.FC = () => {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleTranscriptChange = (newTranscript: string) => {
    addLog(`Final transcript: "${newTranscript}"`);
    setTranscript(newTranscript);
  };

  const handleInterimTranscript = (interim: string) => {
    addLog(`Interim transcript: "${interim}"`);
    setInterimTranscript(interim);
  };

  const clearLogs = () => {
    setLogs([]);
    setTranscript('');
    setInterimTranscript('');
  };

  return (
    <div className="p-4 border rounded-lg bg-card">
      <h3 className="text-lg font-semibold mb-4">Voice Input Debug</h3>
      
      {/* Voice Input Button */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Voice Input:</label>
        <VoiceInputButton
          onTranscriptChange={handleTranscriptChange}
          onInterimTranscript={handleInterimTranscript}
          size="default"
        />
      </div>

      {/* Current Transcripts */}
      <div className="mb-4 space-y-2">
        <div>
          <label className="block text-sm font-medium">Final Transcript:</label>
          <div className="p-2 bg-muted rounded border min-h-[40px]">
            {transcript || <span className="text-muted-foreground">No final transcript yet</span>}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium">Interim Transcript:</label>
          <div className="p-2 bg-muted/50 rounded border min-h-[40px]">
            {interimTranscript || <span className="text-muted-foreground">No interim transcript</span>}
          </div>
        </div>
      </div>

      {/* Browser Support Info */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Browser Support:</label>
        <div className="text-sm space-y-1">
          <div>SpeechRecognition: {typeof window !== 'undefined' && window.SpeechRecognition ? '✅ Supported' : '❌ Not supported'}</div>
          <div>webkitSpeechRecognition: {typeof window !== 'undefined' && window.webkitSpeechRecognition ? '✅ Supported' : '❌ Not supported'}</div>
          <div>MediaDevices: {typeof navigator !== 'undefined' && navigator.mediaDevices ? '✅ Supported' : '❌ Not supported'}</div>
        </div>
      </div>

      {/* Debug Logs */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium">Debug Logs:</label>
          <button
            onClick={clearLogs}
            className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80"
          >
            Clear Logs
          </button>
        </div>
        <div className="p-2 bg-muted rounded border max-h-40 overflow-y-auto">
          {logs.length === 0 ? (
            <span className="text-muted-foreground text-sm">No logs yet</span>
          ) : (
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="text-xs font-mono">
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="text-sm text-muted-foreground">
        <p><strong>Instructions:</strong></p>
        <ol className="list-decimal list-inside space-y-1 mt-1">
          <li>Click the microphone button to start voice input</li>
          <li>Allow microphone access when prompted</li>
          <li>Speak clearly into your microphone</li>
          <li>Watch the interim transcript update in real-time</li>
          <li>Final transcript will appear when you stop speaking</li>
          <li>Click the button again to stop recording</li>
        </ol>
      </div>
    </div>
  );
};

export default VoiceInputDebug;