import { coordinates, zonedTime, parseConstraints } from '../field-planning/profile';
import { calculateMediaLoadSlots, calculateServiceMinutes, ELECTION_REMOVAL_MEDIA_LABELS, type ElectionRemovalMediaType } from './constants';
import { cleanLayerName, isGenericLayerName } from './point-metadata';

export const operations = {
  INSTALL_OBJECT: 'Instalace konstrukce / objektu',
  INSTALL_AD: 'Instalace reklamního materiálu',
  REPLACE_AD: 'Výměna reklamního materiálu',
  REMOVE_AD: 'Odstranění reklamního materiálu',
  REMOVE_OBJECT: 'Demontáž konstrukce / objektu',
  RELOCATION: 'Přesun', REPAIR: 'Oprava', INSPECTION: 'Kontrola', OTHER: 'Jiná práce',
} as const;
export type Operation = keyof typeof operations;
export const dispositions = { LEAVE: 'Ponechat na místě', WAREHOUSE: 'Odvézt do skladu', TRANSFER: 'Převézt na jiné místo', CLIENT: 'Předat klientovi', OTHER: 'Jiný popsaný postup' } as const;
export type Disposition = keyof typeof dispositions;
export function normalizeOperation(value: unknown): Operation {
  const op = value === 'FULL_REMOVAL' ? 'REMOVE_OBJECT' : value === 'BANNER_CHANGE' ? 'REPLACE_AD' : value;
  if (typeof op !== 'string' || !Object.hasOwn(operations, op)) throw new Error('Vyberte platnou operaci.');
  return op as Operation;
}
export type TaskSpec = {
  label: string; description: string; mediaType: ElectionRemovalMediaType; objectType: string;
  latitude: number; longitude: number; quantity: number; operationType: Operation;
  gpsConfirmed?: boolean; destinationGpsConfirmed?: boolean;
  materialDisposition: Disposition; materialInstructions: string; destinationName: string;
  destinationLatitude: number | null; destinationLongitude: number | null;
  carrierId: string | null; surfaceId: string | null; referenceUrl: string | null;
  contact: string; accessInstructions: string; serviceMinutes: number; deliveryMinutes: number;
  loadSlots: number; requiredWorkers: number; requiredPositions: string[]; requiredEquipment: string[];
  deadlineAt: Date | null; windowStart: Date | null; windowEnd: Date | null;
  layerName?: string | null;
};
const text = (v: unknown, max = 4000) => { if (v == null) return ''; if (typeof v !== 'string' || v.length > max) throw new Error('Neplatný nebo příliš dlouhý text.'); return v.trim(); };
const integer = (v: unknown, min: number, max: number) => { if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new Error(`Zadejte celé číslo ${min}–${max}.`); return v; };
const list = (v: unknown) => { if (v == null) return []; if (!Array.isArray(v) || v.length > 30) throw new Error('Neplatné požadavky.'); return [...new Set(v.map(x => text(x, 100)).filter(Boolean))]; };
export function parseTaskSpec(raw: unknown): TaskSpec {
  if (!raw || typeof raw !== 'object') throw new Error('Chybí zadání práce.');
  const p = raw as Record<string, unknown>;
  const operationType = normalizeOperation(p.operationType);
  const window = parseConstraints(Object.fromEntries(['windowStart','windowEnd'].filter(k => p[k]).map(k => [k, p[k] instanceof Date ? (p[k] as Date).toISOString() : p[k]])));
  const label = text(p.label ?? p.name, 200), description = text(p.description ?? p.note);
  if (!label || (operationType === 'OTHER' && !description)) throw new Error('Vyplňte název a přesný popis jiné práce.');
  if (!coordinates({ latitude: p.latitude, longitude: p.longitude }) || p.gpsConfirmed !== true) throw new Error('Potvrďte GPS místa práce.');
  const mediaType = String(p.mediaType ?? 'OTHER') as ElectionRemovalMediaType;
  if (!['ACKO', 'TOWER', 'MINI_TOWER', 'BENCH', 'CITY_POSTER', 'BANNER', 'PLOT', 'OTHER'].includes(mediaType)) throw new Error('Neplatný typ média.');
  const objectType = text(p.objectType ?? mediaType, 100);
  if (!objectType) throw new Error('Vyplňte typ objektu.');
  const quantity = integer(p.quantity ?? 1, 1, 10000);
  const materialDisposition = p.materialDisposition as Disposition;
  if (typeof materialDisposition !== 'string' || !Object.hasOwn(dispositions, materialDisposition)) throw new Error('Určete nakládání s materiálem.');
  const materialInstructions = text(p.materialInstructions);
  if (materialDisposition === 'OTHER' && !materialInstructions) throw new Error('Popište nakládání s materiálem.');
  if (operationType === 'RELOCATION' && !['TRANSFER', 'CLIENT', 'WAREHOUSE'].includes(materialDisposition)) throw new Error('Přesun vyžaduje cíl přepravy.');
  const transport = ['TRANSFER', 'WAREHOUSE', 'CLIENT'].includes(materialDisposition);
  const destination = { latitude: p.destinationLatitude, longitude: p.destinationLongitude };
  if (transport && (!coordinates(destination) || p.destinationGpsConfirmed !== true || !text(p.destinationName))) throw new Error('Přeprava vyžaduje pojmenovaný cíl a potvrzenou cílovou GPS.');
  const legacyOp = operationType === 'REPLACE_AD' || operationType === 'REMOVE_AD' || operationType === 'INSTALL_AD' ? 'BANNER_CHANGE' : operationType === 'RELOCATION' ? 'RELOCATION' : 'FULL_REMOVAL';
  const defaultSlots = transport ? Math.max(1, calculateMediaLoadSlots(mediaType, legacyOp, quantity)) : 0;
  const loadSlots = integer(p.loadSlots ?? defaultSlots, 0, 100000);
  if (transport && loadSlots === 0) throw new Error('Určete skutečný nárok přepravovaného materiálu na kapacitu (alespoň 1 slot).');
  const referenceUrl = text(p.referenceUrl, 2000) || null;
  if (referenceUrl && !/^https?:\/\//.test(referenceUrl)) throw new Error('Podklad musí být HTTP(S) odkaz.');
  if (p.deadlineAt && !Number.isFinite(new Date(String(p.deadlineAt)).getTime())) throw new Error('Neplatný termín práce.');
  return { windowStart: window.windowStart ? new Date(window.windowStart) : null, windowEnd: window.windowEnd ? new Date(window.windowEnd) : null, label, description, mediaType, objectType, latitude: Number(p.latitude), longitude: Number(p.longitude), gpsConfirmed: true, quantity, operationType,
    deadlineAt: p.deadlineAt ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(p.deadlineAt)) ? zonedTime(String(p.deadlineAt), '23:59', 'Europe/Prague') : new Date(String(p.deadlineAt)).getTime()) : null,
    materialDisposition, materialInstructions, destinationName: text(p.destinationName, 200),
    destinationLatitude: transport ? Number(p.destinationLatitude) : null, destinationLongitude: transport ? Number(p.destinationLongitude) : null, destinationGpsConfirmed: transport,
    carrierId: text(p.carrierId, 100) || null, surfaceId: text(p.surfaceId, 100) || null, referenceUrl,
    contact: text(p.contact, 500), accessInstructions: text(p.accessInstructions),
    layerName: text(p.layerName, 200) || null,
    serviceMinutes: integer(p.serviceMinutes ?? calculateServiceMinutes(mediaType, quantity, null, legacyOp).totalMinutes, 1, 1440),
    deliveryMinutes: integer(p.deliveryMinutes ?? Math.max(5, quantity * 3), 1, 1440), loadSlots,
    requiredWorkers: integer(p.requiredWorkers ?? 1, 1, 20), requiredPositions: list(p.requiredPositions), requiredEquipment: list(p.requiredEquipment) };
}

