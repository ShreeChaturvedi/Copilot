/**
 * Helpers for smart-input attachment handling:
 * - compress large images before upload
 * - build data-URL previews only for image/* files
 *
 * Kept outside the React component so unit tests can import without pulling
 * the full EnhancedTaskInput tree (and so react-refresh stays happy).
 */

/** Read a File as a data URL (base64). */
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Compress large images for upload. Creates a temporary object URL for the
 * source image and always revokes it (try/finally) so each compressed file
 * does not leak a blob URL.
 */
export async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  // Only compress if larger than ~1MB
  if (file.size < 1_000_000) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (e) => reject(e);
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    const maxDim = 1920; // cap dimensions
    let { width, height } = img;
    if (width > height && width > maxDim) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else if (height > maxDim) {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const quality = 0.8; // balance quality/size
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(
        resolve,
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        quality
      )
    );
    if (!blob) return file;
    return new File([blob], file.name, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Build a data-URL preview only for image/* files. PDFs, videos, and other
 * binaries are not base64-encoded into preview (that would inflate memory for
 * large non-image attachments).
 */
export async function buildAttachmentPreview(
  file: File
): Promise<string | undefined> {
  if (!file.type.startsWith('image/')) return undefined;
  return readAsDataUrl(file);
}

/**
 * Resolve the data URL used for /api/upload. Preview is only populated for
 * image/* in the composer; non-images keep their File and are base64-encoded
 * here at submit time so upload still hits the blob endpoint (and surfaces
 * 503 when BLOB_READ_WRITE_TOKEN is missing).
 */
export async function resolveAttachmentDataUrl(file: {
  preview?: string;
  file?: File;
  name?: string;
}): Promise<string> {
  if (file.preview?.startsWith('data:')) return file.preview;
  if (file.file) return readAsDataUrl(file.file);
  throw new Error(
    `Attachment "${file.name || 'file'}" has no uploadable content`
  );
}
