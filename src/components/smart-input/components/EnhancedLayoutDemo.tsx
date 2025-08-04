/**
 * Demo component showing the EnhancedLayoutWrapper in action
 * 
 * This demonstrates the Claude AI-inspired layout with:
 * - Large textarea at the top
 * - Controls positioned below the input
 * - Card container with focus states
 * - Multi-line input with highlighting
 */

import React, { useState } from 'react';
import { ArrowUp, Plus, Brain } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EnhancedTaskInputLayout } from './EnhancedTaskInputLayout';
import { useTextParser } from '../hooks/useTextParser';

export const EnhancedLayoutDemo: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [enableSmartParsing, setEnableSmartParsing] = useState(true);

  // Initialize text parser
  const {
    tags,
    confidence,
    clear,
  } = useTextParser(inputText, {
    enabled: enableSmartParsing,
    debounceMs: 100,
    minLength: 2,
  });

  // Handle input change
  const handleInputChange = (value: string) => {
    setInputText(value);
  };

  // Handle form submission
  const handleSubmit = () => {
    if (inputText.trim()) {
      console.log('Task submitted:', {
        text: inputText,
        tags,
        confidence,
      });
      
      // Clear input
      setInputText('');
      clear();
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Left side controls
  const leftControls = (
    <>
      {/* Task Group Selector (placeholder) */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        aria-label="Task group selector"
      >
        <Plus className="w-4 h-4" />
      </Button>

      {/* Smart Parsing Toggle */}
      <Button
        type="button"
        variant={enableSmartParsing ? "default" : "ghost"}
        size="sm"
        className="h-7 px-2"
        onClick={() => setEnableSmartParsing(!enableSmartParsing)}
        aria-label="Toggle smart parsing"
      >
        <Brain className="w-4 h-4 mr-1" />
        {enableSmartParsing && <span className="text-xs">Autotag</span>}
      </Button>
    </>
  );

  // Right side controls
  const rightControls = (
    <Button
      type="button"
      disabled={!inputText.trim()}
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0"
      aria-label="Submit task"
      onClick={handleSubmit}
    >
      <ArrowUp className="w-4 h-4" />
    </Button>
  );

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Enhanced Task Input Demo</h2>
        <p className="text-muted-foreground">
          Claude AI-inspired layout with multi-line input and smart parsing
        </p>
      </div>

      <div className="space-y-4">
        <EnhancedTaskInputLayout
          value={inputText}
          onChange={handleInputChange}
          tags={tags}
          placeholder="Enter a new task... (Try typing 'high priority meeting tomorrow at 2pm')"
          onKeyPress={handleKeyPress}
          confidence={confidence}
          showConfidence={true}
          enableSmartParsing={enableSmartParsing}
          leftControls={leftControls}
          rightControls={rightControls}
          minHeight="120px"
          maxHeight="300px"
        />

        {/* Demo info */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Features demonstrated:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Multi-line textarea with auto-resize</li>
            <li>Text highlighting for parsed tags (dates, priorities, etc.)</li>
            <li>Card container with focus states</li>
            <li>Controls positioned below input (Claude AI pattern)</li>
            <li>Smart parsing toggle with visual feedback</li>
            <li>Submit with Cmd/Ctrl + Enter</li>
          </ul>
          
          {tags.length > 0 && (
            <div className="mt-4 p-3 bg-muted/50 rounded-md">
              <p><strong>Parsed tags:</strong></p>
              <pre className="text-xs mt-1 overflow-x-auto">
                {JSON.stringify(tags.map(tag => ({
                  type: tag.type,
                  value: tag.value,
                  // text: tag.text, // ParsedTag doesn't have text property
                  confidence: Math.round(tag.confidence * 100) + '%'
                })), null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedLayoutDemo;