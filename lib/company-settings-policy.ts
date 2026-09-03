import { isValidEmailAddress } from '@/lib/email-policy';
import { normalizeInvoicePrefix } from '@/lib/invoice-policy';

const textLimits = {
  name: 160, companyId: 32, vatId: 32, street: 180, city: 100, postalCode: 20,
  country: 2, email: 254, phone: 40, website: 500, logoUrl: 500,
  primaryColor: 20, secondaryColor: 20, emailSignature: 5_000,
  bankAccount: 80, iban: 50, swift: 20, defaultCurrency: 3,
} as const;

export type CompanySettingsUpdate = Partial<Record<keyof typeof textLimits, string | null>> & {
  invoiceDueDays?: number;
  defaultVatRate?: string;
  invoiceNumberPrefix?: string;
};

export function normalizeCompanySettingsUpdate(body: Record<string, unknown>): CompanySettingsUpdate {
  const data: CompanySettingsUpdate = {};
  for (const [field, limit] of Object.entries(textLimits) as Array<[keyof typeof textLimits, number]>) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== 'string') throw new Error(`Pole ${field} musí být text.`);
    const value = body[field].trim();
    if (value.length > limit) throw new Error(`Pole ${field} je příliš dlouhé.`);
    data[field] = value || null;
  }

  if (data.name !== undefined && (!data.name || data.name.length < 2)) throw new Error('Název firmy je příliš krátký.');
  if (data.country !== undefined) data.country = data.country?.toUpperCase() || 'CZ';
  if (data.defaultCurrency !== undefined) {
    const currency = data.defaultCurrency?.toUpperCase() || 'CZK';
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Měna musí být třípísmenný ISO kód.');
    data.defaultCurrency = currency;
  }
  if (data.email && !isValidEmailAddress(data.email)) throw new Error('Firemní e-mail nemá platný formát.');
  for (const field of ['website', 'logoUrl'] as const) {
    if (!data[field]) continue;
    let url: URL;
    try { url = new URL(data[field]); } catch { throw new Error(`Pole ${field} musí obsahovat platnou URL.`); }
    if (url.protocol !== 'https:') throw new Error(`Pole ${field} musí používat HTTPS.`);
  }
  for (const field of ['primaryColor', 'secondaryColor'] as const) {
    if (data[field] && !/^#[0-9a-fA-F]{6}$/.test(data[field])) throw new Error(`Pole ${field} musí být barva ve formátu #RRGGBB.`);
  }

  if (body.invoiceDueDays !== undefined) {
    const dueDays = typeof body.invoiceDueDays === 'number' ? body.invoiceDueDays : Number(body.invoiceDueDays);
    if (!Number.isInteger(dueDays) || dueDays < 1 || dueDays > 365) throw new Error('Splatnost faktury musí být 1 až 365 dní.');
    data.invoiceDueDays = dueDays;
  }
  if (body.defaultVatRate !== undefined) {
    const raw = typeof body.defaultVatRate === 'number' || typeof body.defaultVatRate === 'string' ? String(body.defaultVatRate).trim() : '';
    if (!/^(?:\d{1,2}(?:[.,]\d{1,2})?|100(?:[.,]0{1,2})?)$/.test(raw)) throw new Error('Sazba DPH musí být 0 až 100 % s nejvýše dvěma desetinnými místy.');
    data.defaultVatRate = raw.replace(',', '.');
  }
  if (body.invoiceNumberPrefix !== undefined) {
    if (typeof body.invoiceNumberPrefix !== 'string') throw new Error('Prefix faktury musí být text.');
    data.invoiceNumberPrefix = normalizeInvoicePrefix(body.invoiceNumberPrefix);
  }
  return data;
}
