import { BillingSubjectType } from '@prisma/client';
export function parseBillingProfile(input: Record<string, unknown>) {
  const text = (key: string) => typeof input[key] === 'string' ? (input[key] as string).trim() || null : null;
  const subjectType = Object.values(BillingSubjectType).includes(input.subjectType as BillingSubjectType) ? input.subjectType as BillingSubjectType : null;
  const billingName = text('billingName'); const companyId = text('companyId')?.replace(/\s/g, '') ?? null; const vatId = text('vatId')?.replace(/\s/g, '').toUpperCase() ?? null;
  if (!subjectType || !billingName) throw new Error('Vyplňte typ subjektu a fakturační jméno.');
  if (subjectType !== 'INDIVIDUAL' && (!companyId || !/^\d{8}$/.test(companyId))) throw new Error('Pro OSVČ nebo firmu zadejte osmimístné IČO.');
  if (vatId && !/^CZ\d{8,10}$/.test(vatId)) throw new Error('DIČ musí mít tvar CZ a 8 až 10 číslic.');
  const billingEmail = text('billingEmail'); if (billingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) throw new Error('Fakturační e-mail nemá platný formát.');
  const postalCode = text('postalCode')?.replace(/\s/g, '') ?? null; if (postalCode && !/^\d{5}$/.test(postalCode)) throw new Error('PSČ musí obsahovat pět číslic.');
  const days = input.paymentTermsDays === '' || input.paymentTermsDays == null ? null : Number(input.paymentTermsDays); if (days != null && (!Number.isInteger(days) || days < 0 || days > 365)) throw new Error('Splatnost musí být 0 až 365 dní.');
  return { subjectType, billingName, companyId, vatId, vatPayer: input.vatPayer === true, street: text('street'), city: text('city'), postalCode, country: text('country') ?? 'CZ', accountNumber: text('accountNumber'), bankCode: text('bankCode'), iban: text('iban')?.replace(/\s/g, '').toUpperCase() ?? null, swift: text('swift')?.toUpperCase() ?? null, billingEmail, billingPhone: text('billingPhone'), paymentTermsDays: days, note: text('note') };
}
