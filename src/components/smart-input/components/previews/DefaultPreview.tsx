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
 * Enhanced file type colors for better visual distinction
 */
const FILE_TYPE_COLORS = {
  // Documents - Green tones
  pdf: 'text-red-500',
  doc: 'text-blue-600',
  docx: 'text-blue-600',
  xls: 'text-green-600',
  xlsx: 'text-green-600',
  ppt: 'text-orange-600',
  pptx: 'text-orange-600',
  txt: 'text-gray-600',
  csv: 'text-green-500',
  
  // Images - Blue tones
  jpg: 'text-blue-500',
  jpeg: 'text-blue-500',
  png: 'text-blue-500',
  gif: 'text-blue-500',
  webp: 'text-blue-500',
  svg: 'text-purple-500',
  
  // Audio - Purple tones
  mp3: 'text-purple-500',
  m4a: 'text-purple-500',
  wav: 'text-purple-500',
  webm: 'text-purple-600',
  ogg: 'text-purple-600',
  
  // Video - Red tones
  mp4: 'text-red-500',
  mov: 'text-red-500',
  avi: 'text-red-600',
  mkv: 'text-red-600',
  
  // Archives - Orange tones
  zip: 'text-orange-500',
  rar: 'text-orange-600',
  '7z': 'text-orange-600',
  
  // Fallback
  default: 'text-gray-500',
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
  const IconComponent = FILE_TYPE_ICONS[extension as keyof typeof FILE_TYPE_ICONS] || FILE_TYPE_ICONS.default;
  const iconColor = FILE_TYPE_COLORS[extension as keyof typeof FILE_TYPE_COLORS] || FILE_TYPE_COLORS.default;

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
      <IconComponent
        className={cn(iconSize, iconColor)}
      />
      
      {/* No subtitle/extension overlay for non-PDF previews to avoid obscuring icons */}
    </div>
  );
};

export default DefaultPreview;