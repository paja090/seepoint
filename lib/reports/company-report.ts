import { prisma } from '@/lib/db';
import { isWorkOrderOverdue } from '@/lib/work/overdue';
import { isOrderReadyForInvoicing, extractWorkOrderConstraintFlags, workTypeLabels } from '@/lib/work';
import { collectExpirationsForOrganization } from '@/lib/occupancy/expiration-alerts';
import { deriveAnalyticsSurfaceState } from '@/lib/analytics-finance';

export type ReportPeriodKey = 'week' | 'month' | 'quarter' | 'year';

export type DataAutomationLevel = 'AUTO' | 'SEMI_AUTO' | 'MANUAL';

export interface ReportPeriodRange {
  key: ReportPeriodKey;
  label: string;
  dateFrom: Date;
  dateTo: Date;
  dateFromIso: string;
  dateToIso: string;
  days: number;
}

export interface CompanyReportSummaryRow {
  area: string;
  metric: string;
  valueDisplay: string;
  numericValue: number | null;
  detail: string;
  source: string;
  automation: DataAutomationLevel;
}

export interface CompanyReportWorkTypeRow {
  workType: string;
  label: string;
  total: number;
  done: number;
  overdue: number;
  totalPrice: number;
}

export interface CompanyReportClientRow {
  clientName: string;
  agencyName: string | null;
  ordersCount: number;
  totalValue: number;
  source: 'CRM' | 'WORK_PLAN' | 'MIXED';
}

export interface CompanyReportInboxCategoryRow {
  classification: string;
  label: string;
  count: number;
  pendingReview: number;
}

export interface DataSourceAuditRow {
  category: string;
  metricName: string;
  sourceSystem: string;
  automation: DataAutomationLevel;
  currentStatus: string;
  recommendation: string;
}

export interface CompanyExecutiveReport {
  organizationId: string;
  organizationName: string;
  generatedAt: string;
  period: ReportPeriodRange;
  kpis: {
    workOrdersTotal: number;
    workOrdersDone: number;
    workOrdersOpen: number;
    workOrdersOverdue: number;
    workOrdersAwaitingInvoice: number;
    workOrdersTotalPrice: number;
    workEntriesHours: number;
    workEntriesLaborCost: number;
    offersCreated: number;
    offersAccepted: number;
    offersConversionPct: number;
    offersAcceptedValue: number;
    offersPipelineValue: number;
    crmOrdersCount: number;
    crmOrdersValue: number;
    crmOrdersViaAgencyCount: number;
    invoicesIssuedCount: number;
    invoicesIssuedTotal: number;
    inboxTotalRelevant: number;
    inboxNewInquiries: number;
    inboxComplaints: number;
    inboxPendingReview: number;
    gmailConnected: boolean;
    surfacesTotal: number;
    surfacesOccupied: number;
    surfaceOccupancyPct: number;
    knownMonthlyRent: number;
    expirationsTotal30d: number;
    expirationsCritical: number;
  };
  summaryTable: CompanyReportSummaryRow[];
  workByType: CompanyReportWorkTypeRow[];
  topClients: CompanyReportClientRow[];
  inboxByCategory: CompanyReportInboxCategoryRow[];
  dataSourceAudit: DataSourceAuditRow[];
}

export function normalizeReportPeriod(raw?: string | null): ReportPeriodKey {
  if (raw === 'week' || raw === 'month' || raw === 'quarter' || raw === 'year') {
    return raw;
  }
  return 'month';
}

export function resolveReportPeriod(
  periodKey: ReportPeriodKey,
  referenceDate: Date = new Date()
): ReportPeriodRange {
  const end = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
  const start = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );

  let label = 'Posledních 30 dní';
  if (periodKey === 'week') {
    start.setUTCDate(start.getUTCDate() - 6);
    label = 'Posledních 7 dní';
  } else if (periodKey === 'month') {
    start.setUTCDate(start.getUTCDate() - 29);
    label = 'Posledních 30 dní';
  } else if (periodKey === 'quarter') {
    start.setUTCDate(start.getUTCDate() - 89);
    label = 'Posledních 90 dní (kvartál)';
  } else {
    start.setUTCMonth(0, 1);
    label = `Rok ${referenceDate.getUTCFullYear()} (YTD)`;
  }

  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  return {
    key: periodKey,
    label,
    dateFrom: start,
    dateTo: end,
    dateFromIso: start.toISOString().slice(0, 10),
    dateToIso: end.toISOString().slice(0, 10),
    days,
  };
}

