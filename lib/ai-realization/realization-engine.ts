import type { CurrentUser } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { runWithTenantContext } from '@/lib/tenant-context';
import type {
  RealizationContext,
  RealizationItemContext,
  RealizationRequirement,
  RealizationBlocker,
  RealizationBillingReadiness,
  RealizationPhase,
  DeadlineRiskEvaluation,
  RealizationPrintJobContext,
  RealizationTaskContext,
  RealizationPhotoContext,
} from './contracts/realization-context';
import type { OrganizationRealizationProfile } from './contracts/realization-profile';
import type { RealizationNextBestAction } from './contracts/realization-action';
import { DEFAULT_REALIZATION_PROFILE } from './contracts/realization-profile';
import {
  adaptNavigationPointsToRealizationItems,
  mapNavigationOrderStatusToPhase,
  type NavigationOrderWithPoints,
} from './adapters/navigation-adapter';
import {
  adaptStandardMediaRealizationItems,
  type CrmRealizationWithRelations,
} from './adapters/standard-media-adapter';

/**
 * Pure deterministic evaluation of billing readiness.
 * Respects projectType, organization profile, and navigation authority.
 */
export function evaluateBillingReadiness(
  context: Omit<RealizationContext, 'billingReadiness' | 'requirements' | 'blockers' | 'deadlineRisk' | 'overallPhase'>,
  profile: OrganizationRealizationProfile
): RealizationBillingReadiness {
  const missingRequirements: string[] = [];
  const items = context.items || [];

  if (items.length === 0) {
    return {
      isReady: false,
      missingRequirements: ['Zakázka neobsahuje žádné realizační položky ani plochy.'],
      blockerCount: 1,
      warningCount: 0,
      currency: 'CZK',
      explanation: 'Zakázka nemá definované žádné realizační položky.',
    };
  }

  // 1. Navigation authority check (Clarification #4 & Scenario O):
  // For navigation orders, NavigationOrder workflow is authoritative and CANNOT be bypassed.
  if (context.projectType === 'NAVIGATION') {
    const navStatus = String(context.status);
    const validNavBillingStatuses = ['PRIPRAVENO_K_FAKTURACI', 'FAKTUROVANO', 'DOKONCENO'];
    if (!validNavBillingStatuses.includes(navStatus)) {
      missingRequirements.push(
        `Navigační zakázka se nachází ve stavu '${navStatus}'. K fakturaci je vyžadován stav 'PRIPRAVENO_K_FAKTURACI'.`
      );
    }
  }

  // 2. Installation completeness check:
  const uninstalledItems = items.filter((i) => !i.isInstalled);
  if (uninstalledItems.length > 0) {
    missingRequirements.push(
      `Z ${items.length} položek zbývá nainstalovat ${uninstalledItems.length} ploch.`
    );
  }

  // 3. Photo documentation check (Clarification #14 & Scenario N):
  const unphotographedItems = items.filter((i) => !i.isPhotographed);
  if (profile.billingRequiresPhotos && unphotographedItems.length > 0) {
    missingRequirements.push(
      `U ${unphotographedItems.length} ploch chybí ověřená fotodokumentace po instalaci.`
    );
  }

  // 4. Defect / Claim check (Clarification #8):
  const defectiveItems = items.filter((i) => i.hasDefect);
  if (defectiveItems.length > 0) {
    missingRequirements.push(
      `${defectiveItems.length} ploch má evidován technický problém nebo reklamaci.`
    );
  }

  const isReady = missingRequirements.length === 0;
  const explanation = isReady
    ? 'Všechny realizační požadavky, instalace a fotodokumentace jsou kompletní. Zakázka je připravena k fakturaci.'
    : `Zakázka zatím není připravena k fakturaci. Nevyřízené požadavky: ${missingRequirements.join(' ')}`;

  return {
    isReady,
    missingRequirements,
    blockerCount: isReady ? 0 : missingRequirements.length,
    warningCount: !profile.billingRequiresPhotos && unphotographedItems.length > 0 ? unphotographedItems.length : 0,
    currency: 'CZK',
    explanation,
  };
}

/**
 * Pure deterministic evaluation of deadline risks.
 * Avoids hardcoded days, relies strictly on configured profile lead times.
 */
