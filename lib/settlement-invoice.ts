import { prisma } from './db';
import { Prisma, Settlement, Invoice, InvoiceItem } from '@prisma/client';
import pdfMake from 'pdfmake';
import roboto from 'pdfmake/build/fonts/Roboto.js';

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

const CZECH_MONTHS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

export function getCzechMonthName(monthNumber: number): string {
  return CZECH_MONTHS[monthNumber - 1] || `Měsíc ${monthNumber}`;
}

export type SettlementParty = {
  name: string;
  companyId?: string | null;
  vatId?: string | null;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  bankAccount?: string | null;
  iban?: string | null;
  swift?: string | null;
  email?: string | null;
  phone?: string | null;
  isVatPayer?: boolean;
};

export type SettlementInvoiceData = {
  invoiceNumber: string;
  variableSymbol: string;
  issueDate: Date;
  dueDate: Date;
  periodFrom: Date;
  periodTo: Date;
  periodMonth: number;
  periodYear: number;
  periodTitle: string;
  settlementStatus: string;
  supplier: SettlementParty;
  customer: SettlementParty;
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
    vatRate: number;
    vatAmount: number;
    totalAmount: number;
    category?: string | null;
  }>;
  totalWorkAmount: number;
  totalReimbursements: number;
  totalDeductions: number;
  totalAdvances: number;
  netPayableAmount: number;
  vatAmount: number;
  grossAmount: number;
  note?: string | null;
};

const csDateFormatter = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague' });
const csCurrencyFormatter = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function formatMoney(amount: number): string {
  return `${csCurrencyFormatter.format(amount)} Kč`;
}

function formatPartyAddress(party: SettlementParty): string {
  return [party.street, [party.postalCode, party.city].filter(Boolean).join(' '), party.country]
    .filter(Boolean)
    .join(', ') || 'Nespecifikováno';
}

/**
 * Builds standard SettlementInvoiceData for a given settlement from database models.
 */
