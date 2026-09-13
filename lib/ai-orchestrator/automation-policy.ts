/**
 * AI Commercial Orchestrator — Automation Policy
 *
 * Deterministic policy enforcement pro automatizační pravidla.
 * SEMI_AUTOMATIC (výchozí):
 *   SMÍ: analyzovat email, vytvořit request, kontrolovat dostupnost, připravit draft
 *   NESMÍ: odeslat nabídku, změnit cenu, rezervovat plochu, kontaktovat klienta, fakturovat
 */

import type { AutomationLevel, OrchestratorProfile, DEFAULT_ORCHESTRATOR_PROFILE } from './contracts/types';

export type AutomationAction =
  | 'ANALYZE_EMAIL'
  | 'CREATE_COMMERCIAL_REQUEST'
  | 'CHECK_AVAILABILITY'
  | 'CREATE_OFFER_DRAFT'
  | 'SEND_OFFER'
  | 'CHANGE_PRICE'
  | 'RESERVE_SURFACE'
  | 'CONTACT_CLIENT'
  | 'CREATE_INVOICE'
  | 'SEND_INVOICE'
  | 'ACCEPT_OFFER'
  | 'CREATE_CRM_ORDER'
  | 'HANDOFF_TO_REALIZATION';

/**
 * Matice povolených akcí per automation level.
 * Business-critical akce jsou VŽDY zakázány v automatickém režimu.
 */
const AUTOMATION_MATRIX: Record<AutomationLevel, Set<AutomationAction>> = {
  ASSISTED: new Set<AutomationAction>([
    'ANALYZE_EMAIL',
    'CREATE_COMMERCIAL_REQUEST',
  ]),
  SEMI_AUTOMATIC: new Set<AutomationAction>([
    'ANALYZE_EMAIL',
    'CREATE_COMMERCIAL_REQUEST',
    'CHECK_AVAILABILITY',
    'CREATE_OFFER_DRAFT',
  ]),
  ADVANCED: new Set<AutomationAction>([
    'ANALYZE_EMAIL',
    'CREATE_COMMERCIAL_REQUEST',
    'CHECK_AVAILABILITY',
    'CREATE_OFFER_DRAFT',
    'HANDOFF_TO_REALIZATION',
  ]),
};

/**
 * Akce, které vyžadují lidské schválení VŽDY, bez ohledu na automation level.
 * Toto je bezpečnostní záchrana — i kdyby někdo nastavil ADVANCED,
 * tyto akce nikdy nebudou provedeny automaticky.
 */
const ALWAYS_REQUIRES_HUMAN: ReadonlySet<AutomationAction> = new Set([
  'SEND_OFFER',
  'CHANGE_PRICE',
  'RESERVE_SURFACE',
  'CONTACT_CLIENT',
  'CREATE_INVOICE',
  'SEND_INVOICE',
  'ACCEPT_OFFER',
]);

/**
 * Kontroluje, zda daná akce je povolena při zadaném automation level.
 */
export function isActionAllowed(
  action: AutomationAction,
  automationLevel: AutomationLevel
): boolean {
  // Business-critical akce vyžadují VŽDY lidské schválení
  if (ALWAYS_REQUIRES_HUMAN.has(action)) {
    return false;
  }

  const allowedActions = AUTOMATION_MATRIX[automationLevel];
  return allowedActions?.has(action) ?? false;
}

/**
 * Vrací lidsky čitelný důvod, proč je akce blokována.
 */
export function getBlockReason(
  action: AutomationAction,
  automationLevel: AutomationLevel
): string | null {
  if (ALWAYS_REQUIRES_HUMAN.has(action)) {
    return `Akce "${action}" vyžaduje lidské schválení. Žádná úroveň automatizace toto nesmí obejít.`;
  }

  if (!isActionAllowed(action, automationLevel)) {
    return `Akce "${action}" není povolena na úrovni automatizace "${automationLevel}".`;
  }

  return null;
}

/**
 * Načte orchestrační profil organizace z JSON sloupce Organization.enabledModules.
 * Pokud profil neexistuje, vrátí bezpečné výchozí hodnoty (SEMI_AUTOMATIC).
 */
export function getOrganizationOrchestratorProfile(
  organization?: { enabledModules?: unknown } | null
): OrchestratorProfile {
  const defaults: OrchestratorProfile = {
    automationLevel: 'SEMI_AUTOMATIC',
    autoAnalyzeEmails: true,
    autoCheckAvailability: true,
    autoCreateOfferDraft: true,
    autoSendOffer: false,
    autoInvoice: false,
  };

  if (!organization?.enabledModules || typeof organization.enabledModules !== 'object') {
    return defaults;
  }

  const modules = organization.enabledModules as Record<string, unknown>;
  const profile = modules.orchestratorProfile as Partial<OrchestratorProfile> | undefined;

  if (!profile || typeof profile !== 'object') {
    return defaults;
  }

  return {
    automationLevel: (['ASSISTED', 'SEMI_AUTOMATIC', 'ADVANCED'] as const).includes(
      profile.automationLevel as AutomationLevel
    )
      ? (profile.automationLevel as AutomationLevel)
      : defaults.automationLevel,
    autoAnalyzeEmails: typeof profile.autoAnalyzeEmails === 'boolean' ? profile.autoAnalyzeEmails : defaults.autoAnalyzeEmails,
    autoCheckAvailability: typeof profile.autoCheckAvailability === 'boolean' ? profile.autoCheckAvailability : defaults.autoCheckAvailability,
    autoCreateOfferDraft: typeof profile.autoCreateOfferDraft === 'boolean' ? profile.autoCreateOfferDraft : defaults.autoCreateOfferDraft,
    autoSendOffer: false, // Hardcoded: nikdy automaticky
    autoInvoice: false,   // Hardcoded: nikdy automaticky
  };
}
