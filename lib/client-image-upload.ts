'use client';

export const PHOTO_UPLOAD_LIMIT = 4 * 1024 * 1024;
const SAFE_UPLOAD_SIZE = 3.5 * 1024 * 1024;
const MAX_DIMENSION = 2560;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateImageFile(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) return 'Povolené formáty jsou JPEG, PNG a WebP.';
  if (file.size === 0) return 'Vybraná fotografie je prázdná.';
  return null;
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Fotografii se nepodařilo zpracovat.')),
      'image/jpeg',
      quality,
    );
  });
}

export async function prepareImageForUpload(file: File) {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);
  if (file.size <= SAFE_UPLOAD_SIZE) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Fotografii se nepodařilo načíst. Zkuste ji uložit jako JPEG, PNG nebo WebP.');
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Prohlížeč nepodporuje zpracování fotografie.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let quality = 0.88;
    let blob = await canvasBlob(canvas, quality);
    while (blob.size > SAFE_UPLOAD_SIZE && quality > 0.5) {
      quality -= 0.08;
      blob = await canvasBlob(canvas, quality);
    }
    if (blob.size > PHOTO_UPLOAD_LIMIT) throw new Error('Fotografie je i po zmenšení příliš velká.');

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'fotografie';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}

export async function apiResponseMessage(response: Response, fallback: string) {
  try {
    const result = await response.json() as { error?: string; warning?: string };
    return result.error ?? result.warning ?? fallback;
  } catch {
    return response.ok ? fallback : `Požadavek selhal (HTTP ${response.status}).`;
  }
}