export function taskSteps(spec: TaskSpec) {
  const transport = spec.destinationLatitude !== null;
  const photoType = ['REMOVE_OBJECT', 'REMOVE_AD'].includes(spec.operationType) ? 'AFTER_DEINSTALLATION' as const
    : ['INSTALL_OBJECT', 'INSTALL_AD', 'REPLACE_AD'].includes(spec.operationType) ? 'AFTER_INSTALLATION' as const : 'CONTROL' as const;
  const source = { sequence: 1, kind: transport ? 'PICKUP' : 'WORK', label: `${transport && spec.operationType.startsWith('INSTALL') ? 'Vyzvednutí a nakládka' : operations[spec.operationType]} — ${spec.label}`,
    latitude: spec.latitude, longitude: spec.longitude, serviceMinutes: spec.serviceMinutes, quantity: spec.quantity,
    loadDelta: transport ? spec.loadSlots : 0, photoType: transport && spec.operationType.startsWith('INSTALL') ? 'CONTROL' as const : photoType };
  // For installation from a warehouse the source is explicitly the warehouse and the destination the installation site.
  return transport ? [source, { sequence: 2, kind: 'DELIVERY', label: `${spec.operationType.startsWith('INSTALL') ? 'Vykládka a instalace' : 'Vykládka / předání'} — ${spec.destinationName}`,
    latitude: spec.destinationLatitude!, longitude: spec.destinationLongitude!, serviceMinutes: spec.deliveryMinutes, quantity: spec.quantity,
    loadDelta: -spec.loadSlots, photoType: spec.operationType.startsWith('INSTALL') ? 'AFTER_INSTALLATION' as const : 'CONTROL' as const }] : [source];
}

