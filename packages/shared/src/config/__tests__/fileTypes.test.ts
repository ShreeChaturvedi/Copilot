import { describe, expect, it } from 'vitest';
import {
  ALL_SUPPORTED_EXTENSIONS,
  ALL_SUPPORTED_MIME_TYPES,
  FILE_TYPE_CONFIGS,
  getFileTypeCategory,
  getFileTypeCategoryByExtension,
  isSupportedFileType,
} from '../fileTypes';

describe('file type configuration', () => {
  it('detects categories from MIME types', () => {
    expect(getFileTypeCategory('image/jpeg')).toBe('images');
    expect(getFileTypeCategory('text/plain')).toBe('documents');
    expect(getFileTypeCategory('application/zip')).toBe('archives');
  });

  it('returns null for unknown MIME types', () => {
    expect(getFileTypeCategory('application/unknown')).toBeNull();
  });

  it('detects categories from file extensions', () => {
    expect(getFileTypeCategoryByExtension('photo.JPG')).toBe('images');
    expect(getFileTypeCategoryByExtension('archive.7z')).toBe('archives');
  });

  it('reports supported types correctly', () => {
    expect(isSupportedFileType('image/png')).toBe(true);
    expect(isSupportedFileType('application/x-doom')).toBe(false);
  });

  it('exports expected supported lists', () => {
    expect(ALL_SUPPORTED_MIME_TYPES).toContain('image/jpeg');
    expect(ALL_SUPPORTED_EXTENSIONS).toContain('pdf');
    expect(FILE_TYPE_CONFIGS.images.previewType).toBe('thumbnail');
  });
});