export function evaluateDeadlineRisk(
  campaign: { dateFrom?: Date; dateTo?: Date },
  items: RealizationItemContext[],
  printJobs: RealizationPrintJobContext[],
  profile: OrganizationRealizationProfile,
  now = new Date()
): DeadlineRiskEvaluation {
  if (!campaign.dateFrom) {
    return {
      riskLevel: 'LOW',
      estimatedRequiredDays: profile.productionLeadDays + profile.installationLeadDays,
      isAtRisk: false,
      reason: 'Termín kampaně není stanoven.',
    };
  }

  const msDiff = campaign.dateFrom.getTime() - now.getTime();
  const daysUntilCampaign = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

  const allInstalled = items.length > 0 && items.every((i) => i.isInstalled);
  if (allInstalled) {
    return {
      riskLevel: 'LOW',
      daysUntilCampaign,
      estimatedRequiredDays: 0,
      isAtRisk: false,
      reason: 'Všechny plochy jsou již nainstalovány.',
    };
  }

  // Calculate required lead time based on pending work
  const hasPendingPrint = printJobs.some((p) => p.status !== 'DELIVERED_TO_WAREHOUSE');
  const requiredProductionDays = hasPendingPrint ? profile.productionLeadDays : 0;
  const requiredInstallationDays = items.some((i) => !i.isInstalled) ? profile.installationLeadDays : 0;
  const estimatedRequiredDays = requiredProductionDays + requiredInstallationDays;

  // If time remaining is less than realistic execution lead time or within warning threshold
  const isLeadTimeExceeded = daysUntilCampaign <= estimatedRequiredDays && daysUntilCampaign > 0;
  const isDeadlineWarningThreshold = daysUntilCampaign <= profile.deadlineWarningDays && daysUntilCampaign > 0;
  const isOverdue = daysUntilCampaign <= 0 && !allInstalled;

  if (isOverdue) {
    return {
      riskLevel: 'HIGH',
      daysUntilCampaign,
      estimatedRequiredDays,
      isAtRisk: true,
      reason: `Termín zahájení kampaně (${campaign.dateFrom.toISOString().slice(0, 10)}) již vypršel nebo nastal dnes, ale instalace není hotova!`,
    };
  }

  if (isLeadTimeExceeded || (isDeadlineWarningThreshold && hasPendingPrint)) {
    return {
      riskLevel: 'HIGH',
      daysUntilCampaign,
      estimatedRequiredDays,
      isAtRisk: true,
      reason: `Do zahájení kampaně zbývá ${daysUntilCampaign} dní, ale potřebná doba realizace je odhadnuta na ${estimatedRequiredDays} dní (výroba: ${requiredProductionDays}d, instalace: ${requiredInstallationDays}d).`,
    };
  }

  if (isDeadlineWarningThreshold) {
    return {
      riskLevel: 'MEDIUM',
      daysUntilCampaign,
      estimatedRequiredDays,
      isAtRisk: true,
      reason: `Kampaň začíná za ${daysUntilCampaign} dní. Zkontrolujte harmonogram montáže.`,
    };
  }

  return {
    riskLevel: 'LOW',
    daysUntilCampaign,
    estimatedRequiredDays,
    isAtRisk: false,
    reason: `Do začátku kampaně zbývá ${daysUntilCampaign} dní. Realizace má dostatečnou časovou rezervu.`,
  };
}

/**
 * Pure deterministic evaluation of Realization Requirements and Blockers.
 * Evaluates the 8 phases and builds blockers with clear distinction between BLOCKING and WARNING.
 */
