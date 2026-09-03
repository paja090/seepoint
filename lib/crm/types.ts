import {
  ClientStatus,
  ClientType,
  ClientPricingSegment,
  ClientSource,
  PreferredContactMethod,
  CrmOrderStatus,
  CrmProjectType,
  RealizationStatus,
  ContractStatus,
  ContractType,
  ClientInvoiceType,
  ClientInvoiceStatus,
  CommunicationType,
  CrmTaskType,
  CrmTaskPriority,
  CrmTaskStatus,
} from '@prisma/client';

export type {
  ClientStatus,
  ClientType,
  ClientPricingSegment,
  ClientSource,
  PreferredContactMethod,
  CrmOrderStatus,
  CrmProjectType,
  RealizationStatus,
  ContractStatus,
  ContractType,
  ClientInvoiceType,
  ClientInvoiceStatus,
  CommunicationType,
  CrmTaskType,
  CrmTaskPriority,
  CrmTaskStatus,
};

export type ClientContactItem = {
  id: string;
  firstName: string;
  lastName: string;
  title?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  preferredCommunication: PreferredContactMethod;
  isPrimary: boolean;
  isCommercial: boolean;
  isRealization: boolean;
  isBilling: boolean;
};

export type ClientBranchItem = {
  id: string;
  name: string;
  code?: string | null;
  street?: string | null;
  city?: string | null;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  note?: string | null;
  contactPerson?: { firstName: string; lastName: string } | null;
};

export type OfferRecordItem = {
  id: string;
  title: string;
  campaignName?: string | null;
  status: string;
  validUntil?: Date | string | null;
  totalPrice?: unknown;
  createdByUser?: { name: string } | null;
};

export type CrmOrderRecordItem = {
  id: string;
  orderNumber: string;
  title: string;
  projectType: CrmProjectType;
  status: CrmOrderStatus;
  totalPrice?: unknown;
  assignedUser?: { name: string } | null;
  realizations?: CrmRealizationRecordItem[];
  _count?: { workOrders: number; clientInvoices: number };
};

export type CrmRealizationRecordItem = {
  id: string;
  status: RealizationStatus;
  plannedDate?: Date | string | null;
  actualDate?: Date | string | null;
  note?: string | null;
  claimNote?: string | null;
  assignedUser?: { name: string } | null;
};

export type ContractRecordItem = {
  id: string;
  contractNumber: string;
  title: string;
  type: ContractType;
  validFrom: Date | string;
  validTo?: Date | string | null;
  status: ContractStatus;
  valueAmount?: unknown;
};

export type ClientInvoiceRecordItem = {
  id: string;
  invoiceNumber: string;
  variableSymbol?: string | null;
  type: ClientInvoiceType;
  status: ClientInvoiceStatus;
  issueDate: Date | string;
  dueDate: Date | string;
  issueDateLabel: string;
  dueDateLabel: string;
  totalAmount: unknown;
  pdfUrl?: string | null;
  driveFileId?: string | null;
};

export type CommunicationRecordItem = {
  id: string;
  type: CommunicationType;
  subject: string;
  content: string;
  result?: string | null;
  nextStep?: string | null;
  isInternal: boolean;
  createdAt: Date | string;
  author?: { name: string } | null;
  contact?: { firstName: string; lastName: string } | null;
};

export type CrmTaskRecordItem = {
  id: string;
  title: string;
  type: CrmTaskType;
  priority: CrmTaskPriority;
  status: CrmTaskStatus;
  dueDate: Date | string;
  assignedUser?: { name: string } | null;
};

export type DocumentRecordItem = {
  id: string;
  name: string;
  type: string;
  fileName?: string | null;
  fileUrl?: string | null;
  createdAt: Date | string;
  uploaderUser?: { name: string } | null;
};

export type OccupancyRecordItem = {
  id: string;
  dateFrom: Date | string;
  dateTo: Date | string;
  surface?: {
    carrierId?: string;
    name?: string;
    mediaType?: string;
    carrier?: { name?: string; city?: string };
  } | null;
};

export type CrmAuditLogItem = {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  detailsJson?: string | null;
  createdAt: Date | string;
};

