/**
 * Client-side photo processing and validation helpers for mobile and field workflows.
 *
 * Designed to run safely in the browser (no Node.js Buffer, fs, etc.).
 * Automatically downscales large phone camera photos (max 2560px),
 * converts to standard JPEG (quality ~0.84), ensures size safely under 4 MB (target <= 3.5 MB),
 * normalizes iPhone HEIC/HEIF when decoder is available, and provides friendly Czech error messages.
 */

export const CLIENT_PHOTO_LIMITS = {
  MAX_UPLOAD_BYTES: 4 * 1024 * 1024, // 4 MB backend hard limit
  TARGET_MAX_BYTES: 3.5 * 1024 * 1024, // 3.5 MB safe target limit
  MAX_DIMENSION: 2560, // Maximum long edge in px for high-res documentation
  INITIAL_QUALITY: 0.84, // Initial JPEG quality (crisp zoom & client presentation)
  MIN_QUALITY: 0.60, // Floor quality for high-detail photos
  MIN_DIMENSION: 1280, // Floor dimension if step-down downscaling is required
};

export const SUPPORTED_CLIENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const HEIC_EXTENSIONS = ['.heic', '.heif'];
export const HEIC_MIME_TYPES = ['image/heic', 'image/heif'];

export class ClientPhotoError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'EMPTY_FILE'
      | 'UNSUPPORTED_FORMAT'
      | 'PHOTO_TOO_LARGE'
      | 'HEIC_UNSUPPORTED'
      | 'DECODE_FAILED'
      | 'PROCESSING_FAILED'
  ) {
    super(message);
    this.name = 'ClientPhotoError';
  }
}

/**
 * Checks if a file is an iPhone HEIC/HEIF photo by MIME type or file extension.
 */
export function isHeicFile(file: { name?: string; type?: string } | null | undefined): boolean {
  if (!file) return false;
  const declared = (file.type || '').toLowerCase().trim();
  if (HEIC_MIME_TYPES.includes(declared)) return true;
  const name = (file.name || '').toLowerCase().trim();
  return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Checks if a file is an accepted input format for camera/upload.
 * Accepts JPEG, PNG, WebP, and HEIC/HEIF (which will be converted to JPEG).
 */
export function isAcceptedPhotoInput(file: { name?: string; type?: string } | null | undefined): boolean {
  if (!file) return false;
  const declared = (file.type || '').toLowerCase().trim();
  if (SUPPORTED_CLIENT_MIME_TYPES.includes(declared)) return true;
  if (isHeicFile(file)) return true;
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext);
}

/**
 * Sanitizes base filename to avoid unsafe characters.
 */
export function safePhotoBaseName(fileName: string): string {
  const base = fileName.replace(/\.[^/.]+$/, '').trim();
  return base.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(-80) || 'photo';
}

/**
 * Computes target dimensions keeping aspect ratio within maxDimension.
 */
export function computeTargetDimensions(
  origWidth: number,
  origHeight: number,
  maxDimension = CLIENT_PHOTO_LIMITS.MAX_DIMENSION
): { width: number; height: number } {
  if (origWidth <= 0 || origHeight <= 0) {
    return { width: maxDimension, height: maxDimension };
  }
  if (origWidth <= maxDimension && origHeight <= maxDimension) {
    return { width: origWidth, height: origHeight };
  }
  if (origWidth >= origHeight) {
    const height = Math.max(1, Math.round((origHeight * maxDimension) / origWidth));
    return { width: maxDimension, height };
  } else {
    const width = Math.max(1, Math.round((origWidth * maxDimension) / origHeight));
    return { width, height: maxDimension };
  }
}

/**
 * Defensive pre-submit validation before FormData is constructed.
 */