export function evaluateRealization(
  context: Omit<RealizationContext, 'billingReadiness' | 'requirements' | 'blockers' | 'deadlineRisk' | 'overallPhase'>,
  profile: OrganizationRealizationProfile = { organizationId: context.organizationId, ...DEFAULT_REALIZATION_PROFILE }
): Pick<RealizationContext, 'requirements' | 'blockers' | 'billingReadiness' | 'overallPhase' | 'deadlineRisk'> {
  const requirements: RealizationRequirement[] = [];
  const blockers: RealizationBlocker[] = [];
  const items = context.items || [];
  const printJobs = context.printJobs || [];

  // 1. Graphics Evaluation:
  const hasPrintJobs = printJobs.length > 0;
  const unapprovedJobs = printJobs.filter((pj) => !pj.isApproved);
  const missingArtworkJobs = printJobs.filter((pj) => !pj.artworkUrl);

  if (hasPrintJobs) {
    if (missingArtworkJobs.length > 0) {
      requirements.push({
        id: 'req-graphics-artwork',
        label: 'Grafické podklady k tisku',
        category: 'GRAPHICS',
        status: 'BLOCKED',
        detail: `U ${missingArtworkJobs.length} tiskových položek chybí nahraná grafika.`,
      });
      blockers.push({
        code: 'MISSING_GRAPHICS',
        severity: 'BLOCKING',
        title: 'Chybí grafické podklady',
        message: 'K zakázce nebyly nahrány grafické podklady. Před zahájením tisku je nutné dodat tisková data.',
      });
    } else {
      requirements.push({
        id: 'req-graphics-artwork',
        label: 'Grafické podklady k tisku',
        category: 'GRAPHICS',
        status: 'FULFILLED',
        detail: 'Grafické podklady jsou nahrány.',
      });
    }

    if (profile.requiredGraphicsApproval && unapprovedJobs.length > 0) {
      requirements.push({
        id: 'req-graphics-approval',
        label: 'Schválení grafiky klientem',
        category: 'GRAPHICS',
        status: 'PENDING',
        detail: `Čeká na schválení náhledu klientem (${unapprovedJobs.length} položek).`,
      });
      blockers.push({
        code: 'GRAPHICS_NOT_APPROVED',
        severity: 'BLOCKING',
        title: 'Grafika čeká na schválení',
        message: 'Grafické podklady nebyly schváleny klientem. Tisk nelze zahájit.',
      });
    } else if (hasPrintJobs) {
      requirements.push({
        id: 'req-graphics-approval',
        label: 'Schválení grafiky klientem',
        category: 'GRAPHICS',
        status: 'FULFILLED',
        detail: 'Grafické podklady jsou schváleny.',
      });
    }
  }

  // 2. Production Evaluation:
  const undeliveredPrintJobs = printJobs.filter((pj) => pj.status !== 'DELIVERED_TO_WAREHOUSE');
  if (hasPrintJobs) {
    if (undeliveredPrintJobs.length > 0) {
      requirements.push({
        id: 'req-production-complete',
        label: 'Tisk a výroba materiálů',
        category: 'PRODUCTION',
        status: 'PENDING',
        detail: `Probíhá tisk/výroba (${undeliveredPrintJobs.length} zakázek nedodáno do skladu).`,
      });
      // Production is a dependency blocker for installation
      blockers.push({
        code: 'DEPENDENCY_BLOCKED',
        severity: 'BLOCKING',
        title: 'Výroba není dokončena',
        message: 'Materiály ještě nebyly vytištěny a dodány do skladu. Instalaci nelze provést.',
      });
    } else {
      requirements.push({
        id: 'req-production-complete',
        label: 'Tisk a výroba materiálů',
        category: 'PRODUCTION',
        status: 'FULFILLED',
        detail: 'Všechny materiály byly vyrobeny a dodány do skladu.',
      });
    }
  }

  // 3. Technical Defect / Damage Evaluation (Clarification #8):
  const defectiveItems = items.filter((i) => i.hasDefect);
  for (const def of defectiveItems) {
    blockers.push({
      code: 'SURFACE_TECHNICAL_ISSUE',
      severity: 'BLOCKING',
      title: 'Technický problém na ploše / nosiči',
      message: `Na nosiči ${def.carrierCode || ''} (plocha ${def.surfaceName || def.id}) byl nahlášen problém: ${def.defectReason || 'poškození'}.`,
      entityId: def.surfaceId || def.id,
      entityType: 'SURFACE',
    });
  }

  // 4. Installation & Worker Assignment Evaluation:
  const uninstalledItems = items.filter((i) => !i.isInstalled);
  const hasOrderAssignedWorker = Boolean(
    context.assignedUserId || (context.tasks && context.tasks.some((t) => t.assignedToName))
  );
  const unassignedItems = items.filter((i) => !i.assignedUserId && !hasOrderAssignedWorker && !i.isInstalled);

  if (unassignedItems.length > 0 && !hasPrintJobs && undeliveredPrintJobs.length === 0) {
    blockers.push({
      code: 'INSTALLATION_NOT_ASSIGNED',
      severity: 'WARNING',
      title: 'Instalace nemá přiřazeného pracovníka',
      message: `${unassignedItems.length} ploch nemá přiřazeného pracovníka nebo montážní tým.`,
    });
  }

  if (uninstalledItems.length > 0) {
    requirements.push({
      id: 'req-installation-complete',
      label: 'Instalace reklamních ploch',
      category: 'INSTALLATION',
      status: 'PENDING',
      detail: `Nainstalováno ${items.length - uninstalledItems.length} z ${items.length} ploch.`,
    });
  } else if (items.length > 0) {
    requirements.push({
      id: 'req-installation-complete',
      label: 'Instalace reklamních ploch',
      category: 'INSTALLATION',
      status: 'FULFILLED',
      detail: 'Všechny plochy jsou nainstalovány.',
    });
  }

  // 5. Photo Documentation Evaluation (Clarification #14 & Scenario N):
  const unphotographedItems = items.filter((i) => !i.isPhotographed);
  if (unphotographedItems.length > 0 && uninstalledItems.length === 0) {
    requirements.push({
      id: 'req-photo-documentation',
      label: 'Fotodokumentace po instalaci',
      category: 'PHOTOS',
      status: 'BLOCKED',
      detail: `Chybí fotodokumentace u ${unphotographedItems.length} ploch.`,
    });
    blockers.push({
      code: 'MISSING_PHOTO_DOCUMENTATION',
      severity: profile.billingRequiresPhotos ? 'BLOCKING' : 'WARNING',
      title: 'Chybí fotodokumentace',
      message: `U ${unphotographedItems.length} instalovaných ploch nebyla nahrána platná fotodokumentace pro klienta.`,
    });
  } else if (unphotographedItems.length === 0 && items.length > 0) {
    requirements.push({
      id: 'req-photo-documentation',
      label: 'Fotodokumentace po instalaci',
      category: 'PHOTOS',
      status: 'FULFILLED',
      detail: 'Fotodokumentace je kompletní pro všechny plochy.',
    });
  }

  // 6. Deadline Risk Evaluation:
  const deadlineRisk = evaluateDeadlineRisk(context.campaign, items, printJobs, profile);
  if (deadlineRisk.isAtRisk && deadlineRisk.riskLevel === 'HIGH') {
    blockers.push({
      code: 'INSTALLATION_DEADLINE_RISK',
      severity: 'WARNING',
      title: 'Ohrožený termín kampaně',
      message: deadlineRisk.reason,
    });
  }

  if (context.hasPendingChangeSet) {
    blockers.push({
      code: 'SCOPE_CHANGE_PENDING',
      severity: 'WARNING',
      title: 'Změna nabídky čeká na posouzení',
      message: 'K zakázce byl evidován změnový balíček z nabídky po zahájení realizace. Posuďte změnu před pokračováním.',
      entityType: 'ORDER',
      entityId: context.orderId,
    });
  }

  // 7. Billing Readiness Evaluation:
  const billingReadiness = evaluateBillingReadiness(context, profile);
  if (!billingReadiness.isReady && items.length > 0 && uninstalledItems.length === 0) {
    requirements.push({
      id: 'req-billing-ready',
      label: 'Připravenost k fakturaci',
      category: 'BILLING',
      status: 'BLOCKED',
      detail: billingReadiness.explanation,
    });
  } else if (billingReadiness.isReady) {
    requirements.push({
      id: 'req-billing-ready',
      label: 'Připravenost k fakturaci',
      category: 'BILLING',
      status: 'FULFILLED',
      detail: 'Zakázka splnila všechny podmínky pro vystavení faktury.',
    });
  }

  // 8. Overall Phase Derivation:
  let overallPhase: RealizationPhase = 'PREPARATION';
  if (context.projectType === 'NAVIGATION') {
    overallPhase = mapNavigationOrderStatusToPhase(String(context.status));
  } else {
    if (context.status === 'COMPLETED') {
      overallPhase = 'COMPLETED';
    } else if (billingReadiness.isReady) {
      overallPhase = 'READY_FOR_BILLING';
    } else if (uninstalledItems.length === 0 && unphotographedItems.length > 0) {
      overallPhase = 'PHOTO_DOCUMENTATION';
    } else if (hasPrintJobs && undeliveredPrintJobs.length === 0) {
      overallPhase = 'INSTALLATION';
    } else if (hasPrintJobs && unapprovedJobs.length === 0) {
      overallPhase = 'PRODUCTION';
    } else if (hasPrintJobs && missingArtworkJobs.length === 0) {
      overallPhase = 'GRAPHICS';
    } else {
      overallPhase = 'PREPARATION';
    }
  }

  return {
    requirements,
    blockers,
    billingReadiness,
    overallPhase,
    deadlineRisk,
  };
}