const INBOX_CLASSIFICATION_LABELS: Record<string, string> = {
  NEW_INQUIRY: 'Nové poptávky',
  OFFER_ACCEPTED: 'Schválené nabídky / objednávky',
  OFFER_REJECTED: 'Odmítnuté nabídky',
  INSTALLATION_REQUEST: 'Požadavky na montáž / realizaci',
  CHANGE_REQUEST: 'Změny a úpravy zakázek',
  GRAPHIC_ASSETS: 'Grafické podklady',
  GRAPHIC_APPROVAL: 'Schválení grafiky',
  PHOTO_DOCUMENTATION: 'Fotodokumentace',
  INVOICE_BILLING: 'Fakturace a platby',
  DOCUMENTS: 'Smlouvy a dokumenty',
  COMPLAINT: 'Reklamace a urgence',
  EXISTING_PROJECT_REPLY: 'Odpovědi k běžícím projektům',
  GENERAL_COMMUNICATION: 'Obecná komunikace',
  UNKNOWN: 'Nezařazeno',
};

function czk(value: number): string {
  return `${Math.round(value).toLocaleString('cs-CZ')} Kč`;
}

export function buildStaticDataSourceAudit(options: {
  gmailConnected: boolean;
  hasGooglePlanOrders: boolean;
  hasInvoices: boolean;
}): DataSourceAuditRow[] {
  return [
    {
      category: 'Realizace & Plán práce',
      metricName: 'Počty zakázek, dokončeno, po termínu, čeká na fakturaci',
      sourceSystem: options.hasGooglePlanOrders
        ? 'Google Sheet „Plán“ + SeePoint Plán práce + e-mail akce'
        : 'SeePoint Plán práce + e-mail akce techniků',
      automation: 'AUTO',
      currentStatus: 'Aktivní — plně automatický sběr',
      recommendation: 'Bez ručního zásahu; termíny a stavy se synchronizují průběžně.',
    },
    {
      category: 'Realizace & Výkazy',
      metricName: 'Odpracované hodiny a přímé náklady techniků',
      sourceSystem: 'Výkazy práce (WorkEntry) & Vyúčtování',
      automation: 'AUTO',
      currentStatus: 'Aktivní — automaticky z výkazů',
      recommendation: 'Přesnost roste s průběžným vykazováním techniků v mobilu / OS.',
    },
    {
      category: 'Obchod & CRM',
      metricName: 'Nabídky, konverze, CRM zakázky (koncový klient + agentura)',
      sourceSystem: 'Modul Nabídky + CRM + denní sync Google Sales tabulky',
      automation: 'AUTO',
      currentStatus: 'Aktivní — automaticky z OS a Google Sales',
      recommendation: 'U zakázek přes agenturu vyplňovat pole Agentura v CRM pro čisté dělení tržeb.',
    },
    {
      category: 'E-maily (Gmail)',
      metricName: 'Příchozí poptávky, objednávky, požadavky na montáž, reklamace',
      sourceSystem: 'Gmail → AI Inbox klasifikace',
      automation: 'AUTO',
      currentStatus: options.gmailConnected
        ? 'Aktivní — Gmail připojen a průběžně klasifikován'
        : 'Připraveno — stačí připojit firemní Gmail v Nastavení → Integrace',
      recommendation: options.gmailConnected
        ? 'Kontrolovat položky ve stavu „Čeká na kontrolu“ pro 100% přesnost.'
        : 'Po připojení Gmailu se počty poptávek a reklamací začnou plnit automaticky.',
    },
    {
      category: 'Obsazenost & Expirace',
      metricName: 'Vytíženost ploch (%), měsíční nájem, konce pronájmů/smluv/povolení',
      sourceSystem: 'Databáze nosičů & Obsazenost + denní hlídač expirací',
      automation: 'AUTO',
      currentStatus: 'Aktivní — automatický výpočet i denní e-mailové alerty',
      recommendation: 'U nosičů a rezervací doplňovat datum platnosti povolení a rezervace.',
    },
    {
      category: 'Fakturace & Úhrady',
      metricName: 'Vystavené a uhrazené faktury, splatnosti',
      sourceSystem: 'CRM Faktury (ClientInvoice) / příznak Fakturováno v Plánu',
      automation: 'SEMI_AUTO',
      currentStatus: options.hasInvoices
        ? 'Částečně automatické — čerpá z evidovaných faktur v OS'
        : 'Částečně automatické — v OS zatím nejsou napojeny účetní faktury',
      recommendation: 'Pro plnou automatizaci tržeb a cashflow doporučujeme napojení na účetní SW (Pohoda / Fakturoid).',
    },
    {
      category: 'Mimo-systémové zdroje',
      metricName: 'Telefonické poptávky, ústní dohody, fixní režie, mzdy THP a účetní P&L',
      sourceSystem: 'Telefon, osobní schůzky, účetnictví (Pohoda / účetní firma)',
      automation: 'MANUAL',
      currentStatus: 'Zůstává ruční / externí podklad',
      recommendation: 'Telefonické poptávky zapsat 1 klikem do CRM; účetní náklady a čistou marži doplňovat měsíčně z účetnictví.',
    },
  ];
}

