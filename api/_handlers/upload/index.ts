import type { VercelResponse } from '@vercel/node';
import type { put as blobPut } from '@vercel/blob';
import { createMethodHandler } from '../../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../../lib/types/api.js';
import { sendSuccess } from '../../../lib/middleware/errorHandler.js';

interface BlobPutResult {
  url: string;
  pathname?: string;
}

type PutOptions = NonNullable<Parameters<typeof blobPut>[2]>;

// Hard cap on the request body. Without it the handler buffered the entire
// stream into memory with no guard, so a large body could OOM the function.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

async function handler(
  req: AuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  try {
    const filename = (req.query.filename as string) || `upload-${Date.now()}`;
    const contentType =
      (req.headers['content-type'] as string) || 'application/octet-stream';

    const chunks: Buffer[] = [];
    let received = 0;
    let tooLarge = false;
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        received += buf.length;
        if (received > MAX_UPLOAD_BYTES) {
          // Stop buffering and tear down the stream so we don't hold the whole
          // oversized body in memory.
          tooLarge = true;
          req.destroy();
          resolve();
          return;
        }
        chunks.push(buf);
      });
      req.on('end', () => resolve());
      req.on('error', (err) => reject(err));
    });

    if (tooLarge) {
      res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'File exceeds the 10MB upload limit',
        },
      });
      return;
    }

    const body = Buffer.concat(chunks);
    if (!body || body.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Empty body' },
      });
      return;
    }

    const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

    // Without a blob token uploads cannot be persisted. Return an explicit 503
    // (identical to scripts/dev-server.ts) rather than silently falling back to
    // an in-memory data: URL, which masks a misconfiguration in local dev and a
    // misconfigured production deploy alike.
    if (!hasBlob) {
      res.status(503).json({
        success: false,
        error: {
          code: 'BLOB_NOT_CONFIGURED',
          message:
            'BLOB_READ_WRITE_TOKEN is not set; file uploads cannot be persisted.',
        },
      });
      return;
    }

    // Store in Vercel Blob
    const { put } = await import('@vercel/blob');

    // If image, generate optimized original + thumbnail
    if (contentType.startsWith('image/')) {
      try {
        const sharpMod = await import('sharp');
        const sharp = (sharpMod.default ?? sharpMod) as typeof import('sharp');

        const base =
          filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '') ||
          `upload-${Date.now()}`;

        // Optimized original
        const optimized = await sharp(body)
          .rotate()
          .resize({
            width: 1920,
            height: 1920,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 82, mozjpeg: true })
          .toBuffer();

        // Thumbnail
        const thumb = await sharp(body)
          .rotate()
          .resize({
            width: 512,
            height: 512,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 80 })
          .toBuffer();

        const fullOptions: PutOptions = {
          access: 'public',
          contentType: 'image/jpeg',
        };
        const fullStored: BlobPutResult = await put(
          `${base}.jpg`,
          optimized,
          fullOptions
        );

        const thumbOptions: PutOptions = {
          access: 'public',
          contentType: 'image/webp',
        };
        const thumbStored: BlobPutResult = await put(
          `${base}.thumb.webp`,
          thumb,
          thumbOptions
        );

        sendSuccess(
          res,
          {
            url: fullStored.url,
            thumbnailUrl: thumbStored.url,
            size: optimized.length,
            contentType: 'image/jpeg',
          },
          201
        );
        return;
      } catch {
        // Fallback: upload original buffer as-is
      }
    }

    const storedOptions: PutOptions = {
      access: 'public',
      contentType,
    };
    const stored: BlobPutResult = await put(filename, body, storedOptions);

    sendSuccess(
      res,
      {
        url: stored.url,
        pathname: stored.pathname,
        size: body.length,
        contentType,
      },
      201
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.error('Upload error', error);
    res
      .status(500)
      .json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
}

// Route uploads through the shared pipeline: CORS, auth (a missing/invalid
// Bearer token now 401s instead of allowing anonymous public blob writes), and
// the strict 10/hour upload rate-limit tier (previously the 100/15min default).
export default createMethodHandler(
  { [HttpMethod.PUT]: handler },
  { requireAuth: true, rateLimit: 'upload' }
);
export { handler };