export function validatePhotoBeforeUpload(file: File | null | undefined): { ok: boolean; error?: string } {
  if (!file || file.size === 0) {
    return { ok: false, error: 'Fotografie je prázdná.' };
  }
  if (file.size > CLIENT_PHOTO_LIMITS.MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: 'Fotografie je příliš velká. Aplikace ji nedokázala automaticky zmenšit. Zkuste fotografii pořídit znovu.',
    };
  }
  if (isHeicFile(file)) {
    return {
      ok: false,
      error: 'Formát HEIC musí být před odesláním převeden na JPEG.',
    };
  }
  const declared = file.type.toLowerCase().trim();
  if (!SUPPORTED_CLIENT_MIME_TYPES.includes(declared)) {
    const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      return {
        ok: false,
        error: 'Použijte fotografii ve formátu JPEG, PNG nebo WebP.',
      };
    }
  }
  return { ok: true };
}

/**
 * Converts any error or raw exception into a clean, friendly Czech message.
 * Filters out browser-specific technical errors such as DOMException or pattern errors.
 */
export function getFriendlyPhotoErrorMessage(err: unknown): string {
  if (!err) return 'Fotografii se nepodařilo odeslat. Zkontrolujte připojení a zkuste to znovu.';

  if (err instanceof ClientPhotoError) {
    return err.message;
  }

  const message =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err);

  // Specific domain codes
  if (message.includes('PHOTO_TOO_LARGE') || message.includes('413')) {
    return 'Fotografie je příliš velká. Aplikace ji nedokázala automaticky zmenšit. Zkuste fotografii pořídit znovu.';
  }
  if (message.includes('INVALID_IMAGE') || message.includes('415')) {
    return 'Použijte fotografii ve formátu JPEG, PNG nebo WebP.';
  }
  if (message.includes('GPS_REQUIRED')) {
    return 'Pro vytvoření nové plochy v terénu je nutná GPS poloha.';
  }
  if (message.includes('NAME_REQUIRED')) {
    return 'Vyplňte prosím název reklamní plochy.';
  }
  if (message.includes('CITY_REQUIRED')) {
    return 'Vyplňte prosím město nebo obec.';
  }
  if (message.includes('HEIC_UNSUPPORTED')) {
    return 'Tuto fotografii se nepodařilo zpracovat. Zkuste ji prosím vyfotit znovu.';
  }

  // Technical browser errors to never show to end users
  const rawTechnicalPhrases = [
    'the string did not match the expected pattern',
    'failed to fetch',
    'networkerror',
    'load failed',
    'aborterror',
    'domexception',
    'unexpected token',
    'json.parse',
    'syntaxerror',
    'undefined is not an object',
    'null is not an object',
    'typeerror',
    'fetch',
  ];

  const lower = message.toLowerCase();
  if (rawTechnicalPhrases.some((phrase) => lower.includes(phrase))) {
    return 'Fotografii se nepodařilo odeslat. Zkontrolujte připojení a zkuste to znovu.';
  }

  // Clean existing Czech messages without technical stack traces
  if (/[áčďéěíňóřšťúůýž]/i.test(message) && message.length < 200 && !message.includes('Error:')) {
    return message;
  }

  return 'Fotografii se nepodařilo odeslat. Zkontrolujte připojení a zkuste to znovu.';
}

/**
 * Safely parses API responses, handling HTTP 413, HTML error pages, timeouts, and JSON failures.
 */
