/**
 * File Types Configuration Tests
 *
 * Tests the shared file type configuration system to ensure
 * proper file type detection, validation, and utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  FILE_TYPE_CONFIGS,
  ALL_ACCEPTED_FILES,
  ALL_SUPPORTED_MIME_TYPES,
  ALL_SUPPORTED_EXTENSIONS,
  getFileTypeCategory,
  getFileTypeCategoryByExtension,
  isSupportedFileType,
  isSupportedExtension,
  getMaxFileSize,
  getPreviewType,
  formatFileSize,
  validateFile,
  getFileDisplayInfo,
} from '@shared/config/fileTypes';

describe('File Types Configuration', () => {
  describe('Configuration Structure', () => {
    it('should have all required file type categories', () => {
      expect(FILE_TYPE_CONFIGS).toHaveProperty('images');
      expect(FILE_TYPE_CONFIGS).toHaveProperty('documents');
      expect(FILE_TYPE_CONFIGS).toHaveProperty('audio');
      expect(FILE_TYPE_CONFIGS).toHaveProperty('video');
      expect(FILE_TYPE_CONFIGS).toHaveProperty('archives');
    });

    it('should have valid configuration for each category', () => {
      Object.values(FILE_TYPE_CONFIGS).forEach((config) => {
        expect(config).toHaveProperty('accept');
        expect(config).toHaveProperty('maxSize');
        expect(config).toHaveProperty('previewType');
        expect(config).toHaveProperty('color');
        expect(config).toHaveProperty('displayName');
        expect(config).toHaveProperty('extensions');

        expect(typeof config.accept).toBe('object');
        expect(typeof config.maxSize).toBe('number');
        expect(config.maxSize).toBeGreaterThan(0);
        expect(typeof config.previewType).toBe('string');
        expect(typeof config.color).toBe('string');
        expect(typeof config.displayName).toBe('string');
        expect(Array.isArray(config.extensions)).toBe(true);
      });
    });

    it('should generate ALL_ACCEPTED_FILES correctly', () => {
      expect(typeof ALL_ACCEPTED_FILES).toBe('object');
      expect(Object.keys(ALL_ACCEPTED_FILES).length).toBeGreaterThan(0);

      // Should contain key MIME types
      expect(ALL_ACCEPTED_FILES).toHaveProperty('image/jpeg');
      expect(ALL_ACCEPTED_FILES).toHaveProperty('application/pdf');
      expect(ALL_ACCEPTED_FILES).toHaveProperty('audio/mpeg');
      expect(ALL_ACCEPTED_FILES).toHaveProperty('video/mp4');
    });

    it('should generate supported MIME types array', () => {
      expect(Array.isArray(ALL_SUPPORTED_MIME_TYPES)).toBe(true);
      expect(ALL_SUPPORTED_MIME_TYPES.length).toBeGreaterThan(0);
      expect(ALL_SUPPORTED_MIME_TYPES).toContain('image/jpeg');
      expect(ALL_SUPPORTED_MIME_TYPES).toContain('application/pdf');
      expect(ALL_SUPPORTED_MIME_TYPES).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
    });

    it('should generate supported extensions array', () => {
      expect(Array.isArray(ALL_SUPPORTED_EXTENSIONS)).toBe(true);
      expect(ALL_SUPPORTED_EXTENSIONS.length).toBeGreaterThan(0);
      expect(ALL_SUPPORTED_EXTENSIONS).toContain('jpg');
      expect(ALL_SUPPORTED_EXTENSIONS).toContain('pdf');
      expect(ALL_SUPPORTED_EXTENSIONS).toContain('docx');
      expect(ALL_SUPPORTED_EXTENSIONS).toContain('xlsx');
      expect(ALL_SUPPORTED_EXTENSIONS).toContain('pptx');
    });
  });

  describe('File Type Detection', () => {
    describe('getFileTypeCategory', () => {
      it('should detect image types correctly', () => {
        expect(getFileTypeCategory('image/jpeg')).toBe('images');
        expect(getFileTypeCategory('image/png')).toBe('images');
        expect(getFileTypeCategory('image/gif')).toBe('images');
        expect(getFileTypeCategory('image/webp')).toBe('images');
      });

      it('should detect document types correctly', () => {
        expect(getFileTypeCategory('application/pdf')).toBe('documents');
        expect(getFileTypeCategory('application/msword')).toBe('documents');
        expect(
          getFileTypeCategory(
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          )
        ).toBe('documents');
        expect(
          getFileTypeCategory(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          )
        ).toBe('documents');
        expect(
          getFileTypeCategory(
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          )
        ).toBe('documents');
        expect(getFileTypeCategory('text/plain')).toBe('documents');
        expect(getFileTypeCategory('text/csv')).toBe('documents');
      });

      it('should detect audio types correctly', () => {
        expect(getFileTypeCategory('audio/mpeg')).toBe('audio');
        expect(getFileTypeCategory('audio/mp4')).toBe('audio');
        expect(getFileTypeCategory('audio/wav')).toBe('audio');
      });

      it('should detect video types correctly', () => {
        expect(getFileTypeCategory('video/mp4')).toBe('video');
        expect(getFileTypeCategory('video/webm')).toBe('video');
        expect(getFileTypeCategory('video/quicktime')).toBe('video');
      });

      it('should detect archive types correctly', () => {
        expect(getFileTypeCategory('application/zip')).toBe('archives');
        expect(getFileTypeCategory('application/x-rar-compressed')).toBe(
          'archives'
        );
        expect(getFileTypeCategory('application/x-7z-compressed')).toBe(
          'archives'
        );
      });

      it('should return null for unsupported types', () => {
        expect(getFileTypeCategory('application/unknown')).toBe(null);
        expect(getFileTypeCategory('text/unknown')).toBe(null);
      });
    });

    describe('getFileTypeCategoryByExtension', () => {
      it('should detect categories by extension', () => {
        expect(getFileTypeCategoryByExtension('photo.jpg')).toBe('images');
        expect(getFileTypeCategoryByExtension('document.pdf')).toBe(
          'documents'
        );
        expect(getFileTypeCategoryByExtension('spreadsheet.xlsx')).toBe(
          'documents'
        );
        expect(getFileTypeCategoryByExtension('presentation.pptx')).toBe(
          'documents'
        );
        expect(getFileTypeCategoryByExtension('song.mp3')).toBe('audio');
        expect(getFileTypeCategoryByExtension('video.mp4')).toBe('video');
        expect(getFileTypeCategoryByExtension('archive.zip')).toBe('archives');
      });

      it('should be case insensitive', () => {
        expect(getFileTypeCategoryByExtension('photo.JPG')).toBe('images');
        expect(getFileTypeCategoryByExtension('document.PDF')).toBe(
          'documents'
        );
        expect(getFileTypeCategoryByExtension('spreadsheet.XLSX')).toBe(
          'documents'
        );
      });

      it('should handle files without extensions', () => {
        expect(getFileTypeCategoryByExtension('noextension')).toBe(null);
        expect(getFileTypeCategoryByExtension('')).toBe(null);
      });
    });
  });

  describe('File Type Validation', () => {
    describe('isSupportedFileType', () => {
      it('should return true for supported MIME types', () => {
        expect(isSupportedFileType('image/jpeg')).toBe(true);
        expect(isSupportedFileType('application/pdf')).toBe(true);
        expect(
          isSupportedFileType(
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          )
        ).toBe(true);
        expect(isSupportedFileType('audio/mpeg')).toBe(true);
        expect(isSupportedFileType('video/mp4')).toBe(true);
      });

      it('should return false for unsupported MIME types', () => {
        expect(isSupportedFileType('application/unknown')).toBe(false);
        expect(isSupportedFileType('text/unknown')).toBe(false);
        expect(isSupportedFileType('image/unknown')).toBe(false);
      });
    });

    describe('isSupportedExtension', () => {
      it('should return true for supported extensions', () => {
        expect(isSupportedExtension('photo.jpg')).toBe(true);
        expect(isSupportedExtension('document.pdf')).toBe(true);
        expect(isSupportedExtension('spreadsheet.xlsx')).toBe(true);
        expect(isSupportedExtension('presentation.pptx')).toBe(true);
        expect(isSupportedExtension('song.mp3')).toBe(true);
      });

      it('should return false for unsupported extensions', () => {
        expect(isSupportedExtension('unknown.xyz')).toBe(false);
        expect(isSupportedExtension('file.unknown')).toBe(false);
      });

      it('should handle files without extensions', () => {
        expect(isSupportedExtension('noextension')).toBe(false);
      });
    });
  });

  describe('File Size Utilities', () => {
    describe('getMaxFileSize', () => {
      it('should return correct size limits for each category', () => {
        expect(getMaxFileSize('image/jpeg')).toBe(5 * 1024 * 1024); // 5MB
        expect(getMaxFileSize('application/pdf')).toBe(10 * 1024 * 1024); // 10MB
        expect(getMaxFileSize('audio/mpeg')).toBe(25 * 1024 * 1024); // 25MB
        expect(getMaxFileSize('video/mp4')).toBe(100 * 1024 * 1024); // 100MB
        expect(getMaxFileSize('application/zip')).toBe(50 * 1024 * 1024); // 50MB
      });

      it('should return default size for unknown types', () => {
        expect(getMaxFileSize('application/unknown')).toBe(100 * 1024 * 1024);
      });
    });

    describe('formatFileSize', () => {
      it('should format bytes correctly', () => {
        expect(formatFileSize(0)).toBe('0 Bytes');
        expect(formatFileSize(1024)).toBe('1 KB');
        expect(formatFileSize(1024 * 1024)).toBe('1 MB');
        expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
        expect(formatFileSize(1536)).toBe('1.5 KB'); // 1.5KB
      });

      it('should handle decimal values properly', () => {
        expect(formatFileSize(1536)).toBe('1.5 KB');
        expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
      });
    });
  });

  describe('Preview Type Detection', () => {
    describe('getPreviewType', () => {
      const createMockFile = (name: string, type: string): File => {
        return new File(['test'], name, { type });
      };

      it('should return thumbnail for images', () => {
        const file = createMockFile('photo.jpg', 'image/jpeg');
        expect(getPreviewType(file)).toBe('thumbnail');
      });

      it('should return pdf for PDF files', () => {
        const file = createMockFile('document.pdf', 'application/pdf');
        expect(getPreviewType(file)).toBe('pdf');
      });

      it('should return icon for other document types', () => {
        const file = createMockFile(
          'document.docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        expect(getPreviewType(file)).toBe('icon');
      });

      it('should return icon for audio/video files', () => {
        const audioFile = createMockFile('song.mp3', 'audio/mpeg');
        const videoFile = createMockFile('movie.mp4', 'video/mp4');

        expect(getPreviewType(audioFile)).toBe('icon');
        expect(getPreviewType(videoFile)).toBe('icon');
      });
    });
  });

  describe('File Validation', () => {
    describe('validateFile', () => {
      const createMockFile = (
        name: string,
        type: string,
        size: number
      ): File => {
        const file = new File(['test'], name, { type });
        Object.defineProperty(file, 'size', { value: size });
        return file;
      };

      it('should validate supported files correctly', () => {
        const file = createMockFile('photo.jpg', 'image/jpeg', 1024);
        const result = validateFile(file);

        expect(result.isValid).toBe(true);
        expect(result.category).toBe('images');
        expect(result.error).toBeUndefined();
      });

      it('should reject unsupported file types', () => {
        const file = createMockFile('unknown.xyz', 'application/unknown', 1024);
        const result = validateFile(file);

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('not supported');
      });

      it('should reject files that exceed size limits', () => {
        const file = createMockFile('huge.jpg', 'image/jpeg', 10 * 1024 * 1024); // 10MB (exceeds 5MB limit)
        const result = validateFile(file);

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('exceeds maximum limit');
      });

      it('should validate Excel files correctly', () => {
        const file = createMockFile(
          'spreadsheet.xlsx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          1024
        );
        const result = validateFile(file);

        expect(result.isValid).toBe(true);
        expect(result.category).toBe('documents');
      });

      it('should validate PowerPoint files correctly', () => {
        const file = createMockFile(
          'presentation.pptx',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          1024
        );
        const result = validateFile(file);

        expect(result.isValid).toBe(true);
        expect(result.category).toBe('documents');
      });
    });
  });

  describe('File Display Info', () => {
    describe('getFileDisplayInfo', () => {
      const createMockFile = (
        name: string,
        type: string,
        size: number
      ): File => {
        const file = new File(['test'], name, { type });
        Object.defineProperty(file, 'size', { value: size });
        return file;
      };

      it('should provide comprehensive display info', () => {
        const file = createMockFile('photo.jpg', 'image/jpeg', 2048);
        const info = getFileDisplayInfo(file);

        expect(info).toHaveProperty('category', 'images');
        expect(info).toHaveProperty('config');
        expect(info).toHaveProperty('icon', 'jpg');
        expect(info).toHaveProperty('previewType', 'thumbnail');
        expect(info).toHaveProperty('displayName', 'Images');
        expect(info).toHaveProperty('color', 'text-blue-500');
        expect(info).toHaveProperty('formattedSize', '2 KB');
      });

      it('should handle unknown file types gracefully', () => {
        const file = createMockFile('unknown.xyz', 'application/unknown', 1024);
        const info = getFileDisplayInfo(file);

        expect(info.category).toBeNull();
        expect(info.config).toBeNull();
        expect(info.icon).toBe('default');
        expect(info.displayName).toBe('Unknown');
        expect(info.color).toBe('text-gray-500');
      });
    });
  });
});
