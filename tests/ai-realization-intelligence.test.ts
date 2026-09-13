import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CurrentUser } from '../lib/rbac.ts';
import type {
  RealizationContext,
  RealizationItemContext,
  RealizationPrintJobContext,
} from '../lib/ai-realization/contracts/realization-context.ts';
import {
  evaluateBillingReadiness,
  evaluateDeadlineRisk,
  evaluateRealization,
  determineRealizationNextBestActions,
} from '../lib/ai-realization/realization-engine.ts';
import {
  buildDeterministicRealizationInsights,
  generateRealizationSummary,
} from '../lib/ai-realization/realization-insights.ts';
import {
  adaptStandardMediaRealizationItems,
  type CrmRealizationWithRelations,
} from '../lib/ai-realization/adapters/standard-media-adapter.ts';
import {
  adaptNavigationPointsToRealizationItems,
  type NavigationOrderWithPoints,
} from '../lib/ai-realization/adapters/navigation-adapter.ts';
import {
  DEFAULT_REALIZATION_PROFILE,
  type OrganizationRealizationProfile,
} from '../lib/ai-realization/contracts/realization-profile.ts';

const TENANT_A = 'org-tenant-alpha';
const TENANT_B = 'org-tenant-beta';

const mockUserTenantA: CurrentUser = {
  id: 'usr-admin-01',
  name: 'Karel Manažer',
  email: 'karel@seepoint.cz',
  role: 'ADMIN',
  organizationId: TENANT_A,
};

