import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldCreateNavigationOrderAfterAcceptance,
} from '../lib/offers/domain.ts';
import {
  computeNavigationDiff,
  SAFE_NAVIGATION_SYNC_STATUSES,
} from '../lib/ai-realization/navigation-sync.ts';
import { hasModuleAccess } from '../lib/module-policy.ts';
import {
  evaluateBillingReadiness,
  evaluateRealization,
  determineRealizationNextBestActions,
} from '../lib/ai-realization/realization-engine.ts';
import { DEFAULT_REALIZATION_PROFILE } from '../lib/ai-realization/contracts/realization-profile.ts';
import type { RealizationContext } from '../lib/ai-realization/contracts/realization-context.ts';

describe('AI Realization & Multi-Target Navigation Handoff', () => {
  it('1. shouldCreateNavigationOrderAfterAcceptance respects two-phase navigation logic', () => {
    // Phase 1: Location selection only -> MUST NOT create NavigationOrder or CrmOrder
    assert.equal(
      shouldCreateNavigationOrderAfterAcceptance({
        offerType: 'NAVIGATION',
        proposalMode: 'LOCATION_SELECTION',
      }),
      false,
      'Phase 1 LOCATION_SELECTION must return false'
    );

    // Phase 2: Final priced quote -> MUST create NavigationOrder upon acceptance
    assert.equal(
      shouldCreateNavigationOrderAfterAcceptance({
        offerType: 'NAVIGATION',
        proposalMode: 'PRICED_QUOTE',
      }),
      true,
      'Phase 2 PRICED_QUOTE must return true'
    );

    // Standard media is handled by standard media flow
    assert.equal(
      shouldCreateNavigationOrderAfterAcceptance({
        offerType: 'STANDARD_MEDIA',
        proposalMode: null,
      }),
      false
    );
  });

  it('2. computeNavigationDiff correctly computes added, removed, and modified points and targets', () => {
    const offerTargets = [
      { id: 'ot-1', stableKey: 'key-target-1', name: 'OC Futurum Ostrava', latitude: 49.824, longitude: 18.252 },
      { id: 'ot-2', stableKey: 'key-target-2', name: 'Form Factory Frýdek-Místek', latitude: 49.684, longitude: 18.352 },
    ];
    const orderTargets = [
      { id: 'eot-1', sourceOfferTargetId: 'ot-1', stableKey: 'key-target-1', name: 'OC Futurum Ostrava', latitude: 49.824, longitude: 18.252 },
    ];

    const offerPoints = [
      { id: 'op-1', stableKey: 'p-key-1', label: 'Bod 1', latitude: 49.831, longitude: 18.261, unitPrice: 1500 },
      { id: 'op-2', stableKey: 'p-key-2', label: 'Bod 2 - Renamed', latitude: 49.829, longitude: 18.258, unitPrice: 2000 },
      { id: 'op-3', stableKey: 'p-key-3', label: 'Bod 3 - New FM', latitude: 49.687, longitude: 18.349, unitPrice: 1800 },
    ];
    const orderPoints = [
      { id: 'eop-1', sourceOfferPointKey: 'p-key-1', sourceOfferPointId: 'op-1', label: 'Bod 1', latitude: 49.831, longitude: 18.261, status: 'INSTALLED', unitPrice: 1500 },
      { id: 'eop-2', sourceOfferPointKey: 'p-key-2', sourceOfferPointId: 'op-2', label: 'Bod 2', latitude: 49.829, longitude: 18.258, status: 'PLANNED', unitPrice: 1500 },
      { id: 'eop-old', sourceOfferPointKey: 'p-key-removed', sourceOfferPointId: 'op-old', label: 'Bod Smazany', latitude: 49.800, longitude: 18.200, status: 'PLANNED', unitPrice: 1000 },
    ];

    const diff = computeNavigationDiff(offerTargets, orderTargets, offerPoints, orderPoints);

    assert.equal(diff.hasChanges, true);
    assert.equal(diff.addedTargets.length, 1);
    assert.equal(diff.addedTargets[0].name, 'Form Factory Frýdek-Místek');

    assert.equal(diff.addedPoints.length, 1);
    assert.equal(diff.addedPoints[0].label, 'Bod 3 - New FM');

    assert.equal(diff.modifiedPoints.length, 1);
    assert.equal(diff.modifiedPoints[0].id, 'eop-2');
    assert.equal(diff.modifiedPoints[0].changes.label?.to, 'Bod 2 - Renamed');
    assert.equal(diff.modifiedPoints[0].changes.unitPrice?.to, 2000);

    assert.equal(diff.removedPoints.length, 1);
    assert.equal(diff.removedPoints[0].id, 'eop-old');
  });

  it('3. SAFE_NAVIGATION_SYNC_STATUSES clearly delineates safe in-place sync from freeze phase change set', () => {
    assert.ok(SAFE_NAVIGATION_SYNC_STATUSES.includes('POTVRZENO_KLIENTEM'));
    assert.ok(SAFE_NAVIGATION_SYNC_STATUSES.includes('SMLOUVA_OBJEDNAVKA'));
    assert.ok(SAFE_NAVIGATION_SYNC_STATUSES.includes('GRAFICKE_PODKLADY'));
    assert.ok(SAFE_NAVIGATION_SYNC_STATUSES.includes('SCHVALENI_GRAFIKY'));

    // Production & installation must be treated as freeze phases requiring ChangeSet
    assert.equal(SAFE_NAVIGATION_SYNC_STATUSES.includes('TISK_VYROBA'), false);
    assert.equal(SAFE_NAVIGATION_SYNC_STATUSES.includes('INSTALACE'), false);
    assert.equal(SAFE_NAVIGATION_SYNC_STATUSES.includes('FOTODOKUMENTACE'), false);
    assert.equal(SAFE_NAVIGATION_SYNC_STATUSES.includes('PRIPRAVENO_K_FAKTURACI'), false);
  });

  it('4. module-policy fallback gives access to aiRealization when work module is enabled', () => {
    const userWithWorkOnly = {
      role: 'ADMIN',
      organizationId: 'org-test-1',
      organization: {
        id: 'org-test-1',
        isActive: true,
        plan: 'START',
        enabledModules: {
          work: true,
          // aiRealization not explicitly set
        },
      },
      membership: {
        organizationId: 'org-test-1',
        isActive: true,
      },
    };

    // Should return true via fallback
    assert.equal(
      hasModuleAccess(userWithWorkOnly, 'aiRealization'),
      true,
      'Tenant with work enabled should have fallback access to aiRealization'
    );

    const userWithoutWork = {
      role: 'ADMIN',
      organizationId: 'org-test-2',
      organization: {
        id: 'org-test-2',
        isActive: true,
        plan: 'START',
        enabledModules: {
          work: false,
          aiRealization: false,
        },
      },
      membership: {
        organizationId: 'org-test-2',
        isActive: true,
      },
    };

    assert.equal(
      hasModuleAccess(userWithoutWork, 'aiRealization'),
      false,
      'Tenant without work or aiRealization should be denied access'
    );
  });

  it('5. Navigation authority: evaluateBillingReadiness requires PRIPRAVENO_K_FAKTURACI for navigation', () => {
    const profile = { organizationId: 'test-org', ...DEFAULT_REALIZATION_PROFILE };

    const navContextPlanned: Parameters<typeof evaluateBillingReadiness>[0] = {
      organizationId: 'test-org',
      orderId: 'ord-1',
      orderNumber: 'ZAK-2026-0001',
      clientId: 'cli-1',
      clientName: 'Test Client',
      projectType: 'NAVIGATION',
      status: 'INSTALACE', // Not yet ready for billing
      campaign: {},
      items: [
        {
          id: 'p-1',
          status: 'INSTALLED',
          isInstalled: true,
          isPhotographed: true,
          hasDefect: false,
          photos: [],
        },
      ],
      tasks: [],
      printJobs: [],
      photos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const evaluationNotReady = evaluateBillingReadiness(navContextPlanned, profile);
    assert.equal(evaluationNotReady.isReady, false);
    assert.ok(evaluationNotReady.missingRequirements.some((r) => r.includes('PRIPRAVENO_K_FAKTURACI')));

    // When status is PRIPRAVENO_K_FAKTURACI and point installed & photographed
    const navContextReady = {
      ...navContextPlanned,
      status: 'PRIPRAVENO_K_FAKTURACI',
    };
    const evaluationReady = evaluateBillingReadiness(navContextReady, profile);
    assert.equal(evaluationReady.isReady, true);
    assert.equal(evaluationReady.blockerCount, 0);
  });

  it('6. Pending NavigationChangeSet triggers SCOPE_CHANGE_PENDING blocker and review NBA', () => {
    const profile = { organizationId: 'test-org', ...DEFAULT_REALIZATION_PROFILE };

    const baseContext = {
      organizationId: 'test-org',
      orderId: 'ord-2',
      orderNumber: 'ZAK-2026-0002',
      clientId: 'cli-1',
      clientName: 'Form Factory',
      projectType: 'NAVIGATION',
      status: 'INSTALACE',
      campaign: {},
      hasPendingChangeSet: true, // Pending scope change
      items: [
        {
          id: 'p-1',
          status: 'INSTALLED',
          isInstalled: true,
          isPhotographed: true,
          hasDefect: false,
          photos: [],
        },
      ],
      tasks: [],
      printJobs: [],
      photos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const evaluation = evaluateRealization(baseContext, profile);
    const fullContext: RealizationContext = {
      ...baseContext,
      ...evaluation,
    };

    // Blocker must be present
    const scopeBlocker = fullContext.blockers.find((b) => b.code === 'SCOPE_CHANGE_PENDING');
    assert.ok(scopeBlocker, 'SCOPE_CHANGE_PENDING blocker must be present');
    assert.equal(scopeBlocker.severity, 'WARNING');

    // Next Best Action must recommend reviewing changeset
    const actions = determineRealizationNextBestActions(fullContext);
    const reviewAction = actions.find((a) => a.id.includes('review-changeset'));
    assert.ok(reviewAction, 'Next Best Action must recommend reviewing the scope change');
    assert.equal(reviewAction.priority, 'HIGH');
  });
});