export async function buildSettlementInvoiceData(
  settlementId: string,
  tx?: Prisma.TransactionClient
): Promise<SettlementInvoiceData> {
  const client = tx || prisma;

  const settlement = await client.settlement.findUnique({
    where: { id: settlementId },
    include: {
      employee: {
        include: { billingProfile: true },
      },
      items: {
        include: { task: true },
        orderBy: { date: 'asc' },
      },
      adjustments: {
        orderBy: { createdAt: 'asc' },
      },
      invoice: {
        include: { items: true },
      },
    },
  });

  if (!settlement) {
    throw new Error(`Vyúčtování s ID ${settlementId} nebylo nalezeno.`);
  }

  // Retrieve organization & system settings
  const org = await client.organization.findUnique({
    where: { id: settlement.organizationId },
  });

  const sysSettings = await client.systemSettings.findFirst({
    where: { organizationId: settlement.organizationId },
  });

  const bp = settlement.employee.billingProfile;
  const supplier: SettlementParty = {
    name: bp?.billingName || `${settlement.employee.firstName} ${settlement.employee.lastName}`,
    companyId: bp?.companyId || settlement.employee.ico || null,
    vatId: bp?.vatId || null,
    street: bp?.street || null,
    city: bp?.city || null,
    postalCode: bp?.postalCode || null,
    country: bp?.country || 'CZ',
    bankAccount: bp?.accountNumber ? (bp.bankCode ? `${bp.accountNumber}/${bp.bankCode}` : bp.accountNumber) : null,
    iban: bp?.iban || null,
    swift: bp?.swift || null,
    email: settlement.employee.email || null,
    phone: settlement.employee.phone || null,
    isVatPayer: Boolean(bp?.vatPayer),
  };

  const customer: SettlementParty = {
    name: org?.name || sysSettings?.companyName || 'SeePoint s.r.o.',
    companyId: org?.companyId || sysSettings?.companyId || null,
    vatId: org?.vatId || sysSettings?.vatId || null,
    street: org?.street || sysSettings?.street || null,
    city: org?.city || sysSettings?.city || null,
    postalCode: org?.postalCode || sysSettings?.postalCode || null,
    country: org?.country || sysSettings?.country || 'CZ',
    bankAccount: org?.bankAccount || sysSettings?.bankAccount || null,
    iban: org?.iban || sysSettings?.iban || null,
    swift: org?.swift || sysSettings?.swift || null,
    email: org?.email || null,
    phone: org?.phone || null,
  };

  const periodTitle = `${getCzechMonthName(settlement.periodMonth)} ${settlement.periodYear}`;

  const cleanPeriodMonth = String(settlement.periodMonth).padStart(2, '0');
  const invoiceNumber = settlement.invoice?.invoiceNumber ||
    `VYU-${settlement.periodYear}${cleanPeriodMonth}-${settlement.id.slice(-4).toUpperCase()}`;

  const variableSymbol = invoiceNumber.replace(/\D/g, '') ||
    `${settlement.periodYear}${cleanPeriodMonth}`;

  const issueDate = settlement.invoice?.issueDate || new Date();
  const dueDays = org?.invoiceDueDays || 14;
  const dueDate = settlement.invoice?.dueDate || new Date(issueDate.getTime() + dueDays * 24 * 60 * 60 * 1000);

  // Group or assemble items
  const lineItems: SettlementInvoiceData['items'] = [];

  // Work Items
  for (const item of settlement.items) {
    const qty = item.quantity ? Number(item.quantity) : 1;
    const unit = item.unit || 'ks';
    const unitPrice = item.unitPrice ? Number(item.unitPrice) : (item.appliedRate ? Number(item.appliedRate) : (Number(item.amount) / (qty || 1)));
    const amount = Number(item.amount);

    lineItems.push({
      description: item.description + (item.carrierTypeLabel ? ` (${item.carrierTypeLabel})` : ''),
      quantity: qty,
      unit,
      unitPrice,
      amount,
      vatRate: supplier.isVatPayer ? (Number(org?.defaultVatRate) || 21) : 0,
      vatAmount: supplier.isVatPayer ? Math.round(amount * ((Number(org?.defaultVatRate) || 21) / 100) * 100) / 100 : 0,
      totalAmount: amount,
      category: item.workType || 'PRÁCE',
    });
  }

  // Adjustments: Reimbursements, Bonuses, Deductions, Advances
  for (const adj of settlement.adjustments) {
    const isCredit = adj.type === 'REIMBURSEMENT' || adj.type === 'BONUS' || adj.type === 'CARRY_OVER_ADD';
    const signedAmount = isCredit ? Number(adj.amount) : -Number(adj.amount);
    const prefix = adj.type === 'REIMBURSEMENT'
      ? 'Náhrada výdajů'
      : adj.type === 'BONUS'
        ? 'Prémie / Bonus'
        : adj.type === 'ADVANCE'
          ? 'Záloha'
          : 'Srážka / Odpočet';

    lineItems.push({
      description: `${prefix}: ${adj.description}${adj.category ? ` (${adj.category})` : ''}`,
      quantity: 1,
      unit: isCredit ? 'náhrada' : 'odpočet',
      unitPrice: signedAmount,
      amount: signedAmount,
      vatRate: 0,
      vatAmount: 0,
      totalAmount: signedAmount,
      category: adj.category || 'NÁKLADY',
    });
  }

  const netPayableAmount = Number(settlement.finalPayableAmount);
  const vatAmount = supplier.isVatPayer ? Math.round(netPayableAmount * ((Number(org?.defaultVatRate) || 21) / 100) * 100) / 100 : 0;
  const grossAmount = netPayableAmount + vatAmount;

  return {
    invoiceNumber,
    variableSymbol,
    issueDate,
    dueDate,
    periodFrom: settlement.periodFrom,
    periodTo: settlement.periodTo,
    periodMonth: settlement.periodMonth,
    periodYear: settlement.periodYear,
    periodTitle,
    settlementStatus: settlement.status,
    supplier,
    customer,
    items: lineItems,
    totalWorkAmount: Number(settlement.totalWorkAmount),
    totalReimbursements: Number(settlement.totalReimbursements),
    totalDeductions: Number(settlement.totalDeductions),
    totalAdvances: Number(settlement.totalAdvances),
    netPayableAmount,
    vatAmount,
    grossAmount,
    note: settlement.note || `Vyúčtování odpracovaných prací a nákladů za ${periodTitle}`,
  };
}