/**
 * Pure deterministic Next Best Action recommender.
 */
export function determineRealizationNextBestActions(
  context: RealizationContext
): RealizationNextBestAction[] {
  const actions: RealizationNextBestAction[] = [];
  const orderId = context.orderId;
  const blockers = context.blockers || [];

  // Prioritize blockers:
  const missingGraphicsBlocker = blockers.find((b) => b.code === 'MISSING_GRAPHICS');
  if (missingGraphicsBlocker) {
    actions.push({
      id: `nba-${orderId}-graphics-request`,
      actionType: 'REQUEST_GRAPHICS',
      priority: 'URGENT',
      title: 'Vyžádat tiskové podklady',
      description: 'Zakázka čeká na dodání tiskových dat od klienta nebo grafika.',
      targetOrderId: orderId,
      targetUrl: `/crm/orders/${orderId}`,
      recommendedAt: new Date(),
    });
    return actions;
  }

  const unapprovedGraphicsBlocker = blockers.find((b) => b.code === 'GRAPHICS_NOT_APPROVED');
  if (unapprovedGraphicsBlocker) {
    actions.push({
      id: `nba-${orderId}-graphics-approve`,
      actionType: 'APPROVE_GRAPHICS',
      priority: 'HIGH',
      title: 'Potvrdit schválení grafiky',
      description: 'Zajistěte potvrzení náhledu klientem pro uvolnění tiskových dat do výroby.',
      targetOrderId: orderId,
      targetUrl: `/crm/orders/${orderId}`,
      recommendedAt: new Date(),
    });
    return actions;
  }

  const defectBlocker = blockers.find((b) => b.code === 'SURFACE_TECHNICAL_ISSUE');
  if (defectBlocker) {
    actions.push({
      id: `nba-${orderId}-resolve-defect`,
      actionType: 'RESOLVE_BLOCKER',
      priority: 'URGENT',
      title: 'Vyřešit technický problém nosiče',
      description: defectBlocker.message,
      targetOrderId: orderId,
      targetSurfaceId: defectBlocker.entityId,
      targetUrl: `/carriers/${defectBlocker.entityId || ''}`,
      recommendedAt: new Date(),
    });
    return actions;
  }

  const scopeChangeBlocker = blockers.find((b) => b.code === 'SCOPE_CHANGE_PENDING');
  if (scopeChangeBlocker) {
    actions.push({
      id: `nba-${orderId}-review-changeset`,
      actionType: 'RESOLVE_BLOCKER',
      priority: 'HIGH',
      title: 'Posoudit změnu rozsahu nabídky',
      description: scopeChangeBlocker.message,
      targetOrderId: orderId,
      targetUrl: `/crm/orders/${orderId}`,
      recommendedAt: new Date(),
    });
  }

  const productionBlocker = blockers.find((b) => b.code === 'DEPENDENCY_BLOCKED' && b.title.includes('Výroba'));
  if (productionBlocker) {
    actions.push({
      id: `nba-${orderId}-start-production`,
      actionType: 'START_PRODUCTION',
      priority: 'HIGH',
      title: 'Ověřit průběh výroby / tisku',
      description: 'Výroba materiálů probíhá. Ověřte termín doručení na sklad.',
      targetOrderId: orderId,
      targetUrl: `/production`,
      recommendedAt: new Date(),
    });
    return actions;
  }

  const unassignedBlocker = blockers.find((b) => b.code === 'INSTALLATION_NOT_ASSIGNED');
  if (unassignedBlocker) {
    actions.push({
      id: `nba-${orderId}-assign-installation`,
      actionType: 'ASSIGN_INSTALLATION',
      priority: 'HIGH',
      title: 'Přiřadit pracovníka k instalaci',
      description: 'Naplánujte montážní tým pro realizaci ploch v terénu.',
      targetOrderId: orderId,
      targetUrl: `/work`,
      recommendedAt: new Date(),
    });
    return actions;
  }

  const missingPhotosBlocker = blockers.find((b) => b.code === 'MISSING_PHOTO_DOCUMENTATION');
  if (missingPhotosBlocker) {
    actions.push({
      id: `nba-${orderId}-upload-photos`,
      actionType: 'UPLOAD_PHOTOS',
      priority: 'HIGH',
      title: 'Doplnit fotodokumentaci z terénu',
      description: 'Plochy jsou nainstalovány. Nahrajte kontrolní fotografie pro schválení a fakturaci.',
      targetOrderId: orderId,
      targetUrl: `/realization/${orderId}`,
      recommendedAt: new Date(),
    });
    return actions;
  }

  // If ready for billing:
  if (context.billingReadiness.isReady) {
    actions.push({
      id: `nba-${orderId}-ready-billing`,
      actionType: 'READY_FOR_BILLING',
      priority: 'MEDIUM',
      title: 'Předat zakázku k fakturaci',
      description: 'Všechny podmínky realizace jsou splněny. Vystavte klientovi fakturu.',
      targetOrderId: orderId,
      targetUrl: `/invoices/new?orderId=${orderId}`,
      recommendedAt: new Date(),
    });
    return actions;
  }

  // In progress installation:
  const hasUninstalled = context.items.some((i) => !i.isInstalled);
  if (hasUninstalled) {
    actions.push({
      id: `nba-${orderId}-complete-installation`,
      actionType: 'COMPLETE_INSTALLATION',
      priority: 'MEDIUM',
      title: 'Dokončit instalaci zbývajících ploch',
      description: 'Sledujte průběh montáže v terénu.',
      targetOrderId: orderId,
      targetUrl: `/work/route`,
      recommendedAt: new Date(),
    });
    return actions;
  }

  return actions;
}