export async function buildCompanyExecutiveReport(
  organizationId: string,
  options: {
    period?: ReportPeriodKey;
    referenceDate?: Date;
  } = {}
): Promise<CompanyExecutiveReport> {
  const now = options.referenceDate ?? new Date();
  const period = resolveReportPeriod(options.period ?? 'month', now);

  const [
    org,
    workOrders,
    workEntries,
    offers,
    crmOrders,
    invoices,
    inboxMessages,
    gmailConnection,
    surfaces,
    expirations,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
    prisma.workOrder.findMany({
      where: {
        organizationId,
        OR: [
          { scheduledAt: { gte: period.dateFrom, lte: period.dateTo } },
          { createdAt: { gte: period.dateFrom, lte: period.dateTo } },
          { status: { notIn: ['DONE', 'CANCELLED'] }, scheduledAt: { lt: period.dateFrom } },
        ],
      },
      select: {
        id: true,
        title: true,
        clientName: true,
        status: true,
        workType: true,
        scheduledAt: true,
        deadlineAt: true,
        price: true,
        ftdSent: true,
        invoiced: true,
        planningConstraints: true,
      },
      take: 1500,
    }),
    prisma.workEntry.findMany({
      where: {
        organizationId,
        workDate: { gte: period.dateFrom, lte: period.dateTo },
        status: { not: 'RETURNED' },
      },
      select: {
        id: true,
        quantity: true,
        unit: true,
        remunerationMethod: true,
        calculatedAmount: true,
      },
      take: 2000,
    }),
    prisma.offer.findMany({
      where: {
        organizationId,
        archivedAt: null,
        createdAt: { gte: period.dateFrom, lte: period.dateTo },
      },
      select: {
        id: true,
        status: true,
        totalPrice: true,
      },
      take: 1000,
    }),
    prisma.crmOrder.findMany({
      where: {
        organizationId,
        status: { not: 'CANCELLED' },
        createdAt: { gte: period.dateFrom, lte: period.dateTo },
      },
      select: {
        id: true,
        title: true,
        status: true,
        totalPrice: true,
        agencyName: true,
        client: { select: { name: true } },
        agencyClient: { select: { name: true } },
      },
      take: 1000,
    }),
    prisma.clientInvoice.findMany({
      where: {
        organizationId,
        status: { not: 'CANCELLED' },
        issueDate: { gte: period.dateFrom, lte: period.dateTo },
      },
      select: {
        id: true,
        status: true,
        totalAmount: true,
      },
      take: 1000,
    }),
    prisma.aiInboxMessage.findMany({
      where: {
        organizationId,
        receivedAt: { gte: period.dateFrom, lte: period.dateTo },
      },
      select: {
        id: true,
        classification: true,
        processingStatus: true,
        requiresReview: true,
      },
      take: 2000,
    }),
    prisma.integrationConnection.findFirst({
      where: {
        organizationId,
        provider: 'GMAIL',
        status: 'CONNECTED',
      },
      select: { id: true },
    }),
    prisma.advertisingSurface.findMany({
      where: {
        organizationId,
        status: { not: 'OUT_OF_SERVICE' },
        carrier: { archivedAt: null, status: 'ACTIVE' },
      },
      select: {
        id: true,
        status: true,
        contract: {
          select: {
            status: true,
            startDate: true,
            endDate: true,
            monthlyPrice: true,
          },
        },
        occupancies: {
          where: {
            status: { in: ['OCCUPIED', 'RESERVED'] },
            dateFrom: { lte: now },
            dateTo: { gte: now },
          },
          select: {
            status: true,
            price: true,
          },
        },
      },
      take: 3000,
    }),
    collectExpirationsForOrganization(organizationId, {
      referenceDate: now,
      lookaheadDays: 30,
      expiredLookbackDays: 30,
    }),
  ]);

  // 1. WorkOrders aggregation
  let workOrdersInPeriod = 0;
  let workOrdersDone = 0;
  let workOrdersOpen = 0;
  let workOrdersOverdue = 0;
  let workOrdersAwaitingInvoice = 0;
  let workOrdersTotalPrice = 0;
  let hasGooglePlanOrders = false;

  const workTypeMap = new Map<string, CompanyReportWorkTypeRow>();
  const clientAggMap = new Map<string, CompanyReportClientRow>();

  for (const wo of workOrders) {
    const pc =
      wo.planningConstraints && typeof wo.planningConstraints === 'object' && !Array.isArray(wo.planningConstraints)
        ? (wo.planningConstraints as Record<string, unknown>)
        : {};
    if (pc.source === 'GOOGLE_SHEETS_PLAN') hasGooglePlanOrders = true;

    const overdue = isWorkOrderOverdue(wo, now);
    const inPeriod =
      wo.scheduledAt >= period.dateFrom && wo.scheduledAt <= period.dateTo;

    if (overdue) workOrdersOverdue++;

    if (!inPeriod) continue;
    workOrdersInPeriod++;

    const isDone = wo.status === 'DONE';
    const isCancelled = wo.status === 'CANCELLED';
    if (isDone) workOrdersDone++;
    else if (!isCancelled) workOrdersOpen++;

    const flags = extractWorkOrderConstraintFlags(wo.planningConstraints);
    if (
      isOrderReadyForInvoicing({
        status: wo.status,
        ftdSent: wo.ftdSent,
        invoiced: wo.invoiced,
        invoiceExempt: flags.invoiceExempt,
      })
    ) {
      workOrdersAwaitingInvoice++;
    }

    const priceNum = wo.price ? Number(wo.price) : 0;
    if (Number.isFinite(priceNum) && !isCancelled) {
      workOrdersTotalPrice += priceNum;
    }

    const wtKey = String(wo.workType || 'OTHER');
    const existingWt = workTypeMap.get(wtKey) ?? {
      workType: wtKey,
      label: workTypeLabels[wtKey as keyof typeof workTypeLabels] || wtKey,
      total: 0,
      done: 0,
      overdue: 0,
      totalPrice: 0,
    };
    existingWt.total++;
    if (isDone) existingWt.done++;
    if (overdue) existingWt.overdue++;
    if (Number.isFinite(priceNum) && !isCancelled) existingWt.totalPrice += priceNum;
    workTypeMap.set(wtKey, existingWt);

    if (!isCancelled && wo.clientName) {
      const ck = wo.clientName.trim().toLowerCase();
      const prev = clientAggMap.get(ck);
      if (prev) {
        prev.ordersCount++;
        prev.totalValue += Number.isFinite(priceNum) ? priceNum : 0;
        if (prev.source === 'CRM') prev.source = 'MIXED';
      } else {
        clientAggMap.set(ck, {
          clientName: wo.clientName.trim(),
          agencyName: null,
          ordersCount: 1,
          totalValue: Number.isFinite(priceNum) ? priceNum : 0,
          source: 'WORK_PLAN',
        });
      }
    }
  }

  // 2. WorkEntries (hours & labor cost)
  let workEntriesHours = 0;
  let workEntriesLaborCost = 0;
  for (const we of workEntries) {
    const qty = Number(we.quantity || 0);
    const amt = Number(we.calculatedAmount || 0);
    if (Number.isFinite(amt)) workEntriesLaborCost += amt;
    if (
      Number.isFinite(qty) &&
      (we.remunerationMethod === 'HOURLY' || we.unit.toLowerCase().startsWith('h'))
    ) {
      workEntriesHours += qty;
    }
  }

  // 3. Offers
  let offersCreated = 0;
  let offersAccepted = 0;
  let offersAcceptedValue = 0;
  let offersPipelineValue = 0;
  for (const offer of offers) {
    offersCreated++;
    const price = offer.totalPrice ? Number(offer.totalPrice) : 0;
    if (offer.status === 'ACCEPTED') {
      offersAccepted++;
      offersAcceptedValue += Number.isFinite(price) ? price : 0;
    } else if (offer.status === 'SENT' || offer.status === 'DRAFT') {
      offersPipelineValue += Number.isFinite(price) ? price : 0;
    }
  }
  const offersConversionPct =
    offersCreated > 0 ? Math.round((offersAccepted / offersCreated) * 100) : 0;

  // 4. CRM Orders (with agency attribution from Balík A!)
  let crmOrdersCount = 0;
  let crmOrdersValue = 0;
  let crmOrdersViaAgencyCount = 0;
  for (const ord of crmOrders) {
    crmOrdersCount++;
    const val = ord.totalPrice ? Number(ord.totalPrice) : 0;
    if (Number.isFinite(val)) crmOrdersValue += val;
    const resolvedAgency = ord.agencyClient?.name || ord.agencyName || null;
    if (resolvedAgency) crmOrdersViaAgencyCount++;

    const cname = ord.client?.name?.trim() || 'Klient';
    const ck = cname.toLowerCase();
    const prev = clientAggMap.get(ck);
    if (prev) {
      prev.ordersCount++;
      prev.totalValue += Number.isFinite(val) ? val : 0;
      if (resolvedAgency && !prev.agencyName) prev.agencyName = resolvedAgency;
      if (prev.source === 'WORK_PLAN') prev.source = 'MIXED';
    } else {
      clientAggMap.set(ck, {
        clientName: cname,
        agencyName: resolvedAgency,
        ordersCount: 1,
        totalValue: Number.isFinite(val) ? val : 0,
        source: 'CRM',
      });
    }
  }

  // 5. Client Invoices
  let invoicesIssuedCount = 0;
  let invoicesIssuedTotal = 0;
  for (const inv of invoices) {
    invoicesIssuedCount++;
    const amt = Number(inv.totalAmount || 0);
    if (Number.isFinite(amt)) invoicesIssuedTotal += amt;
  }

  // 6. Gmail / AI Inbox
  let inboxTotalRelevant = 0;
  let inboxNewInquiries = 0;
  let inboxComplaints = 0;
  let inboxPendingReview = 0;
  const inboxMap = new Map<string, CompanyReportInboxCategoryRow>();

  for (const msg of inboxMessages) {
    const cls = String(msg.classification || 'UNKNOWN');
    if (cls === 'SPAM_IRRELEVANT') continue;
    inboxTotalRelevant++;
    if (cls === 'NEW_INQUIRY') inboxNewInquiries++;
    if (cls === 'COMPLAINT') inboxComplaints++;
    const isPending =
      msg.processingStatus === 'REVIEW_REQUIRED' ||
      msg.processingStatus === 'READY' ||
      (msg.requiresReview && msg.processingStatus !== 'PROCESSED' && msg.processingStatus !== 'IGNORED');
    if (isPending) inboxPendingReview++;

    const prev = inboxMap.get(cls) ?? {
      classification: cls,
      label: INBOX_CLASSIFICATION_LABELS[cls] || cls,
      count: 0,
      pendingReview: 0,
    };
    prev.count++;
    if (isPending) prev.pendingReview++;
    inboxMap.set(cls, prev);
  }

  // 7. Surfaces & Occupancy utilization
  let surfacesOccupied = 0;
  let knownMonthlyRent = 0;
  for (const surface of surfaces) {
    const state = deriveAnalyticsSurfaceState({
      surfaceStatus: surface.status,
      contract: surface.contract
        ? {
            status: surface.contract.status,
            startDate: surface.contract.startDate,
            endDate: surface.contract.endDate,
            monthlyPrice: surface.contract.monthlyPrice ? Number(surface.contract.monthlyPrice) : null,
          }
        : null,
      occupancies: surface.occupancies.map((o) => ({
        status: o.status,
        price: o.price ? Number(o.price) : null,
      })),
      asOf: now,
    });
    if (state.isOccupied) {
      surfacesOccupied++;
      knownMonthlyRent += state.monthlyRent ?? 0;
    }
  }
  const surfacesTotal = surfaces.length;
  const surfaceOccupancyPct =
    surfacesTotal > 0 ? Math.round((surfacesOccupied / surfacesTotal) * 100) : 0;

  const gmailConnected = Boolean(gmailConnection);
  const kpis = {
    workOrdersTotal: workOrdersInPeriod,
    workOrdersDone,
    workOrdersOpen,
    workOrdersOverdue,
    workOrdersAwaitingInvoice,
    workOrdersTotalPrice,
    workEntriesHours: Math.round(workEntriesHours * 10) / 10,
    workEntriesLaborCost,
    offersCreated,
    offersAccepted,
    offersConversionPct,
    offersAcceptedValue,
    offersPipelineValue,
    crmOrdersCount,
    crmOrdersValue,
    crmOrdersViaAgencyCount,
    invoicesIssuedCount,
    invoicesIssuedTotal,
    inboxTotalRelevant,
    inboxNewInquiries,
    inboxComplaints,
    inboxPendingReview,
    gmailConnected,
    surfacesTotal,
    surfacesOccupied,
    surfaceOccupancyPct,
    knownMonthlyRent,
    expirationsTotal30d: expirations.counts.total,
    expirationsCritical: expirations.counts.expired + expirations.counts.urgent,
  };

  const summaryTable: CompanyReportSummaryRow[] = [
    {
      area: 'Obchod & Nabídky',
      metric: 'Vytvořené / schválené nabídky',
      valueDisplay: `${offersCreated} celkem · ${offersAccepted} schváleno (${offersConversionPct} %)`,
      numericValue: offersAccepted,
      detail: `Schválený objem ${czk(offersAcceptedValue)} · Rozpracováno ${czk(offersPipelineValue)}`,
      source: 'SeePoint Nabídky',
      automation: 'AUTO',
    },
    {
      area: 'Obchod & CRM',
      metric: 'CRM zakázky v období',
      valueDisplay: `${crmOrdersCount} zakázek · ${czk(crmOrdersValue)}`,
      numericValue: crmOrdersValue,
      detail:
        crmOrdersViaAgencyCount > 0
          ? `Z toho ${crmOrdersViaAgencyCount} přes mediální/reklamní agenturu`
          : 'Přímí klienti (agentury v CRM zatím nevyplněny)',
      source: 'CRM + Google Sales sync',
      automation: 'AUTO',
    },
    {
      area: 'Realizace & Plán',
      metric: 'Realizační zakázky (Plán práce)',
      valueDisplay: `${workOrdersInPeriod} celkem · ${workOrdersDone} hotovo · ${workOrdersOverdue} po termínu`,
      numericValue: workOrdersInPeriod,
      detail: `Hodnota zakázek ${czk(workOrdersTotalPrice)} · Čeká na fakturaci: ${workOrdersAwaitingInvoice}`,
      source: hasGooglePlanOrders ? 'Google Sheet Plán + OS' : 'SeePoint Plán práce',
      automation: 'AUTO',
    },
    {
      area: 'Výkazy práce',
      metric: 'Odpracované hodiny & mzdový náklad techniků',
      valueDisplay: `${kpis.workEntriesHours} hod · ${czk(workEntriesLaborCost)}`,
      numericValue: workEntriesLaborCost,
      detail: `Z ${workEntries.length} vykázaných položek v období`,
      source: 'Výkazy práce (WorkEntry)',
      automation: 'AUTO',
    },
    {
      area: 'E-maily (Gmail)',
      metric: 'Příchozí obchodní e-maily (AI Inbox)',
      valueDisplay: `${inboxTotalRelevant} zpráv · ${inboxNewInquiries} nových poptávek`,
      numericValue: inboxTotalRelevant,
      detail: gmailConnected
        ? `Reklamace/urgence: ${inboxComplaints} · Čeká na kontrolu: ${inboxPendingReview}`
        : 'Gmail integrace není připojena (Nastavení → Integrace)',
      source: 'Gmail → AI Inbox',
      automation: 'AUTO',
    },
    {
      area: 'Obsazenost ploch',
      metric: 'Aktuální vytíženost reklamních ploch',
      valueDisplay: `${surfaceOccupancyPct} % (${surfacesOccupied} / ${surfacesTotal} ploch)`,
      numericValue: surfaceOccupancyPct,
      detail: `Evidovaný měsíční nájem ${czk(knownMonthlyRent)} · Expirace do 30 dní: ${expirations.counts.total} (${kpis.expirationsCritical} urgentní)`,
      source: 'Obsazenost & Hlídač expirací',
      automation: 'AUTO',
    },
    {
      area: 'Fakturace',
      metric: 'Vystavené faktury v CRM',
      valueDisplay: `${invoicesIssuedCount} ks · ${czk(invoicesIssuedTotal)}`,
      numericValue: invoicesIssuedTotal,
      detail:
        invoicesIssuedCount > 0
          ? 'Evidované faktury v SeePoint CRM'
          : 'Účetní fakturace probíhá mimo OS (např. Pohoda / Fakturoid)',
      source: 'CRM Faktury / účetní SW',
      automation: 'SEMI_AUTO',
    },
  ];

  const workByType = [...workTypeMap.values()].sort(
    (a, b) => b.total - a.total || b.totalPrice - a.totalPrice
  );

  const topClients = [...clientAggMap.values()]
    .sort((a, b) => b.totalValue - a.totalValue || b.ordersCount - a.ordersCount)
    .slice(0, 15);

  const inboxByCategory = [...inboxMap.values()].sort((a, b) => b.count - a.count);

  const dataSourceAudit = buildStaticDataSourceAudit({
    gmailConnected,
    hasGooglePlanOrders,
    hasInvoices: invoicesIssuedCount > 0,
  });

  return {
    organizationId,
    organizationName: org?.name || 'SeePoint',
    generatedAt: now.toISOString(),
    period,
    kpis,
    summaryTable,
    workByType,
    topClients,
    inboxByCategory,
    dataSourceAudit,
  };
}

