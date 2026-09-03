import pdfMake from 'pdfmake';
import roboto from 'pdfmake/build/fonts/Roboto.js';

const NAVY = '#10253F';
const BLUE = '#009EE2';
const MUTED = '#64748B';
let fontsReady = false;

function configurePdfMake() {
  if (fontsReady) return;
  for (const [name, font] of Object.entries(roboto.vfs)) {
    pdfMake.virtualfs.writeFileSync(name, font.data, font.encoding);
  }
  pdfMake.addFonts(roboto.fonts);
  pdfMake.setLocalAccessPolicy(() => false);
  pdfMake.setUrlAccessPolicy(() => false);
  fontsReady = true;
}

export type NavigationInvoiceParty = {
  name: string;
  companyId?: string | null;
  vatId?: string | null;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  bankAccount?: string | null;
  iban?: string | null;
  swift?: string | null;
};

export type NavigationInvoicePdfInput = {
  invoiceNumber: string;
  variableSymbol?: string | null;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  supplier: NavigationInvoiceParty;
  customer: NavigationInvoiceParty;
  orderNumber: string;
  orderTitle: string;
  periodFrom: Date;
  periodTo: Date;
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
    vatRate: number;
    vatAmount: number;
    totalAmount: number;
  }>;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
};

const dateFormatter = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague' });
const periodDateFormatter = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'UTC' });
const numberFormatter = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function money(value: number, currency: string) {
  return `${numberFormatter.format(value)} ${currency}`;
}

function address(party: NavigationInvoiceParty) {
  return [party.street, [party.postalCode, party.city].filter(Boolean).join(' '), party.country]
    .filter(Boolean)
    .join(', ');
}

function partyStack(title: string, party: NavigationInvoiceParty) {
  return {
    stack: [
      { text: title, style: 'eyebrow' },
      { text: party.name, bold: true, fontSize: 11, color: NAVY, margin: [0, 4, 0, 3] },
      { text: address(party), fontSize: 8.5, color: MUTED },
      { text: `IČO: ${party.companyId || '-'}`, fontSize: 8.5, color: MUTED, margin: [0, 3, 0, 0] },
      { text: `DIČ: ${party.vatId || '-'}`, fontSize: 8.5, color: MUTED },
      ...(party.email ? [{ text: party.email, fontSize: 8.5, color: MUTED }] : []),
      ...(party.phone ? [{ text: party.phone, fontSize: 8.5, color: MUTED }] : []),
    ],
  };
}

export function validateNavigationInvoiceParties(supplier: NavigationInvoiceParty, customer: NavigationInvoiceParty) {
  const missing: string[] = [];
  if (!supplier.name.trim()) missing.push('název dodavatele');
  if (!supplier.companyId?.trim()) missing.push('IČO dodavatele');
  if (!supplier.street?.trim() || !supplier.city?.trim() || !supplier.postalCode?.trim()) missing.push('úplná adresa dodavatele');
  if (!supplier.bankAccount?.trim() && !supplier.iban?.trim()) missing.push('bankovní účet nebo IBAN dodavatele');
  if (!customer.name.trim()) missing.push('název odběratele');
  if (!customer.street?.trim() || !customer.city?.trim() || !customer.postalCode?.trim()) missing.push('úplná fakturační adresa odběratele');
  return missing;
}

