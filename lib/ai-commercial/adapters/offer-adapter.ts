import type { CurrentUser } from '@/lib/rbac';
import type { OfferDraftInput, OfferDraftResult } from '../contracts/offer-draft';
import { buildCommercialOfferDraft } from '../offer-builder';

/**
 * Creates a formal Draft Offer from a structured OfferDraftInput.
 * Strictly verifies inventory availability via the canonical Availability Engine before creation.
 * Uses real pricing from database, separates exact matches from alternatives, and preserves source traceability.
 */
export async function generateOfferDraftFromStructuredInput(
  input: OfferDraftInput,
  currentUser: CurrentUser
): Promise<OfferDraftResult> {
  return buildCommercialOfferDraft(input, currentUser);
}

export const createCommercialOfferDraft = generateOfferDraftFromStructuredInput;

