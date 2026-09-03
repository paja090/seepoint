export function stablePhotoUrl(photoId: string) {
  if (!photoId || !/^[a-zA-Z0-9_-]+$/.test(photoId)) throw new Error('Invalid photo id');
  return `/api/photos/${encodeURIComponent(photoId)}/file`;
}

export function parseRequiredCoordinates(latitude: FormDataEntryValue | null, longitude: FormDataEntryValue | null) {
  const lat = typeof latitude === 'string' ? Number(latitude) : Number.NaN;
  const lng = typeof longitude === 'string' ? Number(longitude) : Number.NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export async function runPostSaveTasks(tasks: Array<{ name: string; run: () => Promise<unknown> }>) {
  const results = await Promise.allSettled(tasks.map((task) => task.run()));
  const warnings: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const name = tasks[index]?.name ?? 'unknown';
      warnings.push(name);
      console.error(`[mobile-photos/upload] Následná operace ${name} selhala`, result.reason);
    }
  });
  return warnings;
}

export async function runWithRetry<T>(operation: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.error(`[mobile-photos/upload] Pokus ${attempt}/${attempts} selhal`, error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Operace selhala');
}
