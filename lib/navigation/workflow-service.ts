import { NavigationOrderStatus, NavigationBlockStatus } from '@prisma/client';
import { prisma } from '../db.ts';

export class NavigationWorkflowError extends Error {
  code: string;

  constructor(message: string, code = 'INVALID_TRANSITION') {
    super(message);
    this.name = 'NavigationWorkflowError';
    this.code = code;
  }
}

export const ALLOWED_STATUS_TRANSITIONS: Record<NavigationOrderStatus, NavigationOrderStatus[]> = {
  POPTAVKA: ['NABIDKA', 'DOKONCENO'],
  NABIDKA: ['POTVRZENO_KLIENTEM', 'POPTAVKA'],
  POTVRZENO_KLIENTEM: ['SMLOUVA_OBJEDNAVKA', 'NABIDKA'],
  SMLOUVA_OBJEDNAVKA: ['GRAFICKE_PODKLADY', 'POTVRZENO_KLIENTEM'],
  GRAFICKE_PODKLADY: ['SCHVALENI_GRAFIKY', 'SMLOUVA_OBJEDNAVKA'],
  SCHVALENI_GRAFIKY: ['TISK_VYROBA', 'GRAFICKE_PODKLADY'],
  TISK_VYROBA: ['PRIPRAVENO_K_INSTALACI', 'SCHVALENI_GRAFIKY'],
  PRIPRAVENO_K_INSTALACI: ['INSTALACE', 'TISK_VYROBA'],
  INSTALACE: ['FOTODOKUMENTACE', 'PRIPRAVENO_K_INSTALACI'],
  FOTODOKUMENTACE: ['PRIPRAVENO_K_FAKTURACI', 'INSTALACE'],
  PRIPRAVENO_K_FAKTURACI: ['FAKTUROVANO', 'FOTODOKUMENTACE'],
  FAKTUROVANO: ['DOKONCENO', 'PRIPRAVENO_K_FAKTURACI'],
  DOKONCENO: [],
};

export async function validateStatusTransition(navigationOrderId: string, targetStatus: NavigationOrderStatus) {
  const navOrder = await prisma.navigationOrder.findUnique({
    where: { id: navigationOrderId },
    include: {
      points: {
        include: { installedPhoto: true },
      },
      crmOrder: {
        include: {
          crmTasks: true,
        },
      },
      billingPeriods: true,
    },
  });

  if (!navOrder) {
    throw new NavigationWorkflowError('Navigační zakázka nebyla nalezena.', 'NOT_FOUND');
  }

  const currentStatus = navOrder.status;
  if (currentStatus === targetStatus) return navOrder;

  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new NavigationWorkflowError(
      `Nelze přejít ze stavu "${currentStatus}" do stavu "${targetStatus}".`,
      'FORBIDDEN_TRANSITION'
    );
  }

  // Fyzický nosič a jeho plocha vznikají až potvrzením realizace bodu.
  // Před montáží je zdrojem pravdy unikátní bod vybraný klientem v nabídce.

  // Restrikce 1: Přechod z INSTALACE do FOTODOKUMENTACE / PRIPRAVENO_K_FAKTURACI vyžaduje nahranou fotografii
  if (['FOTODOKUMENTACE', 'PRIPRAVENO_K_FAKTURACI'].includes(targetStatus)) {
    const missingPhotoPoint = navOrder.points.find((p) => !p.installedPhotoId);
    if (missingPhotoPoint) {
      throw new NavigationWorkflowError(
        `Bod "${missingPhotoPoint.label}" nemá nahranou fotografii po instalaci.`,
        'MISSING_INSTALLATION_PHOTO'
      );
    }
  }

  // Restrikce 2: Fakturováno vyžaduje fakturační období s vygenerovanou fakturou
  if (targetStatus === 'FAKTUROVANO') {
    const hasInvoicedPeriod = navOrder.billingPeriods.some((bp) => bp.invoiceId !== null);
    if (!hasInvoicedPeriod) {
      throw new NavigationWorkflowError(
        'Zakázka nemá žádné vyfakturované období.',
        'MISSING_INVOICE'
      );
    }
  }

  // Restrikce 3: Dokončeno nelze nastavit, pokud existuje otevřený deinstalační úkol
  if (targetStatus === 'DOKONCENO') {
    const pendingDeinstallation = navOrder.crmOrder.crmTasks.find(
      (t) => t.title.toLowerCase().includes('deinstalace') && t.status !== 'DONE' && t.status !== 'CANCELLED'
    );
    if (pendingDeinstallation) {
      throw new NavigationWorkflowError(
        'Zakázku nelze dokončit, dokud probíhá deinstalace.',
        'PENDING_DEINSTALLATION'
      );
    }
  }

  return navOrder;
}

