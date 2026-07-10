import * as React from 'react';
import { init, exec } from 'pell';
import { cn } from '@/lib/utils';
import { sanitizeHtml, validateRichText } from '@/utils/validation';

export interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  minHeight?: number;
  className?: string;
  disabled?: boolean;
  /**
   * Reports content validity (e.g. over the 10k length cap) to the parent so
   * it can surface a warning. We never swallow keystrokes on invalid content.
   */
  onValidityChange?: (isValid: boolean, error?: string) => void;
}

/**
 * Lightweight WYSIWYG editor wrapper based on Pell (~2KB)
 * - Sanitizes output HTML
 * - Uses app theming tokens via CSS classes defined in index.css
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder = 'Add description',
  ariaLabel,
  minHeight = 120,
  className,
  disabled = false,
  onValidityChange,
}: RichTextEditorProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const editorRef = React.useRef<{ content: HTMLElement } | null>(null);
  const lastEmittedRef = React.useRef<string>('');
  // Keep the latest validity callback reachable from the init effect (which
  // runs once with empty deps) without re-initializing Pell.
  const onValidityChangeRef = React.useRef(onValidityChange);
  onValidityChangeRef.current = onValidityChange;

  // Normalize and sanitize outgoing HTML; collapse empty structures to ''
  const normalizeHtml = React.useCallback((html: string) => {
    const sanitized = sanitizeHtml(html || '');
    const textOnly = sanitized
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    if (textOnly.length === 0) return '';
    return sanitized;
  }, []);

  React.useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing content to avoid duplicate mounts in StrictMode/HMR
    containerRef.current.innerHTML = '';

    // Initialize Pell in the provided container
    editorRef.current = init({
      element: containerRef.current,
      onChange: (html: string) => {
        const normalized = normalizeHtml(html);
        lastEmittedRef.current = normalized;
        // Surface validity (e.g. over the 10k cap) to the parent but NEVER
        // swallow the keystroke — returning early here silently dropped every
        // further edit from parent state, a silent data-loss trap.
        const { isValid, errors } = validateRichText(normalized);
        onValidityChangeRef.current?.(isValid, errors[0]?.message);
        onChange(normalized);
      },
      defaultParagraphSeparator: 'p',
      styleWithCSS: true,
      classes: {
        actionbar: 'rte-actionbar',
        button: 'rte-button',
        content: 'rte-content',
        selected: 'rte-button-selected',
      },
      actions: [
        'bold',
        'italic',
        'underline',
        'olist',
        'ulist',
        // Replace default link with lucide SVG icon, keep same behavior
        {
          name: 'link',
          // lucide "link" icon
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link"><path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5"/><path d="M14 11a5 5 0 0 0-7.07 0L5.52 12.41a5 5 0 0 0 7.07 7.07L14 19"/></svg>',
          title: 'Insert link',
          result: () => {
            const input = window.prompt('Enter the link URL');
            const trimmed = input?.trim();
            if (!trimmed) return;
            // Normalize scheme-less input and reject anything that isn't
            // http(s) so createLink can't emit a junk/unsafe href.
            const candidate = /^[a-z][\w+.-]*:/i.test(trimmed)
              ? trimmed
              : `https://${trimmed}`;
            if (!/^https?:\/\//i.test(candidate)) return;
            exec('createLink', candidate);
          },
        },
        'quote',
        'paragraph',
      ],
    });

    const contentEl = editorRef.current?.content;
    if (contentEl) {
      contentEl.setAttribute('role', 'textbox');
      contentEl.setAttribute('aria-multiline', 'true');
      if (ariaLabel) contentEl.setAttribute('aria-label', ariaLabel);
      contentEl.setAttribute('data-placeholder', placeholder);
      contentEl.style.minHeight = `${minHeight}px`;
      contentEl.setAttribute('contenteditable', (!disabled).toString());
      // Initial value
      const normalized = normalizeHtml(value || '');
      contentEl.innerHTML = normalized;
      lastEmittedRef.current = normalized;
    }

    const container = containerRef.current;
    return () => {
      // Best-effort cleanup (Pell doesn't expose an explicit destroy)
      if (container) {
        container.innerHTML = '';
      }
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value updates into editor (avoid feedback loops)
  React.useEffect(() => {
    const contentEl = editorRef.current?.content;
    if (!contentEl) return;
    const normalized = normalizeHtml(value || '');
    // Skip echoes of the editor's own last emission: the controlled parent
    // round-trips value back through sanitizeHtml, whose serialization differs
    // from the browser's contentEditable markup even when semantically equal,
    // which otherwise rewrites innerHTML mid-type and collapses the caret to
    // the start. Also never rewrite while the editor is focused.
    if (normalized === lastEmittedRef.current) return;
    if (
      document.activeElement === contentEl ||
      contentEl.contains(document.activeElement)
    ) {
      return;
    }
    if (normalized !== contentEl.innerHTML) {
      contentEl.innerHTML = normalized;
      lastEmittedRef.current = normalized;
    }
  }, [value, normalizeHtml]);

  // Toggle disabled state dynamically
  React.useEffect(() => {
    const contentEl = editorRef.current?.content;
    if (!contentEl) return;
    contentEl.setAttribute('contenteditable', (!disabled).toString());
  }, [disabled]);

  return (
    <div
      id={id}
      className={cn(
        'rte-root w-full min-w-0 rounded-md border border-input [box-shadow:var(--shadow-control)] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        className
      )}
      tabIndex={0}
    >
      <div ref={containerRef} />
    </div>
  );
}

export default RichTextEditor;
