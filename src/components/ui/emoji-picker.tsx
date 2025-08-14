import React, { memo, useCallback } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useThemeStore } from '@/stores/themeStore';

/**
 * Minimal wrapper around Emoji Mart's Picker with app theme integration.
 *
 * Notes
 * - We accept `selectedEmoji` for API compatibility with call-sites, but we do not use it.
 * - The component does not impose width/padding; sizing is handled by the popover content.
 */
export interface EmojiPickerProps {
  /** Optional current emoji; accepted for compatibility. */
  selectedEmoji?: string;
  /** Callback fired with the selected emoji's native string. */
  onEmojiSelect: (emoji: string) => void;
  /** Additional classes forwarded to Emoji Mart's Picker. */
  className?: string;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = memo(
  ({ selectedEmoji: _selectedEmoji, onEmojiSelect, className }) => {
    const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

    type EmojiSelection = { native?: string; shortcodes?: string; id?: string };

    const handleSelect = useCallback(
      (emoji: EmojiSelection) => {
        const value: string | undefined =
          emoji.native || emoji.shortcodes || emoji.id;
        if (value) onEmojiSelect(value);
      },
      [onEmojiSelect]
    );

    return (
      <Picker
        data={data}
        onEmojiSelect={handleSelect}
        theme={resolvedTheme}
        maxFrequentRows={2}
        navPosition="top"
        previewPosition="none"
        searchPosition="sticky"
        skinTonePosition="search"
        emojiSize={20}
        className={className}
      />
    );
  }
);

export default EmojiPicker;