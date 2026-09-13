/**
 * AI Commercial Orchestrator V1 — Barrel Exports
 */

// Contracts
export * from './contracts/types';

// Engine
export { orchestrateMailboxToOffer, orchestrateOfferAccepted } from './orchestrator-engine';
export type { OrchestrateMailboxOptions } from './orchestrator-engine';

// Automation
export { isActionAllowed, getBlockReason, getOrganizationOrchestratorProfile } from './automation-policy';
export type { AutomationAction } from './automation-policy';

// Timeline
export { buildCommercialTimeline } from './commercial-timeline';

// Attention
export { getCommercialAttentionItems } from './attention-service';

// Commercial Center
export { getCommercialCenterData } from './commercial-center-service';