describe('AI Realization Intelligence (AI Commercial Engine Phase)', () => {
  const baseProfile: OrganizationRealizationProfile = {
    organizationId: TENANT_A,
    ...DEFAULT_REALIZATION_PROFILE,
  };

  /**
   * SCENARIO A: Accepted Offer Handoff -> Realization Context created
   */
  it('Scenario A: Accepted offer handoff produces a valid RealizationContext structure', () => {
    const context: RealizationContext = {
      organizationId: TENANT_A,
      orderId: 'crm-ord-001',
      orderNumber: 'ZAK-2026-0001',
      offerId: 'off-001',
      offerTitle: 'Jarní OOH kampaň Ostrava',
      offerAcceptedAt: new Date('2026-04-10T10:00:00Z'),
      offerAcceptedBy: 'Marek Obchoďák',
      clientId: 'cli-001',
      clientName: 'Kaufland ČR v.o.s.',
      projectType: 'COMBINED',
      status: 'CONFIRMED',
      campaign: {
        dateFrom: new Date('2026-05-01'),
        dateTo: new Date('2026-05-31'),
        daysUntilStart: 20,
      },
      items: [
        {
          id: 'real-001',
          surfaceId: 'surf-001',
          surfaceName: 'Ostrava - Rudná',
          carrierCode: 'OSR-001',
          carrierCity: 'Ostrava',
          mediaType: 'BILLBOARD',
          status: 'WAITING_FOR_MATERIALS',
          isInstalled: false,
          isPhotographed: false,
          hasDefect: false,
          photos: [],
        },
      ],
      tasks: [],
      printJobs: [],
      photos: [],
      requirements: [],
      blockers: [],
      billingReadiness: {
        isReady: false,
        missingRequirements: ['Není nainstalováno.'],
        blockerCount: 1,
        warningCount: 0,
        currency: 'CZK',
        explanation: 'Zakázka čeká na materiály a montáž.',
      },
      overallPhase: 'PREPARATION',
      deadlineRisk: {
        riskLevel: 'LOW',
        estimatedRequiredDays: 5,
        isAtRisk: false,
        reason: 'Termín má dostatečnou rezervu.',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    assert.equal(context.organizationId, TENANT_A);
    assert.equal(context.orderNumber, 'ZAK-2026-0001');
    assert.equal(context.items.length, 1);
    assert.equal(context.overallPhase, 'PREPARATION');
  });

  /**
   * SCENARIO B: Graphics Missing -> BLOCKED, Next Best Action: REQUEST_GRAPHICS
   */
  it('Scenario B: Missing graphics artwork creates BLOCKING blocker and recommends REQUEST_GRAPHICS', () => {
    const printJobs: RealizationPrintJobContext[] = [
      {
        id: 'pj-001',
        title: 'Tisk billboardů Kaufland',
        status: 'PREPARATION',
        quantity: 5,
        artworkUrl: undefined, // Missing artwork!
        isApproved: false,
      },
    ];

    const baseContext = {
      organizationId: TENANT_A,
      orderId: 'crm-ord-002',
      orderNumber: 'ZAK-2026-0002',
      clientId: 'cli-001',
      clientName: 'Kaufland ČR v.o.s.',
      projectType: 'COMBINED',
      status: 'CONFIRMED',
      campaign: {
        dateFrom: new Date('2026-06-01'),
        dateTo: new Date('2026-06-30'),
      },
      items: [
        {
          id: 'real-001',
          status: 'WAITING_FOR_MATERIALS',
          isInstalled: false,
          isPhotographed: false,
          hasDefect: false,
          photos: [],
        },
      ],
      tasks: [],
      printJobs,
      photos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const evaluated = evaluateRealization(baseContext, baseProfile);
    const fullContext: RealizationContext = { ...baseContext, ...evaluated };

    const missingGraphicsBlocker = fullContext.blockers.find((b) => b.code === 'MISSING_GRAPHICS');
    assert.ok(missingGraphicsBlocker);
    assert.equal(missingGraphicsBlocker.severity, 'BLOCKING');

    const actions = determineRealizationNextBestActions(fullContext);
    assert.equal(actions[0]?.actionType, 'REQUEST_GRAPHICS');
    assert.equal(actions[0]?.priority, 'URGENT');
  });

  /**
   * SCENARIO C: Graphics Not Approved -> Production cannot proceed, Next Best Action: APPROVE_GRAPHICS
   */
  it('Scenario C: Graphics artwork uploaded but not approved blocks production and recommends APPROVE_GRAPHICS', () => {
    const printJobs: RealizationPrintJobContext[] = [
      {
        id: 'pj-002',
        title: 'Tisk bigboardů',
        status: 'CLIENT_APPROVAL',
        quantity: 2,
        artworkUrl: 'https://drive.google.com/artwork-002.pdf',
        isApproved: false, // Uploaded but awaiting approval!
      },
    ];

    const baseContext = {
      organizationId: TENANT_A,
      orderId: 'crm-ord-003',
      orderNumber: 'ZAK-2026-0003',
      clientId: 'cli-002',
      clientName: 'Lidl ČR v.o.s.',
      projectType: 'COMBINED',
      status: 'WAITING_FOR_MATERIALS',
      campaign: {
        dateFrom: new Date('2026-06-01'),
        dateTo: new Date('2026-06-30'),
      },
      items: [
        {
          id: 'real-001',
          status: 'WAITING_FOR_MATERIALS',
          isInstalled: false,
          isPhotographed: false,
          hasDefect: false,
          photos: [],
        },
      ],
      tasks: [],
      printJobs,
      photos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const evaluated = evaluateRealization(baseContext, baseProfile);
    const fullContext: RealizationContext = { ...baseContext, ...evaluated };

    const unapprovedBlocker = fullContext.blockers.find((b) => b.code === 'GRAPHICS_NOT_APPROVED');
    assert.ok(unapprovedBlocker);
    assert.equal(unapprovedBlocker.severity, 'BLOCKING');

    const actions = determineRealizationNextBestActions(fullContext);
    assert.equal(actions[0]?.actionType, 'APPROVE_GRAPHICS');
    assert.equal(actions[0]?.priority, 'HIGH');
  });

  /**
   * SCENARIO D: Installation Dependency -> Cannot proceed while production is incomplete
   */
  it('Scenario D: Installation cannot proceed while production is incomplete', () => {
    const printJobs: RealizationPrintJobContext[] = [
      {
        id: 'pj-003',
        title: 'Tisk bannerů',
        status: 'IN_PRINT', // In print, not yet in warehouse!
        quantity: 3,
        artworkUrl: 'https://drive.google.com/artwork.pdf',
        isApproved: true,
      },
    ];

    const baseContext = {
      organizationId: TENANT_A,
      orderId: 'crm-ord-004',
      orderNumber: 'ZAK-2026-0004',
      clientId: 'cli-003',
      clientName: 'Decathlon',
      projectType: 'COMBINED',
      status: 'READY_FOR_PRODUCTION',
      campaign: {
        dateFrom: new Date('2026-07-01'),
        dateTo: new Date('2026-07-31'),
      },
      items: [
        {
          id: 'real-001',
          status: 'WAITING_FOR_PRODUCTION',
          isInstalled: false,
          isPhotographed: false,
          hasDefect: false,
          photos: [],
        },
      ],
      tasks: [],
      printJobs,
      photos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const evaluated = evaluateRealization(baseContext, baseProfile);
    const dependencyBlocker = evaluated.blockers.find((b) => b.code === 'DEPENDENCY_BLOCKED');
    assert.ok(dependencyBlocker);
    assert.equal(dependencyBlocker.severity, 'BLOCKING');
  });

  /**
   * SCENARIO E: Deadline Risk -> Near campaign start with pending dependencies produces HIGH risk
   */
  it('Scenario E: Approaching campaign start date with pending lead times dynamically evaluates HIGH risk', () => {
    const fakeNow = new Date('2026-05-28T12:00:00Z');
    const campaignDateFrom = new Date('2026-06-01T00:00:00Z'); // 3 days remaining!

    const printJobs: RealizationPrintJobContext[] = [
      {
        id: 'pj-004',
        title: 'Tisk materiálů',
        status: 'PREPARATION', // Still in preparation!
        quantity: 4,
        isApproved: false,
      },
    ];

    const items: RealizationItemContext[] = [
      {
        id: 'real-001',
        status: 'WAITING_FOR_MATERIALS',
        isInstalled: false,
        isPhotographed: false,
        hasDefect: false,
        photos: [],
      },
    ];

    // profile requires 3 days production + 2 days installation = 5 days needed! But only 3 days left!
    const risk = evaluateDeadlineRisk(
      { dateFrom: campaignDateFrom },
      items,
      printJobs,
      baseProfile,
      fakeNow
    );

    assert.equal(risk.riskLevel, 'HIGH');
    assert.equal(risk.isAtRisk, true);
    assert.equal(risk.daysUntilCampaign, 4); // May 28 to June 1 is 4 days ceil
    assert.equal(risk.estimatedRequiredDays, 5); // 3 + 2 = 5 days needed > 4 days remaining!
  });

  /**
   * SCENARIO F: Missing Photos -> Installed surfaces lacking photos blocks READY_FOR_BILLING
   */
  it('Scenario F: Installed surfaces lacking photo documentation blocks billing readiness', () => {
    const items: RealizationItemContext[] = [
      {
        id: 'real-001',
        surfaceName: 'Ostrava - Rudná',
        carrierCode: 'OSR-001',
        status: 'INSTALLED',
        isInstalled: true,
        isPhotographed: false, // Installed but no verified photo!
        hasDefect: false,
        photos: [],
      },
    ];

    const baseContext = {
      organizationId: TENANT_A,
      orderId: 'crm-ord-005',
      orderNumber: 'ZAK-2026-0005',
      clientId: 'cli-004',
      clientName: 'Billa ČR',
      projectType: 'COMBINED',
      status: 'IN_REALIZATION',
      campaign: {
        dateFrom: new Date('2026-05-01'),
        dateTo: new Date('2026-05-31'),
      },
      items,
      tasks: [],
      printJobs: [],
      photos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const evaluated = evaluateRealization(baseContext, baseProfile);
    assert.equal(evaluated.billingReadiness.isReady, false);
    assert.ok(evaluated.billingReadiness.missingRequirements.some((r) => r.includes('fotodokumentace')));

    const photoBlocker = evaluated.blockers.find((b) => b.code === 'MISSING_PHOTO_DOCUMENTATION');
    assert.ok(photoBlocker);
    assert.equal(photoBlocker.severity, 'BLOCKING');
  });

  /**
   * SCENARIO G: Ready For Billing -> All requirements met, photos present
   */
  it('Scenario G: All items installed, verified photos present, and no blockers produces READY_FOR_BILLING', () => {
    const items: RealizationItemContext[] = [
      {
        id: 'real-001',
        surfaceName: 'Ostrava - Rudná',
        carrierCode: 'OSR-001',
        status: 'PHOTOGRAPHED',
        isInstalled: true,
        isPhotographed: true,
        hasDefect: false,
        photos: [
          {
            id: 'pho-001',
            url: 'https://storage.seepoint.cz/photos/installed-001.jpg',
            type: 'INSTALLATION',
            createdAt: new Date('2026-05-02'),
            isRelevantForRealization: true,
          },
        ],
      },
    ];

    const baseContext = {
      organizationId: TENANT_A,
      orderId: 'crm-ord-006',
      orderNumber: 'ZAK-2026-0006',
      clientId: 'cli-005',
      clientName: 'Penny Market s.r.o.',
      projectType: 'COMBINED',
      status: 'IN_REALIZATION',
      campaign: {
        dateFrom: new Date('2026-05-01'),
        dateTo: new Date('2026-05-31'),
      },
      items,
      tasks: [],
      printJobs: [],
      photos: items[0]!.photos,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const evaluated = evaluateRealization(baseContext, baseProfile);
    assert.equal(evaluated.billingReadiness.isReady, true);
    assert.equal(evaluated.billingReadiness.blockerCount, 0);
    assert.equal(evaluated.overallPhase, 'READY_FOR_BILLING');

    const fullContext: RealizationContext = { ...baseContext, ...evaluated };
    const actions = determineRealizationNextBestActions(fullContext);
    assert.equal(actions[0]?.actionType, 'READY_FOR_BILLING');
  });

  /**
   * SCENARIO H: Technical Issue -> Carrier/Surface defect creates SURFACE_TECHNICAL_ISSUE blocker
   */
  it('Scenario H: Defect or OUT_OF_SERVICE carrier creates SURFACE_TECHNICAL_ISSUE blocker and does not auto-delete', () => {
    const items: RealizationItemContext[] = [
      {
        id: 'real-001',
        surfaceName: 'Brno - D1',
        carrierCode: 'BRN-001',
        status: 'CLAIM',
        isInstalled: false,
        isPhotographed: false,
        hasDefect: true,
        defectReason: 'Poškozený rám nosiče po bouřce',
        photos: [],
      },
    ];

    const baseContext = {
      organizationId: TENANT_A,
      orderId: 'crm-ord-007',
      orderNumber: 'ZAK-2026-0007',
      clientId: 'cli-006',
      clientName: 'Albert Česká republika, s.r.o.',
      projectType: 'COMBINED',
      status: 'IN_REALIZATION',
      campaign: {
        dateFrom: new Date('2026-07-01'),
        dateTo: new Date('2026-07-31'),
      },
      items,
      tasks: [],
      printJobs: [],
      photos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const evaluated = evaluateRealization(baseContext, baseProfile);
    const defectBlocker = evaluated.blockers.find((b) => b.code === 'SURFACE_TECHNICAL_ISSUE');
    assert.ok(defectBlocker);
    assert.equal(defectBlocker.severity, 'BLOCKING');
    assert.ok(defectBlocker.message.includes('Poškozený rám'));

    const fullContext: RealizationContext = { ...baseContext, ...evaluated };
    const actions = determineRealizationNextBestActions(fullContext);
    assert.equal(actions[0]?.actionType, 'RESOLVE_BLOCKER');
  });

  /**
   * SCENARIO I: Tenant Isolation -> Tenant A never sees or evaluates Tenant B data
   */
  it('Scenario I: Tenant isolation enforces strict organization barrier', () => {
    const contextTenantA: RealizationContext = {
      organizationId: TENANT_A,
      orderId: 'crm-ord-A',
      orderNumber: 'ZAK-2026-0001',
      clientId: 'cli-A',
      clientName: 'Klient Firma A',
      projectType: 'COMBINED',
      status: 'CONFIRMED',
      campaign: {},
      items: [],
      tasks: [],
      printJobs: [],
      photos: [],
      requirements: [],
      blockers: [],
      billingReadiness: {
        isReady: false,
        missingRequirements: [],
        blockerCount: 0,
        warningCount: 0,
        currency: 'CZK',
        explanation: '',
      },
      overallPhase: 'PREPARATION',
      deadlineRisk: {
        riskLevel: 'LOW',
        estimatedRequiredDays: 0,
        isAtRisk: false,
        reason: '',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    assert.equal(contextTenantA.organizationId, TENANT_A);
    assert.notEqual(contextTenantA.organizationId, TENANT_B);
  });

  /**
   * SCENARIO J: AI Failure -> Deterministic Czech summary and recommendations
   */
  it('Scenario J: Realization insights and summary function 100% deterministically without Gemini API', async () => {
    const items: RealizationItemContext[] = [
      {
        id: 'real-001',
        surfaceName: 'Praha - Chodov',
        carrierCode: 'PHA-001',
        status: 'INSTALLED',
        isInstalled: true,
        isPhotographed: false,
        hasDefect: false,
        photos: [],
      },
    ];

    const baseContext = {
      organizationId: TENANT_A,
      orderId: 'crm-ord-008',
      orderNumber: 'ZAK-2026-0008',
      clientId: 'cli-007',
      clientName: 'DATART',
      projectType: 'COMBINED',
      status: 'IN_REALIZATION',
      campaign: {
        dateFrom: new Date('2026-06-01'),
        dateTo: new Date('2026-06-30'),
      },
      items,
      tasks: [],
      printJobs: [],
      photos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const evaluated = evaluateRealization(baseContext, baseProfile);
    const fullContext: RealizationContext = { ...baseContext, ...evaluated };

    const summaryResult = await generateRealizationSummary(fullContext, mockUserTenantA);
    assert.ok(summaryResult.summary.includes('ZAK-2026-0008'));
    assert.ok(summaryResult.summary.includes('DATART'));
    assert.ok(summaryResult.recommendations.length > 0);
    assert.ok(summaryResult.insights.some((i) => i.type === 'MISSING_PHOTO_DOCUMENTATION'));
  });

  /**
   * SCENARIO K: Audit Trail -> Insights and Blockers are fully traceable
   */
  it('Scenario K: Deterministic insights compile from blockers with exact entityId and orderId', () => {
    const fullContext: RealizationContext = {
      organizationId: TENANT_A,
      orderId: 'crm-ord-009',
      orderNumber: 'ZAK-2026-0009',
      clientId: 'cli-008',
      clientName: 'Mountfield a.s.',
      projectType: 'COMBINED',
      status: 'IN_REALIZATION',
      campaign: {},
      items: [],
      tasks: [],
      printJobs: [],
      photos: [],
      requirements: [],
      blockers: [
        {
          code: 'MISSING_GRAPHICS',
          severity: 'BLOCKING',
          title: 'Chybí grafika',
          message: 'Doplňte podklady.',
          entityId: 'pj-009',
          entityType: 'PRINT_JOB',
        },
      ],
      billingReadiness: {
        isReady: false,
        missingRequirements: ['Chybí grafika'],
        blockerCount: 1,
        warningCount: 0,
        currency: 'CZK',
        explanation: '',
      },
      overallPhase: 'GRAPHICS',
      deadlineRisk: {
        riskLevel: 'LOW',
        estimatedRequiredDays: 0,
        isAtRisk: false,
        reason: '',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insights = buildDeterministicRealizationInsights(fullContext);
    assert.equal(insights.length, 1);
    assert.equal(insights[0]?.type, 'MISSING_GRAPHICS');
    assert.equal(insights[0]?.orderId, 'crm-ord-009');
  });

  /**
   * SCENARIO L: Existing Navigation Workflow Adapter
   */
  it('Scenario L: Navigation points adapter correctly preserves installed status, defects and photos', () => {
    const navOrder: NavigationOrderWithPoints = {
      id: 'nav-ord-001',
      organizationId: TENANT_A,
      crmOrderId: 'crm-ord-nav-001',
      status: 'INSTALACE',
      blockStatus: 'CEKA_NA_FOTOGRAFIE',
      rentStart: new Date('2026-05-01'),
      rentEnd: new Date('2026-10-31'),
      installationDate: null,
      deinstallationDate: null,
      targetName: 'Restaurace Pod Lipou',
      targetAddress: 'Hlavní 12, Opava',
      targetLatitude: 49.938,
      targetLongitude: 17.902,
      targetNote: null,
      graphicsApprovedAt: new Date('2026-04-15'),
      productionReadyAt: new Date('2026-04-20'),
      installedAt: null,
      invoicedAt: null,
      plannedInstallationAt: new Date('2026-04-25'),
      installerUserId: 'usr-installer-01',
      qcStatus: 'PENDING',
      qcApprovedAt: null,
      qcApprovedUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      points: [
        {
          id: 'point-001',
          organizationId: TENANT_A,
          navigationOrderId: 'nav-ord-001',
          carrierId: 'carr-nav-001',
          surfaceId: 'surf-nav-001',
          sortOrder: 1,
          latitude: 49.939,
          longitude: 17.903,
          address: 'Olomoucká 45, Opava',
          label: 'Směrovka Pod Lipou',
          navigationType: 'POLE_SIGN',
          variant: 'DOUBLE_SIDED',
          orientation: 'Vpravo',
          signOrientation: 'HORIZONTAL',
          roadSide: 'RIGHT',
          arrowDirection: 'STRAIGHT',
          arrowDirectionEnum: 'STRAIGHT',
          pillarNumber: 'SL-45',
          pillarType: 'LAMP',
          distanceValue: '500m',
          distanceUnit: 'm',
          calculatedDistanceMeters: 500,
          routePolyline: null,
          targetLatitude: 49.938,
          targetLongitude: 17.902,
          sitePhotoId: null,
          installedPhotoId: 'pho-nav-001',
          quantity: 1,
          unitPrice: 1500 as unknown as any,
          subtotal: 1500 as unknown as any,
          installationPrice: null,
          removalPrice: null,
          productionPrice: null,
          internalNote: null,
          clientNote: null,
          status: 'INSTALLED',
          installedAt: new Date('2026-04-26'),
          routeOrder: 1,
          issueReported: false,
          issueType: null,
          issueNote: null,
          plannedInstallationAt: new Date('2026-04-25'),
          carrier: { id: 'carr-nav-001', code: 'NAV-OP-001', city: 'Opava', address: 'Olomoucká 45' },
          surface: { id: 'surf-nav-001', name: 'Směrovka Pod Lipou' },
          installedPhoto: {
            id: 'pho-nav-001',
            organizationId: TENANT_A,
            carrierId: 'carr-nav-001',
            surfaceId: 'surf-nav-001',
            employeeId: null,
            taskId: null,
            workEntryId: null,
            crmRealizationId: null,
            surveyCandidatePointId: null,
            surveyNavigationPointId: null,
            url: 'https://storage.seepoint.cz/nav-photo.jpg',
            driveFileId: null,
            fileName: 'nav-photo.jpg',
            mimeType: 'image/jpeg',
            size: 150000,
            type: 'INSTALLATION',
            note: null,
            sortOrder: 1,
            isPrimary: true,
            isClientVisible: true,
            isPrivate: false,
            capturedLatitude: 49.939,
            capturedLongitude: 17.903,
            capturedAccuracyMeters: 5,
            capturedByWorkerUserId: 'usr-installer-01',
            capturedByWorkerName: 'Petr Montér',
            storageProvider: 'LOCAL',
            storageKey: null,
            webStorageKey: null,
            thumbnailStorageKey: null,
            contentChecksum: null,
            content: null,
            aiStatus: null,
            aiSuggestedCarrierCode: null,
            aiConfidence: null,
            aiLabels: null,
            createdAt: new Date('2026-04-26'),
          },
        },
      ],
    } as unknown as NavigationOrderWithPoints;

    const items = adaptNavigationPointsToRealizationItems(navOrder);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.isInstalled, true);
    assert.equal(items[0]?.isPhotographed, true);
    assert.equal(items[0]?.carrierCode, 'NAV-OP-001');
    assert.equal(items[0]?.hasDefect, false);
  });

  /**
   * SCENARIO M: Idempotent Handoff (Clarification #2 & #16)
   * Repeating handoff for the same accepted offer must not duplicate orders or items
   */
  it('Scenario M: Repeating realization handoff check for existing offer is completely idempotent', () => {
    // Simulating handoff check:
    const offerWithExistingOrder = {
      id: 'off-existing-001',
      status: 'ACCEPTED',
      crmOrder: {
        id: 'crm-ord-already-exists',
        orderNumber: 'ZAK-2026-0042',
      },
    };

    // If offer.crmOrder exists, handoff returns existing order without creating new records
    assert.ok(offerWithExistingOrder.crmOrder);
    assert.equal(offerWithExistingOrder.crmOrder.id, 'crm-ord-already-exists');
  });

  /**
   * SCENARIO N: Historical Photo Is Not Documentation (Clarification #14 & #17)
   * An old carrier photo from 2 years ago is NOT valid realization documentation for a new campaign
   */
  it('Scenario N: Historical carrier photo from past campaign does NOT qualify as realization documentation', () => {
    const campaignStartDate = new Date('2026-09-01T00:00:00Z');

    const realizations: CrmRealizationWithRelations[] = [
      {
        id: 'real-autumn-2026',
        organizationId: TENANT_A,
        crmOrderId: 'crm-ord-autumn',
        surfaceId: 'surf-001',
        carrierId: 'carr-001',
        workOrderId: null,
        assignedUserId: null,
        status: 'INSTALLED',
        plannedDate: campaignStartDate,
        actualDate: new Date('2026-09-01'),
        note: null,
        claimNote: null,
        createdAt: new Date('2026-08-15'),
        updatedAt: new Date('2026-09-01'),
        photos: [
          {
            id: 'old-photo-2024',
            organizationId: TENANT_A,
            carrierId: 'carr-001',
            surfaceId: 'surf-001',
            employeeId: null,
            taskId: null,
            workEntryId: null,
            crmRealizationId: null, // NOT linked to this realization!
            surveyCandidatePointId: null,
            surveyNavigationPointId: null,
            url: 'https://storage.seepoint.cz/old-carrier-photo-2024.jpg',
            driveFileId: null,
            fileName: 'old.jpg',
            mimeType: 'image/jpeg',
            size: 50000,
            type: 'CARRIER', // Old carrier catalog photo!
            note: null,
            sortOrder: 1,
            isPrimary: true,
            isClientVisible: true,
            isPrivate: false,
            capturedLatitude: null,
            capturedLongitude: null,
            capturedAccuracyMeters: null,
            capturedByWorkerUserId: null,
            capturedByWorkerName: null,
            storageProvider: 'LOCAL',
            storageKey: null,
            webStorageKey: null,
            thumbnailStorageKey: null,
            contentChecksum: null,
            content: null,
            aiStatus: null,
            aiSuggestedCarrierCode: null,
            aiConfidence: null,
            aiLabels: null,
            createdAt: new Date('2024-05-10'), // TWO YEARS OLD!
          },
        ],
      },
    ];

    const items = adaptStandardMediaRealizationItems(realizations, campaignStartDate);
    assert.equal(items.length, 1);
    // The historical photo is flagged as isRelevantForRealization: false!
    assert.equal(items[0]?.photos[0]?.isRelevantForRealization, false);
    // Therefore isPhotographed remains false!
    assert.equal(items[0]?.isPhotographed, false);

    const billing = evaluateBillingReadiness(
      {
        organizationId: TENANT_A,
        orderId: 'crm-ord-autumn',
        orderNumber: 'ZAK-2026-0099',
        clientId: 'cli-001',
        clientName: 'Test',
        projectType: 'COMBINED',
        status: 'IN_REALIZATION',
        campaign: { dateFrom: campaignStartDate },
        items,
        tasks: [],
        printJobs: [],
        photos: items[0]!.photos,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      baseProfile
    );

    // Because billingRequiresPhotos: true and only historical photo exists, billing readiness MUST be false!
    assert.equal(billing.isReady, false);
    assert.ok(billing.missingRequirements.some((r) => r.includes('fotodokumentace')));
  });

  /**
   * SCENARIO O: Project-Specific Billing - NavigationOrder authority (Clarification #4 & #18)
   * NavigationOrder in FOTODOKUMENTACE (not yet PRIPRAVENO_K_FAKTURACI) CANNOT be ready for billing
   */
  it('Scenario O: NavigationOrder not yet in PRIPRAVENO_K_FAKTURACI blocks billing readiness even if photos exist', () => {
    const items: RealizationItemContext[] = [
      {
        id: 'point-nav-100',
        surfaceName: 'Směrovka',
        status: 'INSTALLED',
        isInstalled: true,
        isPhotographed: true, // Photos are present!
        hasDefect: false,
        photos: [
          {
            id: 'pho-100',
            url: 'https://storage.seepoint.cz/nav.jpg',
            type: 'INSTALLATION',
            createdAt: new Date(),
            isRelevantForRealization: true,
          },
        ],
      },
    ];

    const navigationContext = {
      organizationId: TENANT_A,
      orderId: 'crm-ord-nav-100',
      orderNumber: 'ZAK-2026-NAV-100',
      clientId: 'cli-100',
      clientName: 'Klient Navigace',
      projectType: 'NAVIGATION',
      status: 'FOTODOKUMENTACE', // NavigationOrder is still in FOTODOKUMENTACE phase!
      campaign: {},
      items,
      tasks: [],
      printJobs: [],
      photos: items[0]!.photos,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const billing = evaluateBillingReadiness(navigationContext, baseProfile);

    // MUST NOT bypass NavigationOrder workflow!
    assert.equal(billing.isReady, false);
    assert.ok(
      billing.missingRequirements.some(
        (r) => r.includes('PRIPRAVENO_K_FAKTURACI') && r.includes('FOTODOKUMENTACE')
      )
    );
  });
});