export async function transitionNavigationOrderStatus(
  navigationOrderId: string,
  targetStatus: NavigationOrderStatus,
  actorUserId: string,
  actorName: string
) {
  const navOrder = await validateStatusTransition(navigationOrderId, targetStatus);

  // Derive block status based on new status
  let newBlockStatus: NavigationBlockStatus | null = null;
  switch (targetStatus) {
    case 'POPTAVKA':
      newBlockStatus = 'CEKA_NA_POTVRZENI_NABIDKY';
      break;
    case 'NABIDKA':
      newBlockStatus = 'CEKA_NA_KLIENTA';
      break;
    case 'POTVRZENO_KLIENTEM':
      newBlockStatus = 'CEKA_NA_OBJEDNAVKU';
      break;
    case 'SMLOUVA_OBJEDNAVKA':
      newBlockStatus = 'CEKA_NA_GRAFIKU';
      break;
    case 'GRAFICKE_PODKLADY':
      newBlockStatus = 'CEKA_NA_SCHVALENI_GRAFIKY';
      break;
    case 'SCHVALENI_GRAFIKY':
      newBlockStatus = 'CEKA_NA_TISK';
      break;
    case 'TISK_VYROBA':
      newBlockStatus = 'CEKA_NA_INSTALACI';
      break;
    case 'PRIPRAVENO_K_INSTALACI':
      newBlockStatus = 'CEKA_NA_INSTALACI';
      break;
    case 'INSTALACE':
      newBlockStatus = 'CEKA_NA_FOTOGRAFIE';
      break;
    case 'FOTODOKUMENTACE':
      newBlockStatus = 'CEKA_NA_FAKTURACI';
      break;
    case 'PRIPRAVENO_K_FAKTURACI':
      newBlockStatus = 'CEKA_NA_FAKTURACI';
      break;
    default:
      newBlockStatus = null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedNav = await tx.navigationOrder.update({
      where: { id: navigationOrderId },
      data: {
        status: targetStatus,
        blockStatus: newBlockStatus,
        ...(targetStatus === 'SCHVALENI_GRAFIKY' ? { graphicsApprovedAt: new Date() } : {}),
        ...(targetStatus === 'PRIPRAVENO_K_INSTALACI' ? { productionReadyAt: new Date() } : {}),
        ...(targetStatus === 'FOTODOKUMENTACE' ? { installedAt: new Date() } : {}),
        ...(targetStatus === 'FAKTUROVANO' ? { invoicedAt: new Date() } : {}),
      },
    });

    const crmStatus = targetStatus === 'DOKONCENO'
      ? 'COMPLETED'
      : targetStatus === 'FAKTUROVANO'
        ? 'ACTIVE'
        : ['INSTALACE', 'FOTODOKUMENTACE', 'PRIPRAVENO_K_FAKTURACI'].includes(targetStatus)
          ? 'IN_REALIZATION'
          : ['TISK_VYROBA', 'PRIPRAVENO_K_INSTALACI'].includes(targetStatus)
            ? 'READY_FOR_PRODUCTION'
            : ['GRAFICKE_PODKLADY', 'SCHVALENI_GRAFIKY'].includes(targetStatus)
              ? 'WAITING_FOR_MATERIALS'
              : targetStatus === 'POPTAVKA' || targetStatus === 'NABIDKA'
                ? 'DRAFT'
                : 'CONFIRMED';
    await tx.crmOrder.update({
      where: { id: navOrder.crmOrderId },
      data: { status: crmStatus },
    });

    const contractCompletedStatuses: NavigationOrderStatus[] = [
      'GRAFICKE_PODKLADY', 'SCHVALENI_GRAFIKY', 'TISK_VYROBA', 'PRIPRAVENO_K_INSTALACI',
      'INSTALACE', 'FOTODOKUMENTACE', 'PRIPRAVENO_K_FAKTURACI', 'FAKTUROVANO', 'DOKONCENO',
    ];
    const printCompletedStatuses: NavigationOrderStatus[] = [
      'PRIPRAVENO_K_INSTALACI', 'INSTALACE', 'FOTODOKUMENTACE',
      'PRIPRAVENO_K_FAKTURACI', 'FAKTUROVANO', 'DOKONCENO',
    ];
    const completedTaskTitles: string[] = [];
    if (contractCompletedStatuses.includes(targetStatus)) completedTaskTitles.push('Smlouva / Objednávka');
    if (printCompletedStatuses.includes(targetStatus)) completedTaskTitles.push('Tisk navigačních cedulí');
    if (completedTaskTitles.length > 0) {
      await tx.crmTask.updateMany({
        where: {
          crmOrderId: navOrder.crmOrderId,
          status: { in: ['TODO', 'IN_PROGRESS'] },
          OR: completedTaskTitles.map((title) => ({ title: { contains: title } })),
        },
        data: { status: 'DONE', completedAt: new Date() },
      });
    }

    // Zápis do audit logu
    await tx.crmAuditLog.create({
      data: {
        userId: actorUserId,
        userEmail: actorName,
        action: 'NAVIGATION_ORDER_STATUS_CHANGED',
        entityType: 'NavigationOrder',
        entityId: navigationOrderId,
        detailsJson: JSON.stringify({
          fromStatus: navOrder.status,
          toStatus: targetStatus,
          blockStatus: newBlockStatus,
        }),
      },
    });

    // Automatizace: Zakládání systémových úkolů podle fáze
    if (targetStatus === 'SMLOUVA_OBJEDNAVKA') {
      const existingTask = await tx.crmTask.findFirst({
        where: { crmOrderId: navOrder.crmOrderId, title: { contains: 'Smlouva / Objednávka' } },
      });
      if (!existingTask) {
        await tx.crmTask.create({
          data: {
            clientId: navOrder.crmOrder.clientId,
            crmOrderId: navOrder.crmOrderId,
            assignedUserId: actorUserId,
            createdUserId: actorUserId,
            title: `Smlouva / Objednávka: ${navOrder.targetName}`,
            description: 'Zajistit podepsanou smlouvu nebo závaznou objednávku od klienta.',
            type: 'GET_CONTRACT_SIGNED',
            priority: 'HIGH',
            status: 'TODO',
            dueDate: new Date(Date.now() + 3 * 86400000),
          },
        });
      }
    }

    if (targetStatus === 'TISK_VYROBA') {
      const existingTask = await tx.crmTask.findFirst({
        where: { crmOrderId: navOrder.crmOrderId, title: { contains: 'Tisk navigačních cedulí' } },
      });
      if (!existingTask) {
        await tx.crmTask.create({
          data: {
            clientId: navOrder.crmOrder.clientId,
            crmOrderId: navOrder.crmOrderId,
            assignedUserId: actorUserId,
            createdUserId: actorUserId,
            title: `Tisk navigačních cedulí: ${navOrder.targetName}`,
            description: `Vytisknout ${navOrder.points.length} navigačních cedulí dle schválené grafiky.`,
            type: 'PLAN_REALIZATION',
            priority: 'NORMAL',
            status: 'TODO',
            dueDate: new Date(Date.now() + 3 * 86400000),
          },
        });
      }
    }

    return updatedNav;
  });

  return updated;
}
