'use client';

import { NavigationOfferCockpit, type NavigationOfferCockpitProps } from './navigation-cockpit/NavigationOfferCockpit';
import type { ClientOption, DraftPoint, DraftTarget } from './navigation-cockpit/types';
import { TARGET_COLORS } from './navigation-cockpit/types';

export type NavigationTargetItem = DraftTarget;
export { TARGET_COLORS };
export type { ClientOption, DraftPoint };

/**
 * NavigationOfferForm – Delegating cockpit wrapper.
 * Replaces the monolithic form with the 4-step Navigation Offer Cockpit:
 * Step 1: Basics (Client, Campaign, City, Dates, Phase A/B toggle)
 * Step 2: Targets (Stores management, geocoding, pin colors, client branches)
 * Step 3: Map & Points (68% Google Map + 32% Compact Point List + Detail Drawer)
 * Step 4: Review (Phase 1) / Itemized Pricing & VAT (Phase 2)
 */
export function NavigationOfferForm(props: NavigationOfferCockpitProps) {
  return <NavigationOfferCockpit {...props} />;
}