export function taskInstructions(p: {
  operationType?: string | null;
  label: string;
  objectType?: string | null;
  mediaType: string;
  quantity: number;
  description?: string | null;
  materialDisposition?: string | null;
  materialInstructions?: string | null;
  destinationName?: string | null;
  contact?: string | null;
  accessInstructions?: string | null;
  clientName?: string | null;
  layerName?: string | null;
}) {
  const mediaLabel =
    (p.objectType && !['BENCH', 'ACKO', 'TOWER', 'MINI_TOWER', 'BANNER', 'CITY_POSTER', 'PLOT', 'OTHER'].includes(p.objectType))
      ? p.objectType
      : (ELECTION_REMOVAL_MEDIA_LABELS[p.mediaType as keyof typeof ELECTION_REMOVAL_MEDIA_LABELS] || p.objectType || p.mediaType);

  const clientOrMotif = p.clientName || (p.layerName && !isGenericLayerName(p.layerName) ? cleanLayerName(p.layerName) : null);

  return [
    p.operationType && operations[p.operationType as Operation],
    `${mediaLabel} — ${p.quantity} ks`,
    clientOrMotif ? `Klient / Motiv: ${clientOrMotif}` : null,
    p.description,
    p.materialDisposition && dispositions[p.materialDisposition as Disposition],
    p.materialInstructions,
    p.destinationName && `Cíl: ${p.destinationName}`,
    p.contact && `Kontakt: ${p.contact}`,
    p.accessInstructions,
  ].filter(Boolean).join('. ');
}

export function getCampaignOperationLabel(
  points: Array<{ operationType?: string | null }>,
  campaignName?: string,
): {
  progressLabel: string;
  badgeLabel: string;
  verbDoneLabel: string;
} {
  const counts: Record<string, number> = {};
  for (const p of points) {
    const op = p.operationType;
    if (op) {
      counts[op] = (counts[op] || 0) + 1;
    }
  }

  const nameLower = (campaignName || '').toLowerCase();
  const isRemovalByName = /demontáž|odstraněn|snesení|likvidac/i.test(nameLower);
  const isInstallByName = !isRemovalByName && /montáž|instalac|osazení|výlep/i.test(nameLower);
  const isRelocationByName = /přesun|relokac/i.test(nameLower);
  const isReplaceByName = /výměn|přelep|prelep/i.test(nameLower);
  const isInspectionByName = /kontrol|reviz/i.test(nameLower);

  const installCount = (counts['INSTALL_OBJECT'] || 0) + (counts['INSTALL_AD'] || 0);
  const removalCount = (counts['REMOVE_OBJECT'] || 0) + (counts['REMOVE_AD'] || 0) + (counts['FULL_REMOVAL'] || 0);
  const relocationCount = counts['RELOCATION'] || 0;
  const replaceCount = (counts['REPLACE_AD'] || 0) + (counts['BANNER_CHANGE'] || 0);
  const inspectionCount = counts['INSPECTION'] || 0;

  if (installCount > 0 && installCount >= removalCount && installCount >= relocationCount) {
    return { progressLabel: 'Postup montáže', badgeLabel: 'Montáž', verbDoneLabel: 'namontováno' };
  }
  if (relocationCount > 0 && relocationCount >= removalCount && relocationCount >= installCount) {
    return { progressLabel: 'Postup přesunu', badgeLabel: 'Přesun', verbDoneLabel: 'přesunuto' };
  }
  if (replaceCount > 0 && replaceCount >= removalCount && replaceCount >= installCount) {
    return { progressLabel: 'Postup výměny', badgeLabel: 'Výměna', verbDoneLabel: 'vyměněno' };
  }
  if (inspectionCount > 0 && inspectionCount >= removalCount) {
    return { progressLabel: 'Postup kontroly', badgeLabel: 'Kontrola', verbDoneLabel: 'zkontrolováno' };
  }
  if (removalCount > 0) {
    return { progressLabel: 'Postup demontáže', badgeLabel: 'Demontáž', verbDoneLabel: 'demontováno' };
  }

  // Fallbacks by campaign name if points operationType is not explicitly set
  if (isInstallByName) return { progressLabel: 'Postup montáže', badgeLabel: 'Montáž', verbDoneLabel: 'namontováno' };
  if (isRelocationByName) return { progressLabel: 'Postup přesunu', badgeLabel: 'Přesun', verbDoneLabel: 'přesunuto' };
  if (isReplaceByName) return { progressLabel: 'Postup výměny', badgeLabel: 'Výměna', verbDoneLabel: 'vyměněno' };
  if (isInspectionByName) return { progressLabel: 'Postup kontroly', badgeLabel: 'Kontrola', verbDoneLabel: 'zkontrolováno' };
  if (isRemovalByName) return { progressLabel: 'Postup demontáže', badgeLabel: 'Demontáž', verbDoneLabel: 'demontováno' };

  return { progressLabel: 'Postup realizace', badgeLabel: 'Terénní práce', verbDoneLabel: 'dokončeno' };
}