export type ClientProfileData = {
  id: string;
  name: string;
  tradingName?: string | null;
  companyId?: string | null;
  dic?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  status: ClientStatus;
  clientType: ClientType;
  pricingSegment: ClientPricingSegment;
  source: ClientSource;
  assignedUserId?: string | null;
  rating?: string | null;
  note?: string | null;
  logoDriveFileId?: string | null;
  billingStreet?: string | null;
  billingCity?: string | null;
  billingZip?: string | null;
  assignedUser?: { id: string; name: string; email: string; role: string } | null;
  contacts: ClientContactItem[];
  branches: ClientBranchItem[];
  offers: OfferRecordItem[];
  crmOrders: CrmOrderRecordItem[];
  occupancies: OccupancyRecordItem[];
  contracts: ContractRecordItem[];
  invoices: ClientInvoiceRecordItem[];
  communications: CommunicationRecordItem[];
  crmTasks: CrmTaskRecordItem[];
  documents: DocumentRecordItem[];
  metrics: {
    activeOccupanciesCount: number;
    inPreparationOrdersCount: number;
    unpaidInvoicesCount: number;
    overdueInvoicesCount: number;
    totalBilled: number;
    totalPaid: number;
    totalUnpaid: number;
    totalOverdue: number;
    pendingTasksCount: number;
    overdueTasksCount: number;
    expiringContractsCount: number;
  };
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, { label: string; badge: string }> = {
  LEAD: { label: 'Lead / Zájemce', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  ACTIVE: { label: 'Aktivní klient', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  INACTIVE: { label: 'Neaktivní', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
  BLOCKED: { label: 'Blokován', badge: 'bg-rose-100 text-rose-800 border-rose-300' },
  FORMER_CLIENT: { label: 'Bývalý klient', badge: 'bg-zinc-100 text-zinc-600 border-zinc-300' },
};

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  DIRECT_CLIENT: 'Přímý klient',
  ADVERTISING_AGENCY: 'Reklamní agentura',
  MEDIA_AGENCY: 'Mediální agentura',
  RETAIL_CHAIN: 'Síť prodejen',
  LOCAL_BUSINESS: 'Lokální firma',
  PUBLIC_INSTITUTION: 'Veřejná instituce',
  OTHER: 'Jiný typ',
};

export const CLIENT_PRICING_SEGMENT_LABELS: Record<ClientPricingSegment, string> = {
  COMMERCIAL: 'Komerční',
  CULTURE_SPORT: 'Kultura / Sport',
  PUBLIC_NONPROFIT: 'Veřejný / neziskový',
  CUSTOM: 'Individuální',
};

export const CLIENT_SOURCE_LABELS: Record<ClientSource, string> = {
  RECOMMENDATION: 'Doporučení',
  WEBSITE: 'Web / Poptávka',
  OUTBOUND: 'Aktivní oslovení (Outbound)',
  EXHIBITION: 'Veletrh / Akce',
  IMPORT: 'Hromadný import',
  OTHER: 'Jiné',
};

export const PREFERRED_COMM_LABELS: Record<PreferredContactMethod, string> = {
  EMAIL: 'E-mail',
  PHONE: 'Telefon',
  SMS: 'SMS',
  MEETING: 'Osobní schůzka',
};

export const ORDER_STATUS_LABELS: Record<CrmOrderStatus, { label: string; badge: string }> = {
  DRAFT: { label: 'Návrh zakázky', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
  CONFIRMED: { label: 'Potvrzeno klientem', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  WAITING_FOR_MATERIALS: { label: 'Čeká na podklady', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  READY_FOR_PRODUCTION: { label: 'Předáno do výroby', badge: 'bg-purple-100 text-purple-800 border-purple-300' },
  IN_REALIZATION: { label: 'V realizaci', badge: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  ACTIVE: { label: 'Aktivní kampaň', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  COMPLETED: { label: 'Dokončeno', badge: 'bg-teal-100 text-teal-800 border-teal-300' },
  CANCELLED: { label: 'Zrušeno', badge: 'bg-rose-100 text-rose-800 border-rose-300' },
};

export const PROJECT_TYPE_LABELS: Record<CrmProjectType, string> = {
  NAVIGATION: 'Navigace',
  CITY_GALLERY: 'Galerie venku',
  BENCH: 'Lavičky',
  CITY_POSTER: 'City postery',
  CLV: 'CLV (City Light Vitríny)',
  TOWER: 'Towery',
  HORIZON: 'Horizonty',
  COMBINED: 'Kombinovaná kampaň',
  OTHER: 'Ostatní media',
};

export const REALIZATION_STATUS_LABELS: Record<RealizationStatus, { label: string; badge: string }> = {
  WAITING_FOR_MATERIALS: { label: 'Čeká na podklady', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  MATERIALS_APPROVED: { label: 'Podklady schváleny', badge: 'bg-sky-100 text-sky-800 border-sky-300' },
  WAITING_FOR_PRODUCTION: { label: 'Čeká na výrobu', badge: 'bg-purple-100 text-purple-800 border-purple-300' },
  PRODUCED: { label: 'Vyrobeno', badge: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  SCHEDULED: { label: 'Naplánovaná instalace', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  INSTALLATION_IN_PROGRESS: { label: 'Probíhá instalace', badge: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  INSTALLED: { label: 'Nainstalováno', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  PHOTOGRAPHED: { label: 'Nafoceno', badge: 'bg-teal-100 text-teal-800 border-teal-300' },
  DELIVERED_TO_CLIENT: { label: 'Předáno klientovi', badge: 'bg-emerald-200 text-emerald-900 border-emerald-400' },
  CLAIM: { label: 'Reklamace', badge: 'bg-rose-100 text-rose-800 border-rose-300' },
  COMPLETED: { label: 'Dokončeno', badge: 'bg-gray-100 text-gray-800 border-gray-300' },
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, { label: string; badge: string }> = {
  DRAFT: { label: 'Návrh', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
  WAITING_FOR_SIGNATURE: { label: 'Čeká na podpis', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  ACTIVE: { label: 'Aktivní', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  EXPIRING_SOON: { label: 'Končí do 30-90 dnů', badge: 'bg-orange-100 text-orange-800 border-orange-300' },
  EXPIRED: { label: 'Ukončená platnost', badge: 'bg-rose-100 text-rose-800 border-rose-300' },
  TERMINATED: { label: 'Vypovězeno', badge: 'bg-zinc-100 text-zinc-700 border-zinc-300' },
  CANCELLED: { label: 'Zrušeno', badge: 'bg-red-100 text-red-800 border-red-300' },
};

export const CLIENT_INVOICE_STATUS_LABELS: Record<ClientInvoiceStatus, { label: string; badge: string }> = {
  DRAFT: { label: 'Návrh', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
  ISSUED: { label: 'Vystaveno', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  SENT: { label: 'Odesláno klientovi', badge: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  PARTIALLY_PAID: { label: 'Částečně hrazeno', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  PAID: { label: 'Uhrazeno', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  OVERDUE: { label: 'PO SPLATNOSTI', badge: 'bg-rose-100 text-rose-800 border-rose-300 font-bold' },
  CANCELLED: { label: 'Storno', badge: 'bg-gray-100 text-gray-700 border-gray-300' },
};

export const COMMUNICATION_TYPE_LABELS: Record<CommunicationType, { label: string; icon: string }> = {
  PHONE_CALL: { label: 'Telefonát', icon: '📞' },
  EMAIL: { label: 'E-mail', icon: '✉️' },
  IN_PERSON_MEETING: { label: 'Osobní schůzka', icon: '🤝' },
  ONLINE_MEETING: { label: 'Online schůzka', icon: '💻' },
  NOTE: { label: 'Poznámka', icon: '📝' },
  OFFER_SENT: { label: 'Odeslaná nabídka', icon: '📄' },
  ORDER_RECEIVED: { label: 'Přijatá objednávka', icon: '🛒' },
  COMPLAINT: { label: 'Reklamace', icon: '⚠️' },
  INTERNAL_NOTE: { label: 'Interní poznámka (skryto)', icon: '🔒' },
};

export const TASK_TYPE_LABELS: Record<CrmTaskType, string> = {
  CALL_CLIENT: 'Zavolat klientovi',
  PREPARE_OFFER: 'Připravit nabídku',
  VERIFY_MATERIALS: 'Ověřit tiskové podklady',
  GET_CONTRACT_SIGNED: 'Zajistit podpis smlouvy',
  PLAN_REALIZATION: 'Naplánovat realizaci',
  PROVIDE_PHOTO_DOCS: 'Dodat fotodokumentaci',
  ISSUE_INVOICE: 'Vystavit fakturu',
  RESOLVE_DEBT: 'Řešit pohledávku',
  RENEW_CAMPAIGN: 'Obnovit kampaň',
  OTHER: 'Ostatní úkol',
};

export const TASK_PRIORITY_LABELS: Record<CrmTaskPriority, { label: string; badge: string }> = {
  LOW: { label: 'Nízká', badge: 'bg-slate-100 text-slate-700' },
  NORMAL: { label: 'Běžná', badge: 'bg-blue-100 text-blue-800' },
  HIGH: { label: 'Vysoká', badge: 'bg-amber-100 text-amber-800' },
  URGENT: { label: 'URGENTNÍ', badge: 'bg-rose-100 text-rose-800 font-bold' },
};

export const TASK_STATUS_LABELS: Record<CrmTaskStatus, { label: string; badge: string }> = {
  TODO: { label: 'K řešení', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  IN_PROGRESS: { label: 'Probíhá', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  DONE: { label: 'Dokončeno', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  CANCELLED: { label: 'Zrušeno', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
};