/**
 * Generates and upserts an Invoice row for a Settlement, optionally closing the monthly period.
 */
async function runInTx<T>(
  tx: Prisma.TransactionClient | undefined,
  op: (transaction: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if (tx) {
    return await op(tx);
  } else {
    return await prisma.$transaction(op);
  }
}

export async function generateSettlementInvoice(
  settlementId: string,
  actor: { id: string; email: string; role: string },
  options?: { closeMonth?: boolean },
  tx?: Prisma.TransactionClient
): Promise<{ invoice: Invoice & { items: InvoiceItem[] }; settlement: Settlement }> {
  return await runInTx(tx, async (transaction: Prisma.TransactionClient) => {
    const settlement = await transaction.settlement.findUnique({
      where: { id: settlementId },
      include: {
        employee: true,
      },
    });

    if (!settlement) {
      throw new Error(`Vyúčtování s ID ${settlementId} nebylo nalezeno.`);
    }

    const isPrivileged = actor.role === 'ADMIN' || actor.role === 'MANAGER' || actor.role === 'ACCOUNTANT';
    const isOwner = settlement.employee.userId === actor.id || settlement.employee.email === actor.email;

    if (!isPrivileged && !isOwner) {
      throw new Error('Nemáte oprávnění vystavit doklad pro toto vyúčtování.');
    }

    // Optional monthly closure logic
    let updatedSettlement: Settlement = settlement;
    if (options?.closeMonth) {
      if (settlement.status === 'DRAFT' || settlement.status === 'REJECTED') {
        // If privileged, can advance straight to LOCKED, or worker submits
        const nextStatus = isPrivileged ? 'LOCKED' : 'SUBMITTED';
        updatedSettlement = await transaction.settlement.update({
          where: { id: settlementId },
          data: { status: nextStatus },
        });

        await transaction.settlementAuditLog.create({
          data: {
            settlementId,
            userId: actor.id,
            userName: actor.email,
            action: 'MONTHLY_CLOSURE',
            fieldName: 'status',
            oldValue: settlement.status,
            newValue: nextStatus,
            reason: isPrivileged
              ? 'Měsíční uzávěrka provedena administrátorem/manažerem'
              : 'Měsíční uzávěrka odeslána pracovníkem',
          },
        });
      } else if (isPrivileged && settlement.status === 'SUBMITTED') {
        updatedSettlement = await transaction.settlement.update({
          where: { id: settlementId },
          data: { status: 'LOCKED' },
        });

        await transaction.settlementAuditLog.create({
          data: {
            settlementId,
            userId: actor.id,
            userName: actor.email,
            action: 'MONTHLY_CLOSURE',
            fieldName: 'status',
            oldValue: settlement.status,
            newValue: 'LOCKED',
            reason: 'Měsíční uzávěrka a schválení',
          },
        });
      } else if (isPrivileged && settlement.status === 'APPROVED') {
        updatedSettlement = await transaction.settlement.update({
          where: { id: settlementId },
          data: { status: 'LOCKED' },
        });

        await transaction.settlementAuditLog.create({
          data: {
            settlementId,
            userId: actor.id,
            userName: actor.email,
            action: 'MONTHLY_CLOSURE',
            fieldName: 'status',
            oldValue: settlement.status,
            newValue: 'LOCKED',
            reason: 'Uzamčení období při měsíční uzávěrce',
          },
        });
      }
    }

    const data = await buildSettlementInvoiceData(settlementId, transaction);

    // Upsert Invoice record
    const invoice = await transaction.invoice.upsert({
      where: { settlementId },
      create: {
        organizationId: settlement.organizationId,
        settlementId,
        invoiceNumber: data.invoiceNumber,
        status: settlement.status === 'PAID' ? 'PAID' : 'ISSUED',
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        periodFrom: data.periodFrom,
        periodTo: data.periodTo,
        supplierName: data.supplier.name,
        supplierIco: data.supplier.companyId,
        supplierDic: data.supplier.vatId,
        supplierAddress: formatPartyAddress(data.supplier),
        supplierAccount: data.supplier.bankAccount,
        supplierIban: data.supplier.iban,
        supplierSwift: data.supplier.swift,
        supplierVatPayer: Boolean(data.supplier.isVatPayer),
        customerName: data.customer.name,
        customerIco: data.customer.companyId,
        customerDic: data.customer.vatId,
        customerAddress: formatPartyAddress(data.customer),
        customerAccount: data.customer.bankAccount,
        customerIban: data.customer.iban,
        customerSwift: data.customer.swift,
        totalAmount: new Prisma.Decimal(data.netPayableAmount),
        vatAmount: new Prisma.Decimal(data.vatAmount),
        grossAmount: new Prisma.Decimal(data.grossAmount),
        note: data.note,
        items: {
          create: data.items.map((item) => ({
            organizationId: settlement.organizationId,
            description: item.description,
            quantity: new Prisma.Decimal(item.quantity),
            unit: item.unit,
            unitPrice: new Prisma.Decimal(item.unitPrice),
            amount: new Prisma.Decimal(item.amount),
            vatRate: new Prisma.Decimal(item.vatRate),
            vatAmount: new Prisma.Decimal(item.vatAmount),
            totalAmount: new Prisma.Decimal(item.totalAmount),
          })),
        },
      },
      update: {
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        supplierName: data.supplier.name,
        supplierIco: data.supplier.companyId,
        supplierDic: data.supplier.vatId,
        supplierAddress: formatPartyAddress(data.supplier),
        supplierAccount: data.supplier.bankAccount,
        supplierIban: data.supplier.iban,
        supplierSwift: data.supplier.swift,
        supplierVatPayer: Boolean(data.supplier.isVatPayer),
        customerName: data.customer.name,
        customerIco: data.customer.companyId,
        customerDic: data.customer.vatId,
        customerAddress: formatPartyAddress(data.customer),
        customerAccount: data.customer.bankAccount,
        customerIban: data.customer.iban,
        customerSwift: data.customer.swift,
        totalAmount: new Prisma.Decimal(data.netPayableAmount),
        vatAmount: new Prisma.Decimal(data.vatAmount),
        grossAmount: new Prisma.Decimal(data.grossAmount),
        note: data.note,
        items: {
          deleteMany: {},
          create: data.items.map((item) => ({
            organizationId: settlement.organizationId,
            description: item.description,
            quantity: new Prisma.Decimal(item.quantity),
            unit: item.unit,
            unitPrice: new Prisma.Decimal(item.unitPrice),
            amount: new Prisma.Decimal(item.amount),
            vatRate: new Prisma.Decimal(item.vatRate),
            vatAmount: new Prisma.Decimal(item.vatAmount),
            totalAmount: new Prisma.Decimal(item.totalAmount),
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return { invoice, settlement: updatedSettlement };
  });
}

/**
 * Generates a clean, professional PDF buffer for the monthly settlement / invoice.
 */
export async function createSettlementInvoicePdf(data: SettlementInvoiceData): Promise<Buffer> {
  configurePdfMake();

  const NAVY = '#0F172A';
  const BLUE = '#0284C7';
  const MUTED = '#64748B';

  const definition = {
    pageSize: 'A4',
    pageMargins: [36, 36, 36, 42],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#1E293B' },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `Měsíční vyúčtování: ${data.invoiceNumber} | ${data.periodTitle}`, color: MUTED, fontSize: 7 },
        { text: `Strana ${currentPage} z ${pageCount}`, color: MUTED, fontSize: 7, alignment: 'right' },
      ],
      margin: [36, 12, 36, 0],
    }),
    content: [
      // Top Header
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'SeePOINT OS', bold: true, fontSize: 20, color: BLUE },
              { text: 'MĚSÍČNÍ VYÚČTOVÁNÍ & PODKLAD K FAKTURACI', bold: true, fontSize: 8, color: NAVY, characterSpacing: 1 },
            ],
          },
          {
            width: 220,
            stack: [
              { text: 'DOKLAD O PROVEDENÉ PRÁCI', bold: true, fontSize: 13, color: NAVY, alignment: 'right' },
              { text: `Číslo: ${data.invoiceNumber}`, bold: true, fontSize: 11, color: BLUE, alignment: 'right', margin: [0, 4, 0, 0] },
              { text: `Období: ${data.periodTitle}`, fontSize: 9, color: MUTED, alignment: 'right' },
            ],
          },
        ],
        margin: [0, 0, 0, 18],
      },

      // Supplier and Customer Boxes
      {
        columns: [
          // Supplier
          {
            width: '*',
            stack: [
              { text: 'DODAVATEL (PRACOVNÍK / ZHOTOVITEL)', fontSize: 7.5, bold: true, color: BLUE, characterSpacing: 1 },
              { text: data.supplier.name, bold: true, fontSize: 11, color: NAVY, margin: [0, 3, 0, 2] },
              { text: formatPartyAddress(data.supplier), fontSize: 8.5, color: MUTED },
              ...(data.supplier.companyId ? [{ text: `IČO: ${data.supplier.companyId}`, fontSize: 8.5, color: MUTED, margin: [0, 2, 0, 0] }] : []),
              ...(data.supplier.vatId ? [{ text: `DIČ: ${data.supplier.vatId}`, fontSize: 8.5, color: MUTED }] : []),
              ...(data.supplier.email ? [{ text: `E-mail: ${data.supplier.email}`, fontSize: 8.5, color: MUTED }] : []),
              ...(data.supplier.phone ? [{ text: `Tel: ${data.supplier.phone}`, fontSize: 8.5, color: MUTED }] : []),
              ...(data.supplier.bankAccount ? [{ text: `Bankovní účet: ${data.supplier.bankAccount}`, fontSize: 8.5, bold: true, color: NAVY, margin: [0, 3, 0, 0] }] : []),
              ...(data.supplier.iban ? [{ text: `IBAN: ${data.supplier.iban}`, fontSize: 8, color: MUTED }] : []),
            ],
          },
          { width: 20, text: '' },
          // Customer
          {
            width: '*',
            stack: [
              { text: 'ODBĚRATEL (OBJEDNATEL)', fontSize: 7.5, bold: true, color: BLUE, characterSpacing: 1 },
              { text: data.customer.name, bold: true, fontSize: 11, color: NAVY, margin: [0, 3, 0, 2] },
              { text: formatPartyAddress(data.customer), fontSize: 8.5, color: MUTED },
              ...(data.customer.companyId ? [{ text: `IČO: ${data.customer.companyId}`, fontSize: 8.5, color: MUTED, margin: [0, 2, 0, 0] }] : []),
              ...(data.customer.vatId ? [{ text: `DIČ: ${data.customer.vatId}`, fontSize: 8.5, color: MUTED }] : []),
              ...(data.customer.email ? [{ text: `E-mail: ${data.customer.email}`, fontSize: 8.5, color: MUTED }] : []),
            ],
          },
        ],
        margin: [0, 0, 0, 16],
      },

      // Metadata Table
      {
        table: {
          widths: ['*', '*', '*', '*'],
          body: [
            [
              { text: 'Datum vystavení', fontSize: 7.5, bold: true, color: MUTED },
              { text: 'Datum splatnosti', fontSize: 7.5, bold: true, color: MUTED },
              { text: 'Fakturační období', fontSize: 7.5, bold: true, color: MUTED },
              { text: 'Variabilní symbol', fontSize: 7.5, bold: true, color: MUTED },
            ],
            [
              { text: csDateFormatter.format(data.issueDate), fontSize: 9, bold: true, color: NAVY },
              { text: csDateFormatter.format(data.dueDate), fontSize: 9, bold: true, color: NAVY },
              { text: `${csDateFormatter.format(data.periodFrom)} – ${csDateFormatter.format(data.periodTo)}`, fontSize: 8.5, color: NAVY },
              { text: data.variableSymbol || '-', fontSize: 9, bold: true, color: BLUE },
            ],
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => rowIndex === 0 ? '#F1F5F9' : '#F8FAFC',
          hLineColor: () => '#E2E8F0',
          vLineColor: () => '#E2E8F0',
        },
        margin: [0, 0, 0, 16],
      },

      // Items Table
      {
        table: {
          headerRows: 1,
          widths: ['*', 45, 35, 65, 75],
          body: [
            [
              { text: 'Položka / Činnost', fontSize: 8, bold: true, color: '#FFFFFF' },
              { text: 'Počet', fontSize: 8, bold: true, color: '#FFFFFF', alignment: 'right' },
              { text: 'MJ', fontSize: 8, bold: true, color: '#FFFFFF' },
              { text: 'Sazba/MJ', fontSize: 8, bold: true, color: '#FFFFFF', alignment: 'right' },
              { text: 'Částka', fontSize: 8, bold: true, color: '#FFFFFF', alignment: 'right' },
            ],
            ...data.items.map((item) => [
              { text: item.description, fontSize: 8.5 },
              { text: csCurrencyFormatter.format(item.quantity), alignment: 'right', fontSize: 8.5 },
              { text: item.unit, fontSize: 8.5 },
              { text: `${csCurrencyFormatter.format(item.unitPrice)} Kč`, alignment: 'right', fontSize: 8.5 },
              {
                text: `${csCurrencyFormatter.format(item.amount)} Kč`,
                alignment: 'right',
                fontSize: 8.5,
                bold: true,
                color: item.amount < 0 ? '#DC2626' : NAVY,
              },
            ]),
          ],
        },
        layout: {
          fillColor: (rowIndex: number) =>
            rowIndex === 0 ? NAVY : rowIndex % 2 === 0 ? '#F8FAFC' : null,
          hLineColor: () => '#E2E8F0',
          vLineColor: () => '#E2E8F0',
        },
        margin: [0, 0, 0, 16],
      },

      // Summary Breakdown & Total Box
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'REKAPITULACE OBDOBÍ', fontSize: 7.5, bold: true, color: BLUE, characterSpacing: 1 },
              { text: `Odměna za odvedenou práci: ${formatMoney(data.totalWorkAmount)}`, fontSize: 8.5, color: MUTED, margin: [0, 4, 0, 2] },
              ...(data.totalReimbursements > 0 ? [{ text: `Náhrady výdajů (palivo, nájem, auto): +${formatMoney(data.totalReimbursements)}`, fontSize: 8.5, color: '#16A34A' }] : []),
              ...(data.totalDeductions > 0 ? [{ text: `Srážky / odpočty: -${formatMoney(data.totalDeductions)}`, fontSize: 8.5, color: '#DC2626' }] : []),
              ...(data.totalAdvances > 0 ? [{ text: `Vyplacené zálohy: -${formatMoney(data.totalAdvances)}`, fontSize: 8.5, color: '#DC2626' }] : []),
              ...(data.supplier.bankAccount ? [{ text: `Vyplatit na bankovní účet: ${data.supplier.bankAccount}`, fontSize: 8.5, bold: true, color: NAVY, margin: [0, 5, 0, 0] }] : []),
            ],
          },
          {
            width: 220,
            table: {
              widths: ['*', 90],
              body: [
                [{ text: 'Základ vyúčtování', color: MUTED, fontSize: 8.5 }, { text: formatMoney(data.netPayableAmount), alignment: 'right', fontSize: 8.5 }],
                ...(data.vatAmount > 0 ? [[{ text: 'DPH', color: MUTED, fontSize: 8.5 }, { text: formatMoney(data.vatAmount), alignment: 'right', fontSize: 8.5 }]] : []),
                [
                  { text: 'CELKEM K VÝPLATĚ', bold: true, color: '#FFFFFF', fontSize: 9.5 },
                  { text: formatMoney(data.grossAmount), bold: true, color: '#FFFFFF', alignment: 'right', fontSize: 10 },
                ],
              ],
            },
            layout: {
              fillColor: (rowIndex: number, node: { table: { body: unknown[] } }) =>
                rowIndex === node.table.body.length - 1 ? BLUE : '#F8FAFC',
              hLineColor: () => '#CBD5E1',
              vLineColor: () => '#CBD5E1',
            },
          },
        ],
        columnGap: 16,
      },

      // Footer notice
      {
        text: 'Tento doklad slouží jako měsíční vyúčtování prací a podklad pro fakturaci v systému SeePoint OS. Děkujeme za spolupráci.',
        fontSize: 7.5,
        color: MUTED,
        alignment: 'center',
        margin: [0, 24, 0, 0],
      },
    ],
  };

  return pdfMake.createPdf(definition).getBuffer();
}
