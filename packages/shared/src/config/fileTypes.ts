/**
 * Shared File Types Configuration
 * 
 * Centralized configuration for all supported file types across frontend and backend.
 * Includes MIME types, file extensions, size limits, preview capabilities, and icon mappings.
 */


/**
 * File type categories
 */
export type FileTypeCategory = 'images' | 'documents' | 'audio' | 'video' | 'archives';

/**
 * Preview capability types
 */
export type PreviewType = 'thumbnail' | 'pdf' | 'icon' | 'none';

/**
 * File type configuration interface
 */
export interface FileTypeConfig {
  /** MIME types for this category */
  accept: Record<string, string[]>;
  /** Maximum file size in bytes */
  maxSize: number;
  /** Type of preview to generate */
  previewType: PreviewType;
  /** Color theme for icons */
  color: string;
  /** Display name for the category */
  displayName: string;
  /** File extensions (without dot) */
  extensions: string[];
}

/**
 * Comprehensive file type configurations
 * Aligned with backend SUPPORTED_FILE_TYPES from AttachmentService.ts
 */
export const FILE_TYPE_CONFIGS: Record<FileTypeCategory, FileTypeConfig> = {
  images: {
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'image/svg+xml': ['.svg'],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    previewType: 'thumbnail',
    color: 'text-blue-500',
    displayName: 'Images',
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
  },
  documents: {
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      // Developer and markup text types
      'text/markdown': ['.md'],
      'text/x-java-source': ['.java'],
      'text/x-python': ['.py'],
      'text/x-csrc': ['.c'],
      'text/x-c++src': ['.cpp', '.cxx', '.cc'],
      'text/x-go': ['.go'],
      'text/x-kotlin': ['.kt'],
      'text/x-ruby': ['.rb'],
      'text/x-php': ['.php'],
      'text/x-scss': ['.scss'],
      'text/css': ['.css'],
      'text/html': ['.html', '.htm'],
      'application/json': ['.json'],
      'application/x-sh': ['.sh'],
      'application/x-typescript': ['.ts'],
      'text/javascript': ['.js'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    previewType: 'icon', // Enhanced icons for most documents, PDFs get special handling
    color: 'text-green-500',
    displayName: 'Documents',
    extensions: [
      'pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv',
      'md','java','py','c','cpp','cxx','cc','go','kt','rb','php','scss','css','html','htm','json','sh','ts','js'
    ],
  },
  audio: {
    accept: {
      'audio/mpeg': ['.mp3'],
      'audio/mp4': ['.m4a'],
      'audio/wav': ['.wav'],
      'audio/webm': ['.webm'],
      'audio/ogg': ['.ogg'],
    },
    maxSize: 25 * 1024 * 1024, // 25MB
    previewType: 'icon',
    color: 'text-purple-500',
    displayName: 'Audio',
    extensions: ['mp3', 'm4a', 'wav', 'webm', 'ogg'],
  },
  video: {
    accept: {
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
      'video/ogg': ['.ogg'],
      'video/quicktime': ['.mov'],
      'video/x-msvideo': ['.avi'],
      'video/x-matroska': ['.mkv'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    previewType: 'icon',
    color: 'text-red-500',
    displayName: 'Video',
    extensions: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'],
  },
  archives: {
    accept: {
      'application/zip': ['.zip'],
      'application/x-rar-compressed': ['.rar'],
      'application/x-7z-compressed': ['.7z'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    previewType: 'icon',
    color: 'text-orange-500',
    displayName: 'Archives',
    extensions: ['zip', 'rar', '7z'],
  },
};

/**
 * Global file upload constraints
 */
export const FILE_UPLOAD_LIMITS = {
  /** Maximum number of files per task */
  maxFilesPerTask: 20,
  /** Absolute maximum file size (100MB) */
  absoluteMaxSize: 100 * 1024 * 1024,
  /** Total size limit per task (500MB) */
  totalSizeLimit: 500 * 1024 * 1024,
} as const;

/**
 * Specific file type icons mapping for enhanced UX
 */
export const FILE_TYPE_ICONS = {
  // Documents
  pdf: 'FileText',
  doc: 'FileText',
  docx: 'FileText',
  xls: 'FileSpreadsheet',
  xlsx: 'FileSpreadsheet', 
  ppt: 'Presentation',
  pptx: 'Presentation',
  txt: 'FileText',
  csv: 'FileSpreadsheet',
  
  // Images
  jpg: 'Image',
  jpeg: 'Image',
  png: 'Image',
  gif: 'Image',
  webp: 'Image',
  svg: 'Image',
  
  // Audio
  mp3: 'Music',
  m4a: 'Music',
  wav: 'Music',
  webm: 'Music',
  ogg: 'Music',
  
  // Video
  mp4: 'Video',
  mov: 'Video',
  avi: 'Video',
  mkv: 'Video',
  
  // Archives
  zip: 'Archive',
  rar: 'Archive',
  '7z': 'Archive',
  
  // Fallback
  default: 'File',
} as const;

/**
 * Combined accept object for all file types (for dropzone)
 */
export const ALL_ACCEPTED_FILES = Object.values(FILE_TYPE_CONFIGS).reduce(
  (acc, config) => ({
    ...acc,
    ...config.accept,
  }),
  {} as Record<string, string[]>
);

/**
 * Array of all supported MIME types
 */
export const ALL_SUPPORTED_MIME_TYPES = Object.values(FILE_TYPE_CONFIGS)
  .flatMap(config => Object.keys(config.accept));

/**
 * Array of all supported file extensions (without dots)
 */
export const ALL_SUPPORTED_EXTENSIONS = Object.values(FILE_TYPE_CONFIGS)
  .flatMap(config => config.extensions);

/**
 * Get file type category from MIME type
 */
export function getFileTypeCategory(mimeType: string): FileTypeCategory | null {
  for (const [category, config] of Object.entries(FILE_TYPE_CONFIGS)) {
    const acceptKeys = Object.keys(config.accept);
    // Exact match first
    if (acceptKeys.includes(mimeType)) {
      return category as FileTypeCategory;
    }
    // Wildcard support e.g., text/*
    for (const key of acceptKeys) {
      if (key.endsWith('/*')) {
        const base = key.split('/')[0];
        if (mimeType.startsWith(base + '/')) {
          return category as FileTypeCategory;
        }
      }
    }
  }
  return null;
}

/**
 * Get file type category from file extension
 */
export function getFileTypeCategoryByExtension(filename: string): FileTypeCategory | null {
  const extension = filename.toLowerCase().split('.').pop();
  if (!extension) return null;
  
  for (const [category, config] of Object.entries(FILE_TYPE_CONFIGS)) {
    if (config.extensions.includes(extension)) {
      return category as FileTypeCategory;
    }
  }
  return null;
}

/**
 * Check if a file type is supported
 */
export function isSupportedFileType(mimeType: string): boolean {
  return getFileTypeCategory(mimeType) !== null;
}

/**
 * Check if a file extension is supported
 */
export function isSupportedExtension(filename: string): boolean {
  const extension = filename.toLowerCase().split('.').pop();
  return extension ? ALL_SUPPORTED_EXTENSIONS.includes(extension) : false;
}

/**
 * Get maximum file size for a given MIME type
 */
export function getMaxFileSize(mimeType: string): number {
  const category = getFileTypeCategory(mimeType);
  return category ? FILE_TYPE_CONFIGS[category].maxSize : FILE_UPLOAD_LIMITS.absoluteMaxSize;
}

/**
 * Get preview type for a given file
 */
export function getPreviewType(file: File): PreviewType {
  const category = getFileTypeCategory(file.type);
  if (!category) return 'icon';
  
  // Special handling for PDFs - they get thumbnail previews
  if (file.type === 'application/pdf') {
    return 'pdf';
  }
  
  // For images, use thumbnail previews
  if (category === 'images') {
    return 'thumbnail';
  }
  
  // All other document types (docx, xlsx, pptx) get enhanced icons
  return 'icon';
}

/**
 * Get appropriate icon name for a file
 */
export function getFileIcon(filename: string): keyof typeof FILE_TYPE_ICONS {
  const extension = filename.toLowerCase().split('.').pop();
  return extension && extension in FILE_TYPE_ICONS 
    ? (extension as keyof typeof FILE_TYPE_ICONS)
    : 'default';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  let value = bytes / Math.pow(k, i);

  // Prevent 1024.0 KB edge-case due to rounding; bump to next unit
  if (i < sizes.length - 1 && parseFloat(value.toFixed(1)) >= 1024) {
    i += 1;
    value = bytes / Math.pow(k, i);
  }

  return parseFloat(value.toFixed(1)) + ' ' + sizes[i];
}

/**
 * Validate file against constraints
 */
export function validateFile(file: File): { 
  isValid: boolean; 
  error?: string; 
  category?: FileTypeCategory;
} {
  // Determine category by MIME type; fall back to extension when MIME is missing or unknown
  let category = getFileTypeCategory(file.type);
  if (!category) {
    category = getFileTypeCategoryByExtension(file.name);
  }

  if (!category) {
    return {
      isValid: false,
      error: `File type "${file.type || file.name.split('.').pop() || 'unknown'}" is not supported`,
    };
  }
  
  // Check size limits for determined category
  const maxSize = FILE_TYPE_CONFIGS[category].maxSize;
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum limit of ${formatFileSize(maxSize)}`,
      category,
    };
  }
  
  return {
    isValid: true,
    category,
  };
}

/**
 * Get file type configuration by category
 */
export function getFileTypeConfig(category: FileTypeCategory): FileTypeConfig {
  return FILE_TYPE_CONFIGS[category];
}

/**
 * Get display information for a file
 */
export function getFileDisplayInfo(file: File) {
  const category = getFileTypeCategory(file.type);
  const config = category ? FILE_TYPE_CONFIGS[category] : null;
  const icon = getFileIcon(file.name);
  const previewType = getPreviewType(file);
  
  return {
    category,
    config,
    icon,
    previewType,
    displayName: config?.displayName || 'Unknown',
    color: config?.color || 'text-gray-500',
    formattedSize: formatFileSize(file.size),
  };
}