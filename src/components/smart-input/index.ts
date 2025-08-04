/**
 * Smart Input component exports
 */

export { SmartTaskInput, type SmartTaskData } from './SmartTaskInput';
export { HighlightedInput } from './components/HighlightedInput';
export { ParsedTags, TagStats } from './components/ParsedTags';
export { useTextParser, useTextParserDebug } from './hooks/useTextParser';

// Enhanced layout components
export { EnhancedLayoutWrapper } from './components/EnhancedLayoutWrapper';
export { HighlightedTextareaField } from './components/HighlightedTextareaField';
export { EnhancedTaskInputLayout } from './components/EnhancedTaskInputLayout';

// File upload components
export { FileUploadZone, type UploadedFile } from './components/FileUploadZone';
export { FileUploadButton } from './components/FileUploadButton';
export { CompactFilePreview } from './components/CompactFilePreview';

// Re-export parsers
export * from './parsers';