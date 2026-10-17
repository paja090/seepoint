/**
 * Converts a photo URL to its low-resolution WebP thumbnail endpoint
 * for fast loading in grids, cards, lists, and map popups.
 *
 * - `/api/photos/<id>/file` -> `/api/photos/<id>/thumbnail`
 * - `/api/proposals/<token>/photos/<id>` -> `/api/proposals/<token>/photos/<id>?thumbnail=1`
 * - `/api/client/fotodokumentace/<token>/photos/<id>` -> `...?thumbnail=1`
 * - `/api/client/navigation-documentation/<token>/photos/<id>` -> `...?thumbnail=1`
 * - `/api/field-survey/photos/<id>/file` -> `...?thumbnail=1`
 */
export function toPhotoThumbnailUrl(url?: string | null, photoId?: string | null): string {
  if (!url && photoId) {
    return `/api/photos/${encodeURIComponent(photoId)}/thumbnail`;
  }
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  // Internal photo endpoint: /api/photos/<id>/file -> /api/photos/<id>/thumbnail
  if (/^\/api\/photos\/[^/?#]+\/file(\?.*)?$/.test(url)) {
    return url.replace(/\/file(\?.*)?$/, '/thumbnail');
  }
  if (/^\/api\/photos\/[^/?#]+\/thumbnail(\?.*)?$/.test(url)) {
    return url;
  }

  // Endpoints supporting ?thumbnail=1
  if (
    url.startsWith('/api/proposals/') ||
    url.startsWith('/api/client/fotodokumentace/') ||
    url.startsWith('/api/client/navigation-documentation/') ||
    url.startsWith('/api/field-survey/photos/')
  ) {
    if (url.includes('thumbnail=1')) return url;
    return `${url}${url.includes('?') ? '&' : '?'}thumbnail=1`;
  }

  if (photoId && !url.startsWith('http')) {
    return `/api/photos/${encodeURIComponent(photoId)}/thumbnail`;
  }

  return url;
}

/**
 * Converts a photo URL (potentially a thumbnail URL) to its full-resolution original file endpoint
 * for lightbox / detail views and downloads.
 */
export function toPhotoFullUrl(url?: string | null, photoId?: string | null): string {
  if (!url && photoId) {
    return `/api/photos/${encodeURIComponent(photoId)}/file`;
  }
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  // Internal photo endpoint: /api/photos/<id>/thumbnail -> /api/photos/<id>/file
  if (/^\/api\/photos\/[^/?#]+\/thumbnail(\?.*)?$/.test(url)) {
    return url.replace(/\/thumbnail(\?.*)?$/, '/file');
  }

  // Strip thumbnail=1 query parameter if present
  if (url.includes('thumbnail=1')) {
    return url
      .replace(/([?&])thumbnail=1(&?)/, (_match, prefix, suffix) => {
        if (prefix === '?' && suffix === '&') return '?';
        if (prefix === '&' && suffix === '&') return '&';
        return '';
      })
      .replace(/[?&]$/, '');
  }

  return url;
}
