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
}: RichTextEditorProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const editorRef = React.useRef<{ content: HTMLElement } | null>(null);
  const lastEmittedRef = React.useRef<string>('');

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
        // Guard by validation length (soft validation)
        const { isValid } = validateRichText(normalized);
        if (!isValid) return;
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
            const url = window.prompt('Enter the link URL');
            if (url) exec('createLink', url);
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
    // Only update DOM if value actually changed
    if (normalized !== contentEl.innerHTML) {
      contentEl.innerHTML = normalized;
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
        'rte-root w-full min-w-0 rounded-md border border-input shadow-xs focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        className
      )}
      tabIndex={0}
    >
      <div ref={containerRef} />
    </div>
  );
}

export default RichTextEditor;