/**
 * Builds the canonical RealizationContext by querying database entities with tenant isolation.
 * Contains NO mutating side effects.
 */
export async function buildRealizationContext(
  orderIdOrOfferId: string,
  currentUser: CurrentUser,
  profile?: OrganizationRealizationProfile
): Promise<RealizationContext | null> {
  const organizationId = currentUser.organizationId;
  if (!organizationId) {
    throw new Error('Tenant security violation: Missing organization context.');
  }

  return runWithTenantContext({ organizationId, userId: currentUser.id, source: 'session' }, async () => {
    // 1. Locate CrmOrder by id or offerId
    const crmOrder = await prisma.crmOrder.findFirst({
      where: {
        organizationId,
        OR: [{ id: orderIdOrOfferId }, { offerId: orderIdOrOfferId }],
      },
      include: {
        client: {
          select: { id: true, name: true, contactPerson: true, email: true, phone: true },
        },
        assignedUser: { select: { id: true, name: true } },
        offer: {
          select: {
            id: true,
            title: true,
            status: true,
            acceptedAt: true,
            createdByUser: { select: { id: true, name: true } },
          },
        },
        realizations: {
          include: {
            surface: { include: { carrier: true } },
            carrier: true,
            photos: true,
          },
        },
        navigationOrder: {
          include: {
            changeSets: {
              where: { status: 'PENDING' },
            },
            installerUser: { select: { id: true, name: true } },
            points: {
              include: {
                installedPhoto: true,
                sitePhoto: true,
                carrier: { select: { id: true, code: true, city: true, address: true } },
                surface: { select: { id: true, name: true } },
              },
            },
          },
        },
        workOrders: {
          select: {
            id: true,
            title: true,
            status: true,
            scheduledAt: true,
            assignments: { select: { userId: true, workerName: true } },
          },
        },
      },
    });

    if (!crmOrder) return null;

    // 2. Fetch associated PrintProductionJobs
    const printJobsRaw = crmOrder.offerId
      ? await prisma.printProductionJob.findMany({
          where: { organizationId, offerId: crmOrder.offerId },
        })
      : [];

    const printJobs: RealizationPrintJobContext[] = printJobsRaw.map((pj) => ({
      id: pj.id,
      title: pj.title,
      status: pj.status,
      formatType: pj.formatType,
      materialType: pj.materialType,
      quantity: pj.quantity,
      artworkUrl: pj.artworkUrl || undefined,
      isApproved: Boolean(pj.clientApprovedAt),
      approvedAt: pj.clientApprovedAt || undefined,
      approvedBy: pj.clientApprovedBy || undefined,
      deliveredAt: pj.deliveredAt || undefined,
      deliveryDeadline: pj.deliveryDeadline || undefined,
    }));

    // 3. Map Items using dedicated adapter (Navigation vs Standard Media)
    let items: RealizationItemContext[] = [];
    if (crmOrder.navigationOrder) {
      const fallbackWorker =
        crmOrder.navigationOrder.installerUserId ||
        crmOrder.assignedUserId ||
        crmOrder.workOrders?.[0]?.assignments?.[0]?.userId ||
        null;
      items = adaptNavigationPointsToRealizationItems(
        crmOrder.navigationOrder as NavigationOrderWithPoints,
        fallbackWorker
      );
    } else {
      items = adaptStandardMediaRealizationItems(
        crmOrder.realizations as CrmRealizationWithRelations[],
        crmOrder.dateFrom,
        crmOrder.createdAt
      );
    }

    // 4. Map Tasks
    const tasks: RealizationTaskContext[] = (crmOrder.workOrders || []).map((wo) => ({
      id: wo.id,
      title: wo.title,
      status: wo.status,
      dueDate: wo.scheduledAt,
      assignedToName: wo.assignments[0]?.workerName,
    }));

    // 5. Map Photos
    const allPhotos: RealizationPhotoContext[] = items.flatMap((i) => i.photos);

    // 6. Campaign dates
    const dateFrom = crmOrder.dateFrom || undefined;
    const dateTo = crmOrder.dateTo || undefined;
    const now = new Date();
    const daysUntilStart = dateFrom
      ? Math.ceil((dateFrom.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;
    const daysUntilEnd = dateTo
      ? Math.ceil((dateTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    const baseContext = {
      organizationId,
      orderId: crmOrder.id,
      orderNumber: crmOrder.orderNumber,
      offerId: crmOrder.offerId || undefined,
      offerTitle: crmOrder.offer?.title,
      offerAcceptedAt: crmOrder.offer?.acceptedAt || undefined,
      offerAcceptedBy: crmOrder.offer?.createdByUser?.name,
      clientId: crmOrder.clientId,
      clientName: crmOrder.client.name,
      clientContactPerson: crmOrder.client.contactPerson || undefined,
      clientContactEmail: crmOrder.client.email || undefined,
      clientContactPhone: crmOrder.client.phone || undefined,
      assignedUserId: crmOrder.assignedUserId || undefined,
      assignedUserName: crmOrder.assignedUser?.name,
      projectType: crmOrder.projectType,
      status: crmOrder.navigationOrder?.status || crmOrder.status,
      campaign: {
        dateFrom,
        dateTo,
        daysUntilStart,
        daysUntilEnd,
      },
      items,
      tasks,
      printJobs,
      photos: allPhotos,
      hasPendingChangeSet: Boolean(crmOrder.navigationOrder?.changeSets && crmOrder.navigationOrder.changeSets.length > 0),
      createdAt: crmOrder.createdAt,
      updatedAt: crmOrder.updatedAt,
    };

    const resolvedProfile = profile || { organizationId, ...DEFAULT_REALIZATION_PROFILE };
    const evaluation = evaluateRealization(baseContext, resolvedProfile);

    return {
      ...baseContext,
      ...evaluation,
    };
  });
}
