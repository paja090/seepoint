import type { WorkOrderStatus, WorkType } from '@prisma/client';

export type WorkOrderPhotoEligibilityInput = {
  id: string;
  title: string;
  description?: string | null;
  status: WorkOrderStatus | string;
  workType: WorkType | string;
  ftdUrl?: string | null;
  mediaLabel?: string | null;
  locationNote?: string | null;
  crmOrderId?: string | null;
  navigationOrderId?: string | null;
  planningConstraints?: unknown;
  hasCarrierItems?: boolean;
};

export type WorkOrderDriveExportEntry = {
  driveFileId: string;
  folderId: string;
  exportedAt: string;
};

export type WorkOrderDriveExportsMeta = {
  lastFolderId?: string | null;
  lastFolderName?: string | null;
  lastFolderUrl?: string | null;
  lastExportedAt?: string | null;
  photos: Record<string, WorkOrderDriveExportEntry>;
};

const REALIZATION_WORK_TYPES = new Set<string>([
  'INSTALLATION',
  'REINSTALLATION',
  'DEINSTALLATION',
  'REPAIR',
  'CHECK',
]);

const WORKSHOP_ONLY_PATTERN =
  /\b(d[íi]ln\w*|tisk\w*|grafik\w*|dtp|faktur\w*|kancel[áa][řr]\w*|administrativ\w*|objedn[áa]vk\w* materi[áa]l\w*|p[řr][íi]prav\w* dat|[úu]klid)\b/i;

const FIELD_ACTION_PATTERN =
  /\b(mont[áa][žz]\w*|demont[áa][žz]\w*|deinstal\w*|instal\w*|reinstal\w*|v[ýy]m[ěe]n\w*|v[ýy]lep\w*|p[řr]elep\w*|polep\w*|kontrol\w*|oprav\w*|servis\w*|svoz\w*|v[ýy]jezd\w*|realizac\w*|osazen\w*|sund[áa]n\w*|odstran[ěe]n\w*)\b/i;

function readConstraints(planningConstraints: unknown): Record<string, unknown> {
  if (!planningConstraints || typeof planningConstraints !== 'object' || Array.isArray(planningConstraints)) {
    return {};
  }
  return planningConstraints as Record<string, unknown>;
}

/**
 * Determines whether a WorkOrder represents a pure workshop/office task
 * (e.g. printing, DTP, invoicing) rather than an on-site realization.
 */
export function isWorkOrderWorkshopOnly(order: WorkOrderPhotoEligibilityInput): boolean {
  const pc = readConstraints(order.planningConstraints);
  if (pc.scope === 'WORKSHOP') return true;
  if (pc.scope === 'FIELD') return false;
  if (order.hasCarrierItems) return false;

  const text = `${order.title || ''} ${order.mediaLabel || ''} ${order.locationNote || ''}`.trim();
  const hasWorkshopHint = WORKSHOP_ONLY_PATTERN.test(text);
  const hasFieldAction = FIELD_ACTION_PATTERN.test(text);

  if (hasWorkshopHint && !hasFieldAction) return true;
  return false;
}

/**
 * Variant 1A: Eligible for Mobile Photo App (/mobile-photos) right from creation.
 * Includes open field/realization WorkOrders AND any open WorkOrder that already
 * has a Google Drive photo folder / FTD link (ftdUrl).
 */
export function isWorkOrderEligibleForPhotoApp(order: WorkOrderPhotoEligibilityInput): boolean {
  if (order.status === 'DONE' || order.status === 'CANCELLED') return false;
  if (order.crmOrderId || order.navigationOrderId) return false;

  const pc = readConstraints(order.planningConstraints);
  if (pc.dispatchCampaign === true) return false;
  if (pc.ftdSkipped === true) return false;

  // Explicit Google Drive photo folder / FTD reference always makes it photo-ready
  if (order.ftdUrl && order.ftdUrl.trim().length > 0) return true;

  // Exclude pure workshop / office tasks
  if (isWorkOrderWorkshopOnly(order)) return false;

  // Realization work types, explicit field scope, or carrier-linked orders
  if (pc.scope === 'FIELD') return true;
  if (order.hasCarrierItems) return true;
  if (REALIZATION_WORK_TYPES.has(String(order.workType))) return true;

  const text = `${order.title || ''} ${order.description || ''} ${order.mediaLabel || ''}`;
  return FIELD_ACTION_PATTERN.test(text);
}