export async function parseApiResponseSafely<T = Record<string, unknown>>(
  res: Response
): Promise<{
  ok: boolean;
  status: number;
  data: T | null;
  errorMessage: string | null;
}> {
  const status = res.status;
  let responseText = '';

  try {
    responseText = await res.text();
  } catch {
    return {
      ok: false,
      status,
      data: null,
      errorMessage: 'Fotografii se nepodařilo odeslat. Zkontrolujte připojení a zkuste to znovu.',
    };
  }

  let data: Record<string, unknown> | null = null;
  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      // Server returned HTML or empty response (e.g. proxy 413 or 504)
      data = null;
    }
  }

  if (!res.ok) {
    if (status === 413 || data?.code === 'PHOTO_TOO_LARGE') {
      return {
        ok: false,
        status,
        data: data as T | null,
        errorMessage:
          'Fotografie je příliš velká. Aplikace ji nedokázala automaticky zmenšit. Zkuste fotografii pořídit znovu.',
      };
    }
    if (status === 415 || data?.code === 'INVALID_IMAGE') {
      return {
        ok: false,
        status,
        data: data as T | null,
        errorMessage: 'Formát fotografie není podporován. Použijte JPEG, PNG nebo WebP.',
      };
    }
    const customError = typeof data?.error === 'string' ? data.error : null;
    if (customError && customError.trim()) {
      return {
        ok: false,
        status,
        data: data as T | null,
        errorMessage: customError,
      };
    }
    return {
      ok: false,
      status,
      data: data as T | null,
      errorMessage: 'Nepodařilo se vytvořit nosič. Zkontrolujte připojení a zkuste to znovu.',
    };
  }

  if (data && data.success === false) {
    return {
      ok: false,
      status,
      data: data as T | null,
      errorMessage:
        typeof data.error === 'string' && data.error.trim()
          ? data.error
          : 'Nepodařilo se vytvořit novou reklamní plochu.',
    };
  }

  return {
    ok: true,
    status,
    data: data as T | null,
    errorMessage: null,
  };
}

export type ProcessPhotoOptions = {
  maxDimension?: number;
  initialQuality?: number;
  maxBytes?: number;
  minQuality?: number;
  minDimension?: number;
  customRenderer?: (
    file: File,
    options: ProcessPhotoOptions
  ) => Promise<{ file: File; width: number; height: number; originalBytes: number; processedBytes: number }>;
};

export type ProcessedPhotoResult = {
  file: File;
  width: number;
  height: number;
  originalBytes: number;
  processedBytes: number;
  wasCompressed: boolean;
};

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    } catch {
      resolve(null);
    }
  });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('IMAGE_LOAD_FAILED'));
    };
    img.src = url;
  });
}

/**
 * Prepares a photo on the client before upload:
 * - Decodes using createImageBitmap or HTMLImageElement (respecting orientation)
 * - Downscales to maxDimension (default 2560px)
 * - Converts to standard JPEG with quality ~0.84
 * - Iteratively steps down quality / dimension if necessary to stay under targetMaxBytes (3.5 MB)
 * - Converts iPhone HEIC to JPEG; if decoding is not supported by the browser, yields a friendly Czech message.
 */
