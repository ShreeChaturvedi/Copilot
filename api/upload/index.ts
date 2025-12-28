import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { put as blobPut } from '@vercel/blob';
import {
  asyncHandler,
  sendSuccess,
} from '../../lib/middleware/errorHandler.js';

interface BlobPutResult {
  url: string;
  pathname?: string;
}

type PutOptions = NonNullable<Parameters<typeof blobPut>[2]>;

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'PUT') {
    res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Use PUT' },
    });
    return;
  }

  try {
    const filename = (req.query.filename as string) || `upload-${Date.now()}`;
    const contentType =
      (req.headers['content-type'] as string) || 'application/octet-stream';

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk) =>
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      );
      req.on('end', () => resolve());
      req.on('error', (err) => reject(err));
    });

    const body = Buffer.concat(chunks);
    if (!body || body.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Empty body' },
      });
      return;
    }

    // Helper: make data URI
    const toDataUri = (mime: string, buf: Buffer) =>
      `data:${mime};base64,${buf.toString('base64')}`;
    const isImage = contentType.startsWith('image/');
    const isProd = process.env.NODE_ENV === 'production';
    const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

    // DEV/No-token fallback: return data URLs (no external storage)
    // Use remote Blob in dev if a token is present
    if (!isProd && !hasBlob) {
      if (isImage) {
        try {
          const sharpMod = await import('sharp');
          const sharp = (sharpMod.default ??
            sharpMod) as typeof import('sharp');

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

          sendSuccess(
            res,
            {
              url: toDataUri('image/jpeg', optimized),
              thumbnailUrl: toDataUri('image/webp', thumb),
              size: optimized.length,
              contentType: 'image/jpeg',
              dev: true,
            },
            201
          );
          return;
        } catch {
          // sharp failed: fall back to tiny placeholder thumb + original as data URI
          const tinyPng = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAQAAACENnwnAAAAK0lEQVR42mP8//8/AyWYgQESKAYMDKwGRgYhEASDEGQhQAcxIhAGQwMAAF0gBBf3n0vTAAAAAElFTkSuQmCC',
            'base64'
          ); // 10x10 gray PNG
          sendSuccess(
            res,
            {
              url: toDataUri(contentType || 'application/octet-stream', body),
              thumbnailUrl: toDataUri('image/png', tinyPng),
              size: body.length,
              contentType,
              dev: true,
            },
            201
          );
          return;
        }
      }

      // Non-images: return single data URI
      sendSuccess(
        res,
        {
          url: toDataUri(contentType, body),
          size: body.length,
          contentType,
          dev: true,
        },
        201
      );
      return;
    }

    // Production path: store in Vercel Blob
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

export default asyncHandler(handler);
export { handler };
