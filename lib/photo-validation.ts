export const MAX_PHOTO_FILE_SIZE = 4 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export class PhotoValidationError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_UPLOAD' | 'INVALID_IMAGE' | 'PHOTO_TOO_LARGE',
    public readonly status: number,
  ) {
    super(message);
    this.name = 'PhotoValidationError';
  }
}

function detectedMimeType(header: Uint8Array) {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'image/jpeg';
  if (
    header.length >= 8
    && header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47
    && header[4] === 0x0d && header[5] === 0x0a && header[6] === 0x1a && header[7] === 0x0a
  ) return 'image/png';
  if (
    header.length >= 12
    && String.fromCharCode(...header.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...header.slice(8, 12)) === 'WEBP'
  ) return 'image/webp';
  return null;
}

export async function validatePhotoFile(
  value: FormDataEntryValue | null,
  options: { required?: boolean; maxBytes?: number } = {},
) {
  const required = options.required ?? true;
  if (!(value instanceof File)) {
    if (!required) return null;
    throw new PhotoValidationError('Chybí soubor fotografie.', 'INVALID_UPLOAD', 400);
  }

  const maxBytes = options.maxBytes ?? MAX_PHOTO_FILE_SIZE;
  if (!value.size) throw new PhotoValidationError('Fotografie je prázdná.', 'INVALID_IMAGE', 415);
  if (value.size > maxBytes) {
    throw new PhotoValidationError(
      `Fotografie musí mít nejvýše ${Math.floor(maxBytes / 1024 / 1024)} MB.`,
      'PHOTO_TOO_LARGE',
      413,
    );
  }

  const header = new Uint8Array(await value.slice(0, 12).arrayBuffer());
  const detected = detectedMimeType(header);
  const extension = value.name.split('.').pop()?.toLowerCase() || '';
  const declared = value.type.trim().toLowerCase();
  const extensionMime = MIME_BY_EXTENSION[extension] || null;

  if (!detected || (declared && declared !== detected) || (extensionMime && extensionMime !== detected)) {
    throw new PhotoValidationError(
      'Povolené formáty fotografií jsou JPEG, PNG a WebP.',
      'INVALID_IMAGE',
      415,
    );
  }

  return { file: value, mimeType: detected };
}

export function safePhotoFileName(name: string, fallback = 'photo.jpg') {
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/\.{2,}/g, '.').slice(-100) || fallback;
}

export function photoFileFromDataUrl(value: string, fileName = 'photo.jpg', maxBytes = MAX_PHOTO_FILE_SIZE) {
  if (value.length > Math.ceil(maxBytes * 4 / 3) + 100) {
    throw new PhotoValidationError(`Fotografie musí mít nejvýše ${Math.floor(maxBytes / 1024 / 1024)} MB.`, 'PHOTO_TOO_LARGE', 413);
  }
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new PhotoValidationError('Povolené formáty fotografií jsou JPEG, PNG a WebP.', 'INVALID_IMAGE', 415);
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.byteLength || bytes.byteLength > maxBytes) {
    throw new PhotoValidationError(
      bytes.byteLength ? `Fotografie musí mít nejvýše ${Math.floor(maxBytes / 1024 / 1024)} MB.` : 'Fotografie je prázdná.',
      bytes.byteLength ? 'PHOTO_TOO_LARGE' : 'INVALID_IMAGE',
      bytes.byteLength ? 413 : 415,
    );
  }
  return new File([bytes], fileName, { type: match[1] });
}
