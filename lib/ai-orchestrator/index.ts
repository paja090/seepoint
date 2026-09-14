/**
 * AI Commercial Orchestrator V1 — Barrel Exports
 */

// Contracts
export * from './contracts/types';

// Engine
export {
  orchestrateMailboxToOffer,
  orchestrateOfferAccepted,
  getOrchestrationRunByCorrelationId,
  getOrchestrationRunsForEntity,
} from './orchestrator-engine';
export type { OrchestrateMailboxOptions, OrchestrationRunSummary } from './orchestrator-engine';

// Automation
export {
  isActionAllowed,
  getBlockReason,
  getOrganizationOrchestratorProfile,
  ALWAYS_REQUIRES_HUMAN,
} from './automation-policy';
export type { AutomationAction } from './automation-policy';

// Timeline
export { buildCommercialTimeline } from './commercial-timeline';

// Attention
export { getCommercialAttentionItems, priorityWeight } from './attention-service';

// Commercial Center
export { getCommercialCenterData } from './commercial-center-service';
