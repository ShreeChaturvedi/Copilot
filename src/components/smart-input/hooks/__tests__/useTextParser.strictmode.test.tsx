import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useTextParser } from '../useTextParser';

// Deterministic parser so the test isolates the hook's mount lifecycle (the bug)
// from the real parser's output. Every parse yields exactly one tag.
vi.mock('@/components/smart-input/parsers/SmartParser', () => ({
  SmartParser: class {
    async parse(text: string) {
      return {
        cleanText: text,
        tags: [
          {
            id: 'mock-tag',
            type: 'label',
            value: 'mock',
            displayText: '#mock',
            iconName: 'Tag',
            startIndex: 0,
            endIndex: 4,
            originalText: 'mock',
            confidence: 1,
            source: 'mock',
          },
        ],
        confidence: 1,
        conflicts: [],
      };
    }
  },
}));

function Harness({ text }: { text: string }) {
  const { tags } = useTextParser(text, { debounceMs: 10, minLength: 2 });
  return <div data-testid="tag-count">{tags.length}</div>;
}

describe('useTextParser under React.StrictMode', () => {
  it('still fires parse callbacks after the StrictMode remount', async () => {
    // StrictMode mounts -> runs cleanup -> remounts. If isMountedRef is not
    // reset in the effect body, the debounced parse bails silently and tags
    // stay empty (regression for #39).
    render(
      <StrictMode>
        <Harness text="buy milk tomorrow" />
      </StrictMode>
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('tag-count').textContent).toBe('1');
      },
      { timeout: 2000 }
    );
  });
});
