/**
 * React hook for real-time text parsing with debouncing
 * Manages parsed tags state and provides clean title extraction
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ParseResult, ParsedTag } from '@shared/types';
import type { SmartParser as SmartParserType } from '../parsers/SmartParser';

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

let parserInstance: SmartParserType | null = null;

/**
 * Get singleton parser instance
 */
async function getParser(): Promise<SmartParserType> {
  if (!parserInstance) {
    const mod = await import('../parsers/SmartParser');
    parserInstance = new mod.SmartParser();
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
  const { debounceMs = 100, minLength = 2, enabled = true } = options;

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // Memoize parser instance
  const parserRef = useRef<SmartParserType | null>(null);
  useEffect(() => {
    let mounted = true;
    getParser().then((p) => {
      if (mounted) parserRef.current = p;
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Debounced parsing function - using useRef to maintain timeout across renders
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedParse = useCallback(
    (textToParse: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;
        if (!enabled || textToParse.length < minLength) {
          setParseResult(null);
          setIsLoading(false);
          setError(null);
          return;
        }

        setIsLoading(true);
        setError(null);

        try {
          const parser = parserRef.current || (await getParser());
          const result = await parser.parse(textToParse);
          if (isMountedRef.current) {
            setParseResult(result);
          }
        } catch (err) {
          console.error('Text parsing error:', err);
          if (isMountedRef.current) {
            setError(err instanceof Error ? err.message : 'Parsing failed');
            setParseResult(null);
          }
        } finally {
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        }
      }, debounceMs);
    },
    [enabled, minLength, debounceMs]
  );

  // Trigger parsing when text changes
  useEffect(() => {
    debouncedParse(text);
  }, [text, debouncedParse]);

  // Manual trigger function
  const triggerParse = useCallback(() => {
    if (enabled && text.length >= minLength) {
      setIsLoading(true);
      (parserRef.current ? Promise.resolve(parserRef.current) : getParser())
        .then((p) => p.parse(text))
        .then((result) => {
          if (isMountedRef.current) {
            setParseResult(result);
          }
        })
        .catch((err) => {
          if (isMountedRef.current) {
            setError(err instanceof Error ? err.message : 'Parsing failed');
            setParseResult(null);
          }
        })
        .finally(() => {
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        });
    }
  }, [text, enabled, minLength]);

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
  const [debugResult, setDebugResult] = useState<{
    parserResults: Array<{ parser: string; tags: ParsedTag[] }>;
  } | null>(null);
  const [parserInstance, setParserInstance] = useState<SmartParserType | null>(
    null
  );
  useEffect(() => {
    let mounted = true;
    getParser().then((p) => {
      if (mounted) setParserInstance(p);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const testParse = useCallback(async () => {
    if (text.trim() && parserInstance) {
      const result = await parserInstance.testParse(text);
      setDebugResult(result);
    }
  }, [parserInstance, text]);

  return {
    debugResult,
    testParse,
  };
}