export async function createNavigationInvoicePdf(input: NavigationInvoicePdfInput): Promise<Buffer> {
  configurePdfMake();
  const definition = {
    pageSize: 'A4',
    pageMargins: [42, 42, 42, 48],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#1E293B' },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `Faktura ${input.invoiceNumber}`, color: MUTED, fontSize: 7 },
        { text: `Strana ${currentPage} / ${pageCount}`, color: MUTED, fontSize: 7, alignment: 'right' },
      ],
      margin: [42, 14, 42, 0],
    }),
    content: [
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'SeePOINT', bold: true, fontSize: 22, color: BLUE },
              { text: 'OUTDOOR REKLAMA', bold: true, fontSize: 7, color: NAVY, characterSpacing: 1.5 },
            ],
          },
          {
            width: 210,
            stack: [
              { text: 'FAKTURA - DAŇOVÝ DOKLAD', bold: true, fontSize: 15, color: NAVY, alignment: 'right' },
              { text: input.invoiceNumber, bold: true, fontSize: 12, color: BLUE, alignment: 'right', margin: [0, 5, 0, 0] },
            ],
          },
        ],
        margin: [0, 0, 0, 22],
      },
      {
        columns: [
          { width: '*', ...partyStack('DODAVATEL', input.supplier) },
          { width: 24, text: '' },
          { width: '*', ...partyStack('ODBĚRATEL', input.customer) },
        ],
        columnGap: 10,
        margin: [0, 0, 0, 20],
      },
      {
        table: {
          widths: ['*', '*', '*', '*'],
          body: [
            [
              { text: 'Datum vystavení', style: 'metaLabel' },
              { text: 'Datum splatnosti', style: 'metaLabel' },
              { text: 'DUZP', style: 'metaLabel' },
              { text: 'Variabilní symbol', style: 'metaLabel' },
            ],
            [
              { text: dateFormatter.format(input.issueDate), style: 'metaValue' },
              { text: dateFormatter.format(input.dueDate), style: 'metaValue' },
              { text: dateFormatter.format(input.issueDate), style: 'metaValue' },
              { text: input.variableSymbol || '-', style: 'metaValue' },
            ],
          ],
        },
        layout: { fillColor: (rowIndex: number) => rowIndex === 0 ? '#E8F5FB' : '#F8FAFC', hLineColor: () => '#DCE6EE', vLineColor: () => '#DCE6EE' },
        margin: [0, 0, 0, 18],
      },
      {
        stack: [
          { text: `Zakázka ${input.orderNumber}: ${input.orderTitle}`, bold: true, color: NAVY },
          { text: `Fakturační období: ${periodDateFormatter.format(input.periodFrom)} - ${periodDateFormatter.format(input.periodTo)}`, color: MUTED, fontSize: 8.5, margin: [0, 3, 0, 0] },
        ],
        margin: [0, 0, 0, 12],
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 42, 30, 65, 56, 38, 64],
          body: [
            [
              { text: 'Položka', style: 'tableHeader' },
              { text: 'Množství', style: 'tableHeader', alignment: 'right' },
              { text: 'MJ', style: 'tableHeader' },
              { text: 'Cena/MJ', style: 'tableHeader', alignment: 'right' },
              { text: 'Základ', style: 'tableHeader', alignment: 'right' },
              { text: 'DPH', style: 'tableHeader', alignment: 'right' },
              { text: 'Celkem', style: 'tableHeader', alignment: 'right' },
            ],
            ...input.items.map((item) => [
              { text: item.description, fontSize: 8.5 },
              { text: numberFormatter.format(item.quantity), alignment: 'right', fontSize: 8.5 },
              { text: item.unit, fontSize: 8.5 },
              { text: money(item.unitPrice, input.currency), alignment: 'right', fontSize: 8.5 },
              { text: money(item.amount, input.currency), alignment: 'right', fontSize: 8.5 },
              { text: `${numberFormatter.format(item.vatRate)} %`, alignment: 'right', fontSize: 8.5 },
              { text: money(item.totalAmount, input.currency), alignment: 'right', fontSize: 8.5, bold: true },
            ]),
          ],
        },
        layout: { fillColor: (rowIndex: number) => rowIndex === 0 ? NAVY : rowIndex % 2 === 0 ? '#F8FAFC' : null, hLineColor: () => '#DCE6EE', vLineColor: () => '#DCE6EE' },
        margin: [0, 0, 0, 16],
      },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'PLATEBNÍ ÚDAJE', style: 'eyebrow' },
              { text: `Účet: ${input.supplier.bankAccount || '-'}`, margin: [0, 5, 0, 0] },
              { text: `IBAN: ${input.supplier.iban || '-'}` },
              { text: `SWIFT: ${input.supplier.swift || '-'}` },
              { text: `Variabilní symbol: ${input.variableSymbol || '-'}`, bold: true, margin: [0, 3, 0, 0] },
            ],
          },
          {
            width: 230,
            table: {
              widths: ['*', 90],
              body: [
                [{ text: 'Základ daně', color: MUTED }, { text: money(input.subtotal, input.currency), alignment: 'right' }],
                [{ text: 'DPH', color: MUTED }, { text: money(input.taxAmount, input.currency), alignment: 'right' }],
                [{ text: 'CELKEM K ÚHRADĚ', bold: true, color: '#FFFFFF' }, { text: money(input.totalAmount, input.currency), bold: true, color: '#FFFFFF', alignment: 'right' }],
              ],
            },
            layout: { fillColor: (rowIndex: number) => rowIndex === 2 ? BLUE : '#F8FAFC', hLineColor: () => '#DCE6EE', vLineColor: () => '#DCE6EE' },
          },
        ],
        columnGap: 18,
      },
      { text: 'Děkujeme za spolupráci.', bold: true, color: NAVY, alignment: 'center', margin: [0, 28, 0, 0] },
    ],
    styles: {
      eyebrow: { fontSize: 7.5, bold: true, color: BLUE, characterSpacing: 1 },
      metaLabel: { fontSize: 7.5, bold: true, color: MUTED },
      metaValue: { fontSize: 9, bold: true, color: NAVY },
      tableHeader: { color: '#FFFFFF', bold: true, fontSize: 7.5 },
    },
  };

  return pdfMake.createPdf(definition).getBuffer();
}
