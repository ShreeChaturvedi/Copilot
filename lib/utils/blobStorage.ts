/**
 * Vercel Blob storage cleanup helpers.
 *
 * Uploads are stored either as Vercel Blob URLs (https) in production or as
 * inline data: URIs in the dev/no-token fallback. Only blob URLs reference
 * external storage that needs cleanup; data: URIs and empty values are skipped.
 */

/**
 * Whether a stored fileUrl points at an external blob that can be deleted.
 * data: URIs (the uploader fallback) and empty values return false.
 */
export function isBlobUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

/**
 * Delete a single blob by URL. No-op for non-blob URLs (e.g. data: URIs) or
 * when BLOB_READ_WRITE_TOKEN is not configured. Storage errors (including an
 * already-deleted blob) are logged and swallowed so one failure never aborts a
 * larger delete or cleanup operation.
 */
export async function deleteBlob(url: string | null | undefined): Promise<void> {
  if (!isBlobUrl(url)) return;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  try {
    const { del } = await import('@vercel/blob');
    await del(url as string, { token });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to delete blob', { url, error: message });
  }
}

/**
 * Delete many blobs, de-duplicating and skipping non-blob URLs. Each deletion
 * is independent; a failure on one URL does not stop the rest.
 */
export async function deleteBlobs(
  urls: Array<string | null | undefined>
): Promise<void> {
  const unique = Array.from(
    new Set(urls.filter((u): u is string => isBlobUrl(u)).map((u) => u.trim()))
  );
  for (const url of unique) {
    await deleteBlob(url);
  }
}