/**
 * Eligible to appear as an album in Fotodokumentace (/fotodokumentace).
 * Keeps albums visible even after the WorkOrder is marked DONE once it has photos
 * (or if it is an active eligible realization).
 */
export function isWorkOrderEligibleForPhotoDoc(
  order: WorkOrderPhotoEligibilityInput,
  photosCount: number
): boolean {
  if (order.status === 'CANCELLED') return false;
  if (order.crmOrderId || order.navigationOrderId) return false;

  const pc = readConstraints(order.planningConstraints);
  if (pc.dispatchCampaign === true) return false;
  if (pc.hiddenFromPhotoDoc === true) return false;

  if (photosCount > 0) return true;
  return isWorkOrderEligibleForPhotoApp(order);
}

/**
 * Extracts a Google Drive folder ID from a Drive URL or raw ID.
 * Returns null if the value is a plain folder name (which must be searched by name).
 */
export function extractGoogleDriveFolderId(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // https://drive.google.com/drive/folders/<ID> or /drive/u/0/folders/<ID>
  const folderPathMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]{15,80})/);
  if (folderPathMatch?.[1]) return folderPathMatch[1];

  // https://drive.google.com/open?id=<ID> or ?id=<ID>
  if (/drive\.google\.com/i.test(trimmed)) {
    try {
      const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
      const idParam = url.searchParams.get('id');
      if (idParam && /^[a-zA-Z0-9_-]{15,80}$/.test(idParam)) {
        return idParam;
      }
    } catch {
      // Ignore invalid URL parse
    }
  }

  // Raw Drive ID (no spaces, typical Google Drive ID length 25-60)
  if (/^[a-zA-Z0-9_-]{25,60}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Reads previously exported photo metadata from WorkOrder.planningConstraints.
 */
export function readWorkOrderDriveExports(planningConstraints: unknown): WorkOrderDriveExportsMeta {
  const pc = readConstraints(planningConstraints);
  const raw = pc.driveExports;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { photos: {} };
  }
  const obj = raw as Record<string, unknown>;
  const photos: Record<string, WorkOrderDriveExportEntry> = {};
  if (obj.photos && typeof obj.photos === 'object' && !Array.isArray(obj.photos)) {
    for (const [photoId, entry] of Object.entries(obj.photos as Record<string, unknown>)) {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const e = entry as Record<string, unknown>;
        if (typeof e.driveFileId === 'string' && typeof e.folderId === 'string') {
          photos[photoId] = {
            driveFileId: e.driveFileId,
            folderId: e.folderId,
            exportedAt: typeof e.exportedAt === 'string' ? e.exportedAt : '',
          };
        }
      }
    }
  }
  return {
    lastFolderId: typeof obj.lastFolderId === 'string' ? obj.lastFolderId : null,
    lastFolderName: typeof obj.lastFolderName === 'string' ? obj.lastFolderName : null,
    lastFolderUrl: typeof obj.lastFolderUrl === 'string' ? obj.lastFolderUrl : null,
    lastExportedAt: typeof obj.lastExportedAt === 'string' ? obj.lastExportedAt : null,
    photos,
  };
}

/**
 * Merges newly exported Drive file mappings into WorkOrder.planningConstraints without clobbering existing fields.
 */
export function mergeWorkOrderDriveExports(
  planningConstraints: unknown,
  update: {
    folderId: string;
    folderName: string;
    folderUrl: string;
    exportedAt: string;
    newEntries: Record<string, WorkOrderDriveExportEntry>;
  }
): Record<string, unknown> {
  const pc = readConstraints(planningConstraints);
  const current = readWorkOrderDriveExports(planningConstraints);
  return {
    ...pc,
    driveExports: {
      lastFolderId: update.folderId,
      lastFolderName: update.folderName,
      lastFolderUrl: update.folderUrl,
      lastExportedAt: update.exportedAt,
      photos: {
        ...current.photos,
        ...update.newEntries,
      },
    },
  };
}