function csvCell(value: unknown): string {
  const str = String(value ?? '').replace(/\r?\n/g, ' ');
  if (str.includes(';') || str.includes('"') || str.includes(',')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const AUTOMATION_CSV_LABEL: Record<DataAutomationLevel, string> = {
  AUTO: 'Automaticky',
  SEMI_AUTO: 'Částečně automaticky',
  MANUAL: 'Ruční podklad',
};

/**
 * Generates UTF-8 BOM semicolon-delimited CSV ready to open cleanly in Czech Excel.
 */
export function formatCompanyReportCsv(report: CompanyExecutiveReport): string {
  const lines: string[] = [];
  const pushRow = (cols: unknown[]) => lines.push(cols.map(csvCell).join(';'));

  pushRow(['FIREMNÍ REPORT', report.organizationName, `${report.period.label} (${report.period.dateFromIso} – ${report.period.dateToIso})`]);
  pushRow([]);

  pushRow(['1. SOUHRN ZA FIRMU']);
  pushRow(['Oblast', 'Metrika', 'Hodnota', 'Detail', 'Zdroj dat', 'Automatizace']);
  for (const row of report.summaryTable) {
    pushRow([row.area, row.metric, row.valueDisplay, row.detail, row.source, AUTOMATION_CSV_LABEL[row.automation]]);
  }
  pushRow([]);

  pushRow(['2. TOP KLIENTI A AGENTURY V OBDOBÍ']);
  pushRow(['Koncový klient', 'Agentura', 'Počet zakázek', 'Hodnota (Kč)', 'Zdroj']);
  for (const c of report.topClients) {
    pushRow([c.clientName, c.agencyName || 'Přímý klient', c.ordersCount, Math.round(c.totalValue), c.source]);
  }
  pushRow([]);

  pushRow(['3. REALIZACE PODLE TYPU PRÁCE']);
  pushRow(['Typ práce', 'Celkem', 'Dokončeno', 'Po termínu', 'Hodnota (Kč)']);
  for (const w of report.workByType) {
    pushRow([w.label, w.total, w.done, w.overdue, Math.round(w.totalPrice)]);
  }
  pushRow([]);

  pushRow(['4. E-MAILOVÁ KOMUNIKACE (GMAIL / AI INBOX)']);
  pushRow(['Kategorie', 'Počet zpráv', 'Čeká na kontrolu']);
  for (const m of report.inboxByCategory) {
    pushRow([m.label, m.count, m.pendingReview]);
  }
  pushRow([]);

  pushRow(['5. PŘEHLED ZDROJŮ DAT (AUTOMATICKY VS. RUČNĚ)']);
  pushRow(['Oblast', 'Údaj', 'Zdroj', 'Režim', 'Stav', 'Doporučení']);
  for (const d of report.dataSourceAudit) {
    pushRow([d.category, d.metricName, d.sourceSystem, AUTOMATION_CSV_LABEL[d.automation], d.currentStatus, d.recommendation]);
  }

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
