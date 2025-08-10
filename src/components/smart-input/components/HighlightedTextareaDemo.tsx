/**
 * Demo component for testing HighlightedTextareaField functionality
 * This component allows manual testing of all textarea features
 */

import React, { useState } from 'react';
import { HighlightedTextareaField } from './HighlightedTextareaField';
import { ParsedTag } from "@shared/types";

export const HighlightedTextareaDemo: React.FC = () => {
  const [value, setValue] = useState(
    'Line 1: high priority task\nLine 2: due tomorrow at 3pm\nLine 3: meet @john at office\nLine 4: #project-alpha milestone'
  );
  
  const [showConfidence, setShowConfidence] = useState(true);

  // Mock tags for demonstration
  const mockTags: ParsedTag[] = [
    {
      id: '1',
      type: 'priority' as const,
      value: 'high',
      displayText: 'high',
      iconName: 'AlertTriangle',
      startIndex: value.indexOf('high'),
      endIndex: value.indexOf('high') + 4,
      originalText: 'high',
      confidence: 0.9,
      source: 'priority-parser',
      color: '#ef4444'
    },
    {
      id: '2',
      type: 'date' as const,
      value: new Date('2024-01-15'),
      displayText: 'tomorrow',
      iconName: 'Calendar',
      startIndex: value.indexOf('tomorrow'),
      endIndex: value.indexOf('tomorrow') + 8,
      originalText: 'tomorrow',
      confidence: 0.8,
      source: 'date-parser',
      color: '#3b82f6'
    },
    {
      id: '3',
      type: 'time' as const,
      value: '15:00',
      displayText: '3pm',
      iconName: 'Clock',
      startIndex: value.indexOf('3pm'),
      endIndex: value.indexOf('3pm') + 3,
      originalText: '3pm',
      confidence: 0.85,
      source: 'time-parser',
      color: '#10b981'
    },
    {
      id: '4',
      type: 'person' as const,
      value: 'john',
      displayText: '@john',
      iconName: 'User',
      startIndex: value.indexOf('@john'),
      endIndex: value.indexOf('@john') + 5,
      originalText: '@john',
      confidence: 0.95,
      source: 'person-parser',
      color: '#8b5cf6'
    },
    {
      id: '5',
      type: 'project' as const,
      value: 'project-alpha',
      displayText: '#project-alpha',
      iconName: 'Hash',
      startIndex: value.indexOf('#project-alpha'),
      endIndex: value.indexOf('#project-alpha') + 14,
      originalText: '#project-alpha',
      confidence: 0.7,
      source: 'project-parser',
      color: '#f59e0b'
    }
  ].filter(tag => tag.startIndex !== -1); // Only include tags that exist in current text

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">HighlightedTextareaField Demo</h2>
        <p className="text-muted-foreground">
          Test multi-line text highlighting, scroll synchronization, and cursor positioning.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showConfidence"
            checked={showConfidence}
            onChange={(e) => setShowConfidence(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="showConfidence" className="text-sm">
            Show confidence indicators
          </label>
        </div>

        <div className="border rounded-lg p-4 bg-card">
          <label className="block text-sm font-medium mb-2">
            Enhanced Task Input (Multi-line with Highlighting)
          </label>
          <div className="min-h-[120px] max-h-[300px] border rounded-md p-3 bg-background relative">
            <HighlightedTextareaField
              value={value}
              onChange={setValue}
              tags={mockTags}
              placeholder="Enter your task with dates, priorities, people, and projects..."
              showConfidence={showConfidence}
              confidence={0.75}
              minHeight="120px"
              maxHeight="300px"
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Detected Tags:</h3>
          <div className="flex flex-wrap gap-2">
            {mockTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border"
                style={{
                  backgroundColor: `${tag.color}20`,
                  borderColor: `${tag.color}30`,
                  color: tag.color
                }}
              >
                {tag.displayText} ({Math.round(tag.confidence * 100)}%)
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Testing Instructions:</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Type and edit text to see real-time highlighting updates</li>
            <li>Add new lines to test multi-line functionality</li>
            <li>Scroll within the textarea to test scroll synchronization</li>
            <li>Select text to verify cursor positioning works correctly</li>
            <li>Try typing: "urgent task due next friday at 2pm with @alice #project-beta"</li>
            <li>Test auto-resizing by adding many lines of text</li>
          </ul>
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-medium mb-2">Current Value:</h4>
          <pre className="text-xs whitespace-pre-wrap break-words">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default HighlightedTextareaDemo;