import { PrintFormatType, PrintMaterialType, type PrintProductionStatus } from '@prisma/client';

export const PRINT_TRANSITIONS: Record<PrintProductionStatus, readonly PrintProductionStatus[]> = {
  PREPARATION: ['CLIENT_APPROVAL'], CLIENT_APPROVAL: ['IN_PRINT'], IN_PRINT: ['DELIVERED_TO_WAREHOUSE'], DELIVERED_TO_WAREHOUSE: [],
};
export function assertPrintProductionTransition(from: PrintProductionStatus, to: PrintProductionStatus) {
  if (!PRINT_TRANSITIONS[from]?.includes(to)) throw new Error('Nepovolená změna stavu výroby.');
}
export function textInput(value: unknown, name: string, max: number, required = false): string | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) throw new Error(`${name} je povinné.`);
    return undefined;
  }
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`${name} není platné.`);
  return value.trim() || undefined;
}
export function safeArtworkUrl(value: unknown) {
  const input = textInput(value, 'URL', 2048);
  if (!input) return undefined;
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL musí používat HTTP nebo HTTPS.');
  return url.href;
}
export function validatePrintJob(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Neplatná tisková zakázka.');
  const data = raw as Record<string, unknown>;
  if (data.status !== undefined && data.status !== 'PREPARATION') throw new Error('Nová zakázka musí začínat v přípravě.');
  const quantity = data.quantity; const sparesQuantity = data.sparesQuantity ?? 0;
  if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000
    || typeof sparesQuantity !== 'number' || !Number.isSafeInteger(sparesQuantity) || sparesQuantity < 0 || sparesQuantity > 1000000) throw new Error('Neplatné množství.');
  if (!Object.values(PrintFormatType).includes(data.formatType as PrintFormatType) || !Object.values(PrintMaterialType).includes(data.materialType as PrintMaterialType)) throw new Error('Neplatný formát nebo materiál.');
  const deliveryDeadline = data.deliveryDeadline === undefined || data.deliveryDeadline === null ? undefined
    : data.deliveryDeadline instanceof Date ? data.deliveryDeadline : typeof data.deliveryDeadline === 'string' ? new Date(data.deliveryDeadline) : new Date(NaN);
  if (deliveryDeadline && !Number.isFinite(deliveryDeadline.getTime())) throw new Error('Neplatný termín.');
  return {
    title: textInput(data.title, 'Název', 250, true)!, campaignName: textInput(data.campaignName, 'Kampaň', 250),
    offerId: textInput(data.offerId, 'Nabídka', 128), clientId: textInput(data.clientId, 'Klient', 128),
    formatType: data.formatType as PrintFormatType, materialType: data.materialType as PrintMaterialType,
    quantity, sparesQuantity, deliveryDeadline, artworkUrl: safeArtworkUrl(data.artworkUrl), status: 'PREPARATION' as const,
  };
}
export function productionKpis(jobs: { status: PrintProductionStatus; deliveryDeadline: Date | null }[], now = new Date()) {
  return {
    preparation: jobs.filter(j => j.status === 'PREPARATION').length,
    approval: jobs.filter(j => j.status === 'CLIENT_APPROVAL').length,
    printing: jobs.filter(j => j.status === 'IN_PRINT').length,
    delivered: jobs.filter(j => j.status === 'DELIVERED_TO_WAREHOUSE').length,
    dueSoon: jobs.filter(j => j.status !== 'DELIVERED_TO_WAREHOUSE' && j.deliveryDeadline && +j.deliveryDeadline >= +now && +j.deliveryDeadline <= +now + 48 * 3600000).length,
  };
}
