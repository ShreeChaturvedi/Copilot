/**
 * React hook for real-time text parsing with debouncing
 * Manages parsed tags state and provides clean title extraction
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ParseResult, ParsedTag } from '@/types';
import { SmartParser } from '../parsers/SmartParser';

export interface UseTextParserOptions {
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Minimum text length to trigger parsing */
  minLength?: number;
  /** Whether to enable parsing */
  enabled?: boolean;
}

export interface UseTextParserResult {
  /** Current parsing result */
  parseResult: ParseResult | null;
  /** Whether parsing is in progress */
  isLoading: boolean;
  /** Parsing error if any */
  error: string | null;
  /** Clean title without parsed elements */
  cleanTitle: string;
  /** All detected tags */
  tags: ParsedTag[];
  /** Overall parsing confidence */
  confidence: number;
  /** Whether any conflicts were detected */
  hasConflicts: boolean;
  /** Manual trigger for parsing */
  triggerParse: () => void;
  /** Clear all parsing results */
  clear: () => void;
}

let parserInstance: SmartParser | null = null;

/**
 * Get singleton parser instance
 */
function getParser(): SmartParser {
  if (!parserInstance) {
    parserInstance = new SmartParser();
  }
  return parserInstance;
}

/**
 * Custom hook for real-time text parsing
 */
export function useTextParser(
  text: string,
  options: UseTextParserOptions = {}
): UseTextParserResult {
  const {
    debounceMs = 100,
    minLength = 2,
    enabled = true,
  } = options;

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize parser instance
  const parser = useMemo(() => getParser(), []);

  // Debounced parsing function
  const debouncedParse = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      
      return (textToParse: string) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        timeoutId = setTimeout(async () => {
          if (!enabled || textToParse.length < minLength) {
            setParseResult(null);
            setIsLoading(false);
            setError(null);
            return;
          }

          setIsLoading(true);
          setError(null);

          try {
            const result = await parser.parse(textToParse);
            setParseResult(result);
          } catch (err) {
            console.error('Text parsing error:', err);
            setError(err instanceof Error ? err.message : 'Parsing failed');
            setParseResult(null);
          } finally {
            setIsLoading(false);
          }
        }, debounceMs);
      };
    })(),
    [parser, enabled, minLength, debounceMs]
  );

  // Trigger parsing when text changes
  useEffect(() => {
    debouncedParse(text);
  }, [text, debouncedParse]);

  // Manual trigger function
  const triggerParse = useCallback(() => {
    if (enabled && text.length >= minLength) {
      setIsLoading(true);
      parser.parse(text).then(setParseResult).catch(err => {
        setError(err instanceof Error ? err.message : 'Parsing failed');
        setParseResult(null);
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [parser, text, enabled, minLength]);

  // Clear function
  const clear = useCallback(() => {
    setParseResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  // Derived values
  const cleanTitle = parseResult?.cleanText || text;
  const tags = parseResult?.tags || [];
  const confidence = parseResult?.confidence || 0;
  const hasConflicts = (parseResult?.conflicts.length || 0) > 0;

  return {
    parseResult,
    isLoading,
    error,
    cleanTitle,
    tags,
    confidence,
    hasConflicts,
    triggerParse,
    clear,
  };
}

/**
 * Hook for testing parsing without side effects
 */
export function useTextParserDebug(text: string) {
  const [debugResult, setDebugResult] = useState<any>(null);
  const parser = useMemo(() => getParser(), []);

  const testParse = useCallback(async () => {
    if (text.trim()) {
      const result = await parser.testParse(text);
      setDebugResult(result);
    }
  }, [parser, text]);

  return {
    debugResult,
    testParse,
  };
}