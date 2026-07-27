import type { NavigationOrderStatus, NavigationBlockStatus, ClientInvoiceStatus } from '@prisma/client';

export const NAVIGATION_ORDER_STATUS_LABELS: Record<NavigationOrderStatus, string> = {
  POPTAVKA: 'Poptávka',
  NABIDKA: 'Nabídka',
  POTVRZENO_KLIENTEM: 'Potvrzeno klientem',
  SMLOUVA_OBJEDNAVKA: 'Smlouva / Objednávka',
  GRAFICKE_PODKLADY: 'Grafické podklady',
  SCHVALENI_GRAFIKY: 'Schválení grafiky',
  TISK_VYROBA: 'Tisk / Výroba',
  PRIPRAVENO_K_INSTALACI: 'Připraveno k instalaci',
  INSTALACE: 'Instalace',
  FOTODOKUMENTACE: 'Fotodokumentace',
  PRIPRAVENO_K_FAKTURACI: 'Připraveno k fakturaci',
  FAKTUROVANO: 'Fakturováno',
  DOKONCENO: 'Dokončeno',
};

export const NAVIGATION_BLOCK_STATUS_LABELS: Record<NavigationBlockStatus, string> = {
  CEKA_NA_KLIENTA: 'Čeká na klienta',
  CEKA_NA_POTVRZENI_NABIDKY: 'Čeká na potvrzení nabídky',
  CEKA_NA_OBJEDNAVKU: 'Čeká na objednávku',
  CEKA_NA_GRAFIKU: 'Čeká na grafiku',
  CEKA_NA_SCHVALENI_GRAFIKY: 'Čeká na schválení grafiky',
  CEKA_NA_TISK: 'Čeká na tisk',
  CEKA_NA_INSTALACI: 'Čeká na instalaci',
  CEKA_NA_FOTOGRAFIE: 'Čeká na fotografie',
  CEKA_NA_FAKTURACI: 'Čeká na fakturaci',
  INTERNE_POZASTAVENO: 'Interně pozastaveno',
};

export const NAVIGATION_ORDER_STATUS_COLORS: Record<NavigationOrderStatus, string> = {
  POPTAVKA: 'bg-slate-100 text-slate-800 border-slate-300',
  NABIDKA: 'bg-blue-50 text-blue-800 border-blue-200',
  POTVRZENO_KLIENTEM: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  SMLOUVA_OBJEDNAVKA: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  GRAFICKE_PODKLADY: 'bg-amber-50 text-amber-800 border-amber-200',
  SCHVALENI_GRAFIKY: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  TISK_VYROBA: 'bg-purple-50 text-purple-800 border-purple-200',
  PRIPRAVENO_K_INSTALACI: 'bg-sky-50 text-sky-800 border-sky-200',
  INSTALACE: 'bg-orange-50 text-orange-800 border-orange-200',
  FOTODOKUMENTACE: 'bg-teal-50 text-teal-800 border-teal-200',
  PRIPRAVENO_K_FAKTURACI: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  FAKTUROVANO: 'bg-green-50 text-green-800 border-green-200',
  DOKONCENO: 'bg-slate-900 text-white border-slate-900',
};

export type NavigationPhaseKey = 'COMMERCIAL' | 'CONTRACT' | 'PRODUCTION' | 'REALIZATION' | 'FINANCE';

