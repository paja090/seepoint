import type { ReactNode } from 'react';

/** Submit the visible selection in the body so large albums do not exceed URL limits. */
export function AlbumZipDownload({ action, ids, selection = 'photoIds', className, title, children }: {
  action: string;
  ids: string[];
  selection?: 'photoIds' | 'itemIds';
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <form action={action} method="post" className="inline-flex">
      <input type="hidden" name={selection} value={[...new Set(ids)].join(',')} />
      <button type="submit" disabled={ids.length === 0} className={className} title={title}>
        {children}
      </button>
    </form>
  );
}
