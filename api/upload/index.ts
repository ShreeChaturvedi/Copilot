import type { VercelRequest, VercelResponse } from '@vercel/node';
import { asyncHandler } from '../../lib/middleware/errorHandler.js';

interface BlobPutResult {
  url: string;
  pathname?: string;
}

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'PUT') {
    res
      .status(405)
      .json({
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
      res
        .status(400)
        .json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Empty body' },
        });
      return;
    }

    const { put } = await import('@vercel/blob');
    const stored: BlobPutResult = await put(filename, body, {
      access: 'public',
      contentType,
    } as { access: 'public' | 'private'; contentType?: string });

    res
      .status(201)
      .json({
        success: true,
        data: {
          url: stored.url,
          pathname: stored.pathname,
          size: body.length,
          contentType,
        },
      });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.error('Upload error', error);
    res
      .status(500)
      .json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
  }
});
