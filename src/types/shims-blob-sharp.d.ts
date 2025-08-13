declare module 'sharp' {
  const sharp: any;
  export default sharp;
}

declare module '@vercel/blob' {
  export interface BlobPutResult {
    url: string;
    pathname?: string;
  }
  export const put: (name: string, data: any, opts?: { access?: 'public' | 'private'; contentType?: string }) => Promise<BlobPutResult>;
}


