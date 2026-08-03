/**
 * Unit tests for smart-input image compression + attachment preview helpers.
 * Covers issue #104: revoke createObjectURL after compress, and only base64
 * image/* files for preview (skip PDFs/videos).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAttachmentPreview,
  compressImageIfNeeded,
  readAsDataUrl,
} from '../lib/attachmentPreview';

function makeFile(
  name: string,
  type: string,
  sizeBytes: number,
  content = 'x'
): File {
  // Prefer a sparse ArrayBuffer so tests do not allocate multi-MB strings.
  const buffer = new ArrayBuffer(sizeBytes);
  if (content && sizeBytes > 0) {
    const view = new Uint8Array(buffer);
    const seed = new TextEncoder().encode(content);
    for (let i = 0; i < Math.min(seed.length, sizeBytes); i++) {
      view[i] = seed[i];
    }
  }
  return new File([buffer], name, { type, lastModified: Date.now() });
}

describe('compressImageIfNeeded (issue #104)', () => {
  let createObjectURL: ReturnType<typeof vi.spyOn>;
  let revokeObjectURL: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-compress');
    revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});

    // Canvas path used by the compressor. jsdom has no real toBlob.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function (callback: BlobCallback | null) {
        callback?.(new Blob(['compressed'], { type: 'image/jpeg' }));
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns non-image files unchanged without creating an object URL', async () => {
    const pdf = makeFile('doc.pdf', 'application/pdf', 2_000_000);
    const result = await compressImageIfNeeded(pdf);
    expect(result).toBe(pdf);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('returns small images unchanged without creating an object URL', async () => {
    const small = makeFile('tiny.png', 'image/png', 500);
    const result = await compressImageIfNeeded(small);
    expect(result).toBe(small);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('revokes the object URL after compressing a large image', async () => {
    const large = makeFile('photo.jpg', 'image/jpeg', 1_500_000);
    const result = await compressImageIfNeeded(large);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledWith(large);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-compress');
    expect(result).not.toBe(large);
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('photo.jpg');
  });

  it('revokes the object URL even when image load fails', async () => {
    // Force Image to fail so the catch path runs; finally must still revoke.
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      private _src = '';
      get src() {
        return this._src;
      }
      set src(value: string) {
        this._src = value;
        setTimeout(() => this.onerror?.(new Error('load failed')), 0);
      }
    }
    const prev = globalThis.Image;
    globalThis.Image = FailingImage as unknown as typeof Image;

    try {
      const large = makeFile('broken.jpg', 'image/jpeg', 1_500_000);
      const result = await compressImageIfNeeded(large);
      expect(result).toBe(large);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-compress');
    } finally {
      globalThis.Image = prev;
    }
  });
});

describe('buildAttachmentPreview (issue #104)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a data URL for image/* files', async () => {
    const img = makeFile('shot.png', 'image/png', 32, 'png-bytes');
    // FileReader is real in jsdom for small blobs.
    const preview = await buildAttachmentPreview(img);
    expect(preview).toMatch(/^data:image\/png;base64,/);
  });

  it('does not base64-encode PDFs into preview', async () => {
    const readSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL');
    const pdf = makeFile('report.pdf', 'application/pdf', 50_000, '%PDF');
    const preview = await buildAttachmentPreview(pdf);
    expect(preview).toBeUndefined();
    expect(readSpy).not.toHaveBeenCalled();
  });

  it('does not base64-encode videos into preview', async () => {
    const readSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL');
    const video = makeFile('clip.mp4', 'video/mp4', 50_000, 'ftyp');
    const preview = await buildAttachmentPreview(video);
    expect(preview).toBeUndefined();
    expect(readSpy).not.toHaveBeenCalled();
  });
});

describe('readAsDataUrl', () => {
  it('reads a small file as a data URL', async () => {
    const file = makeFile('a.txt', 'text/plain', 8, 'hello');
    const dataUrl = await readAsDataUrl(file);
    expect(dataUrl).toMatch(/^data:text\/plain;base64,/);
  });
});