export async function processPhotoForUpload(
  file: File,
  options: ProcessPhotoOptions = {}
): Promise<ProcessedPhotoResult> {
  if (!file || file.size === 0) {
    throw new ClientPhotoError('Fotografie je prázdná.', 'EMPTY_FILE');
  }

  if (!isAcceptedPhotoInput(file)) {
    throw new ClientPhotoError('Použijte fotografii ve formátu JPEG, PNG nebo WebP.', 'UNSUPPORTED_FORMAT');
  }

  if (options.customRenderer) {
    const customResult = await options.customRenderer(file, options);
    return {
      ...customResult,
      wasCompressed: true,
    };
  }

  // If running in a non-browser environment (e.g. Node tests without custom renderer)
  if (typeof document === 'undefined') {
    if (file.size <= (options.maxBytes ?? CLIENT_PHOTO_LIMITS.TARGET_MAX_BYTES) && !isHeicFile(file)) {
      return {
        file,
        width: 1920,
        height: 1080,
        originalBytes: file.size,
        processedBytes: file.size,
        wasCompressed: false,
      };
    }
    throw new ClientPhotoError('Prostředí nepodporuje grafické vykreslování.', 'PROCESSING_FAILED');
  }

  let imgBitmap: ImageBitmap | null = null;
  let htmlImg: HTMLImageElement | null = null;
  let origWidth = 0;
  let origHeight = 0;

  // 1. Try createImageBitmap with EXIF orientation handling
  if (typeof createImageBitmap === 'function') {
    try {
      imgBitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      origWidth = imgBitmap.width;
      origHeight = imgBitmap.height;
    } catch {
      imgBitmap = null;
    }
  }

  // 2. Fallback to HTMLImageElement
  if (!imgBitmap) {
    try {
      htmlImg = await loadImageElement(file);
      origWidth = htmlImg.naturalWidth || htmlImg.width;
      origHeight = htmlImg.naturalHeight || htmlImg.height;
    } catch {
      if (isHeicFile(file)) {
        throw new ClientPhotoError(
          'Tuto fotografii se nepodařilo zpracovat. Zkuste ji prosím vyfotit znovu.',
          'HEIC_UNSUPPORTED'
        );
      }
      throw new ClientPhotoError(
        'Tuto fotografii se nepodařilo načíst. Zkuste ji prosím vyfotit znovu.',
        'DECODE_FAILED'
      );
    }
  }

  const maxDim = options.maxDimension ?? CLIENT_PHOTO_LIMITS.MAX_DIMENSION;
  const { width: targetWidth, height: targetHeight } = computeTargetDimensions(origWidth, origHeight, maxDim);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    if (imgBitmap) imgBitmap.close();
    throw new ClientPhotoError('Chyba při přípravě plátna pro kompresi.', 'PROCESSING_FAILED');
  }

  if (imgBitmap) {
    ctx.drawImage(imgBitmap, 0, 0, targetWidth, targetHeight);
    imgBitmap.close();
  } else if (htmlImg) {
    ctx.drawImage(htmlImg, 0, 0, targetWidth, targetHeight);
  }

  const targetMaxBytes = options.maxBytes ?? CLIENT_PHOTO_LIMITS.TARGET_MAX_BYTES;
  let currentQuality = options.initialQuality ?? CLIENT_PHOTO_LIMITS.INITIAL_QUALITY;
  let blob = await canvasToBlob(canvas, 'image/jpeg', currentQuality);

  if (!blob) {
    throw new ClientPhotoError('Chyba při ukládání zpracované fotografie.', 'PROCESSING_FAILED');
  }

  // Step-down compression loop if still above targetMaxBytes (3.5 MB)
  const qualitySteps = [0.78, 0.72, 0.65, 0.60];
  let stepIdx = 0;
  while (blob.size > targetMaxBytes && stepIdx < qualitySteps.length) {
    currentQuality = qualitySteps[stepIdx];
    const nextBlob = await canvasToBlob(canvas, 'image/jpeg', currentQuality);
    if (!nextBlob) break;
    blob = nextBlob;
    stepIdx++;
  }

  // If still above target, scale down canvas resolution gradually
  if (blob && blob.size > targetMaxBytes && htmlImg) {
    const scaleFactors = [0.8, 0.7, 0.6];
    const minDim = options.minDimension ?? CLIENT_PHOTO_LIMITS.MIN_DIMENSION;
    for (const factor of scaleFactors) {
      const scaledW = Math.round(targetWidth * factor);
      const scaledH = Math.round(targetHeight * factor);
      if (scaledW < minDim && scaledH < minDim) break;

      canvas.width = scaledW;
      canvas.height = scaledH;
      ctx.drawImage(htmlImg, 0, 0, scaledW, scaledH);
      const downscaledBlob = await canvasToBlob(canvas, 'image/jpeg', 0.75);
      if (downscaledBlob) {
        blob = downscaledBlob;
        if (blob.size <= targetMaxBytes) break;
      }
    }
  }

  if (!blob || blob.size === 0) {
    throw new ClientPhotoError('Fotografii se nepodařilo zkomprimovat.', 'PROCESSING_FAILED');
  }

  if (blob.size > CLIENT_PHOTO_LIMITS.MAX_UPLOAD_BYTES) {
    throw new ClientPhotoError(
      'Fotografie je příliš velká. Aplikace ji nedokázala automaticky zmenšit. Zkuste fotografii pořídit znovu.',
      'PHOTO_TOO_LARGE'
    );
  }

  const baseName = safePhotoBaseName(file.name);
  const finalFile = new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });

  return {
    file: finalFile,
    width: canvas.width,
    height: canvas.height,
    originalBytes: file.size,
    processedBytes: finalFile.size,
    wasCompressed: true,
  };
}
