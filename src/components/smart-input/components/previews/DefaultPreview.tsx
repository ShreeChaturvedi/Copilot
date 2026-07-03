/**
 * DefaultPreview - Fallback preview component with enhanced file type icons
 *
 * Provides enhanced visual indicators for file types that don't have
 * specialized preview generation (documents, audio, video, archives).
 */

import React from 'react';
import {
  File,
  FileText,
  FileSpreadsheet,
  Presentation,
  Music,
  Video,
  Archive,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFileDisplayInfo } from '@shared/config/fileTypes';

interface DefaultPreviewProps {
  /** File to generate preview for */
  file: File;
  /** Size of the preview thumbnail */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

/**
 * File type icon mapping with enhanced iconography
 */
const FILE_TYPE_ICONS = {
  // Documents
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  ppt: Presentation,
  pptx: Presentation,
  txt: FileText,
  csv: FileSpreadsheet,

  // Images (fallback)
  jpg: ImageIcon,
  jpeg: ImageIcon,
  png: ImageIcon,
  gif: ImageIcon,
  webp: ImageIcon,
  svg: ImageIcon,

  // Audio
  mp3: Music,
  m4a: Music,
  wav: Music,
  webm: Music,
  ogg: Music,

  // Video
  mp4: Video,
  mov: Video,
  avi: Video,
  mkv: Video,

  // Archives
  zip: Archive,
  rar: Archive,
  '7z': Archive,

  // Fallback
  default: File,
} as const;

/**
 * File type colors -- the foundation's `--filetype-*` tokens (theme-invariant
 * brand marks, index.css), not raw Tailwind named-color utilities. Extensions
 * with no dedicated brand color (plaintext, unknown) fall back to the neutral
 * `--ink-muted` rather than inventing another hue.
 */
const FILE_TYPE_COLORS = {
  // Documents
  pdf: 'text-filetype-pdf',
  doc: 'text-filetype-doc',
  docx: 'text-filetype-doc',
  xls: 'text-filetype-sheet',
  xlsx: 'text-filetype-sheet',
  ppt: 'text-filetype-slides',
  pptx: 'text-filetype-slides',
  txt: 'text-ink-muted',
  csv: 'text-filetype-sheet',

  // Images
  jpg: 'text-filetype-image',
  jpeg: 'text-filetype-image',
  png: 'text-filetype-image',
  gif: 'text-filetype-image',
  webp: 'text-filetype-image',
  svg: 'text-filetype-image',

  // Audio
  mp3: 'text-filetype-audio',
  m4a: 'text-filetype-audio',
  wav: 'text-filetype-audio',
  webm: 'text-filetype-audio',
  ogg: 'text-filetype-audio',

  // Video
  mp4: 'text-filetype-video',
  mov: 'text-filetype-video',
  avi: 'text-filetype-video',
  mkv: 'text-filetype-video',

  // Archives
  zip: 'text-filetype-archive',
  rar: 'text-filetype-archive',
  '7z': 'text-filetype-archive',

  // Fallback
  default: 'text-ink-muted',
} as const;

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  return filename.toLowerCase().split('.').pop() || '';
}

/**
 * Enhanced default preview component
 */
export const DefaultPreview: React.FC<DefaultPreviewProps> = ({
  file,
  size = 'md',
  className,
}) => {
  // Size configurations
  const sizeConfig = {
    sm: { width: 32, height: 32, iconSize: 'w-4 h-4' },
    md: { width: 40, height: 40, iconSize: 'w-5 h-5' },
    lg: { width: 56, height: 56, iconSize: 'w-7 h-7' },
  };

  const { width, height, iconSize } = sizeConfig[size];

  // Get file extension and determine icon/color
  const extension = getFileExtension(file.name);
  const IconComponent =
    FILE_TYPE_ICONS[extension as keyof typeof FILE_TYPE_ICONS] ||
    FILE_TYPE_ICONS.default;
  const iconColor =
    FILE_TYPE_COLORS[extension as keyof typeof FILE_TYPE_COLORS] ||
    FILE_TYPE_COLORS.default;

  // Get file display info for additional context
  const displayInfo = getFileDisplayInfo(file);

  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-md bg-muted',
        'border border-border/50',
        className
      )}
      style={{ width, height }}
      title={`${displayInfo.displayName} file: ${file.name}`}
    >
      {/* Main file icon */}
      <IconComponent className={cn(iconSize, iconColor)} />

      {/* No subtitle/extension overlay for non-PDF previews to avoid obscuring icons */}
    </div>
  );
};

export default DefaultPreview;
