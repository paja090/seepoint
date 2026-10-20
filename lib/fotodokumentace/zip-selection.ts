/** An absent GET selection means the complete album; an empty selection means no photos. */
export async function readZipSelection(request: Request, field: 'photoIds' | 'itemIds' = 'photoIds'): Promise<Set<string> | null> {
  const value = request.method === 'POST'
    ? (await request.formData()).get(field)
    : new URL(request.url).searchParams.get(field);
  if (value === null && request.method !== 'POST') return null;
  return new Set(typeof value === 'string' ? value.split(',').map(id => id.trim()).filter(Boolean) : []);
}