export const NAVIGATION_PHASES: Array<{
  key: NavigationPhaseKey;
  label: string;
  statuses: NavigationOrderStatus[];
  color: string;
  description: string;
}> = [
  {
    key: 'COMMERCIAL',
    label: '1. Obchod',
    statuses: ['POPTAVKA', 'NABIDKA', 'POTVRZENO_KLIENTEM'],
    color: 'border-blue-500 bg-blue-50/50 text-blue-900',
    description: 'Poptávka, tvorba nabídky a schválení klientem',
  },
  {
    key: 'CONTRACT',
    label: '2. Smlouva a podklady',
    statuses: ['SMLOUVA_OBJEDNAVKA', 'GRAFICKE_PODKLADY', 'SCHVALENI_GRAFIKY'],
    color: 'border-amber-500 bg-amber-50/50 text-amber-900',
    description: 'Podpis smlouvy, grafický návrh a schválení tiskových dat',
  },
  {
    key: 'PRODUCTION',
    label: '3. Výroba',
    statuses: ['TISK_VYROBA', 'PRIPRAVENO_K_INSTALACI'],
    color: 'border-purple-500 bg-purple-50/50 text-purple-900',
    description: 'Tisk cedulí, kompletace nosičů a příprava k výjezdu',
  },
  {
    key: 'REALIZATION',
    label: '4. Realizace',
    statuses: ['INSTALACE', 'FOTODOKUMENTACE'],
    color: 'border-orange-500 bg-orange-50/50 text-orange-900',
    description: 'Montáž v terénu a pořízení fotodokumentace',
  },
  {
    key: 'FINANCE',
    label: '5. Finance & Uzavření',
    statuses: ['PRIPRAVENO_K_FAKTURACI', 'FAKTUROVANO', 'DOKONCENO'],
    color: 'border-emerald-500 bg-emerald-50/50 text-emerald-900',
    description: 'Generování fakturačních podkladů a ukončení zakázky',
  },
];

export type NavigationPointItem = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  navigationType: string;
  variant?: string | null;
  orientation?: string | null;
  quantity: number;
  unitPrice: number;
  installationPrice: number;
  removalPrice: number;
  productionPrice: number;
  subtotal: number;
  internalNote?: string | null;
  clientNote?: string | null;
  status: string;
  carrierId?: string | null;
  surfaceId?: string | null;
  installedPhotoId?: string | null;
  carrierCode?: string | null;
  surfaceName?: string | null;
  installedPhotoUrl?: string | null;
};

export type NavigationAuditLogItem = {
  id: string;
  action: string;
  userEmail?: string | null;
  userName?: string | null;
  details?: string | null;
  createdAt: string;
};

export type NavigationOrderDetail = {
  id: string;
  crmOrderId: string;
  orderNumber: string;
  title: string;
  clientId: string;
  clientName: string;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  status: NavigationOrderStatus;
  blockStatus?: NavigationBlockStatus | null;
  rentStart?: string | null;
  rentEnd?: string | null;
  installationDate?: string | null;
  deinstallationDate?: string | null;
  targetName: string;
  targetAddress?: string | null;
  targetLatitude: number;
  targetLongitude: number;
  targetNote?: string | null;
  graphicsApprovedAt?: string | null;
  productionReadyAt?: string | null;
  installedAt?: string | null;
  invoicedAt?: string | null;
  totalPrice?: number | null;
  note?: string | null;
  internalNote?: string | null;
  createdAt: string;
  updatedAt: string;
  points: NavigationPointItem[];
  billingPeriods: Array<{
    id: string;
    dateFrom: string;
    dateTo: string;
    amount: number;
    status: ClientInvoiceStatus;
    invoiceId?: string | null;
    invoiceNumber?: string | null;
  }>;
  auditLogs?: NavigationAuditLogItem[];
};

export type NavigationOrderListItem = {
  id: string;
  crmOrderId: string;
  orderNumber: string;
  title: string;
  clientId: string;
  clientName: string;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  status: NavigationOrderStatus;
  blockStatus?: NavigationBlockStatus | null;
  targetName: string;
  targetAddress?: string | null;
  targetLatitude: number;
  targetLongitude: number;
  totalPrice: number;
  pointsCount: number;
  installedPointsCount: number;
  photosCount: number;
  rentStart?: string | null;
  rentEnd?: string | null;
  installationDate?: string | null;
  createdAt: string;
  updatedAt: string;
  daysInStatus: number;
};

export type NavigationDashboardStats = {
  activeCount: number;
  waitingForClientCount: number;
  waitingForGraphicsCount: number;
  inProductionCount: number;
  readyForInstallationCount: number;
  installationInProgressCount: number;
  missingPhotosCount: number;
  readyForBillingCount: number;
  totalCount: number;
};

export type AttentionAlertItem = {
  id: string;
  orderId: string;
  orderNumber: string;
  clientName: string;
  reason: string;
  waitingDaysOrDeadline: string;
  assignedUserName: string;
  actionUrl: string;
  actionLabel: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
};
