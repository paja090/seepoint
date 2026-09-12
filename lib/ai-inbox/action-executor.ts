import { prisma } from '@/lib/db';
import { createClient, type CreateClientInput } from '@/lib/crm/client-service';
import { nextCrmOrderNumber } from '@/lib/crm/domain';
import { transitionOffer } from '@/lib/offers/service';
import { validateStatusTransition } from '@/lib/navigation/workflow-service';
import type { CurrentUser } from '@/lib/rbac';
import type { NavigationOrderStatus } from '@prisma/client';

export type ActionExecutionResult = {
  actionId: string;
  success: boolean;
  message?: string;
  createdEntityId?: string;
};

export async function executeAiInboxAction(
  organizationId: string,
  actionId: string,
  actor: CurrentUser
): Promise<ActionExecutionResult> {
  const action = await prisma.aiInboxAction.findFirst({
    where: { id: actionId, organizationId },
    include: { message: { include: { attachments: true } } },
  });

  if (!action) {
    throw new Error('Navrhovaná akce nebyla nalezena.');
  }

  if (action.status === 'EXECUTED') {
    return { actionId, success: true, message: 'Tato akce již byla dříve úspěšně provedena.' };
  }

  const payload = (action.payload && typeof action.payload === 'object' ? action.payload : {}) as Record<string, unknown>;
  const msg = action.message;

  try {
    let createdEntityId: string | undefined;

    switch (action.type) {
      case 'CREATE_CLIENT': {
        const clientInput: CreateClientInput = {
          name: String(payload.name || msg.fromName || 'Nový klient'),
          tradingName: payload.tradingName ? String(payload.tradingName) : null,
          companyId: payload.companyId ? String(payload.companyId) : null,
          dic: payload.dic ? String(payload.dic) : null,
          billingStreet: payload.billingStreet ? String(payload.billingStreet) : null,
          billingCity: payload.billingCity ? String(payload.billingCity) : null,
          email: payload.email ? String(payload.email) : msg.fromEmail,
          phone: payload.phone ? String(payload.phone) : null,
          contactPerson: payload.contactPerson ? String(payload.contactPerson) : msg.fromName || null,
        };

        const client = await createClient(clientInput, actor.id, actor.email, organizationId);
        createdEntityId = client.id;

        await prisma.aiInboxMessage.update({
          where: { id: msg.id },
          data: { clientId: client.id },
        });
        break;
      }

      case 'LINK_CLIENT': {
        const clientId = String(payload.clientId || '');
        if (!clientId) throw new Error('Chybí ID klienta k propojení.');

        await prisma.aiInboxMessage.update({
          where: { id: msg.id },
          data: { clientId },
        });
        createdEntityId = clientId;
        break;
      }

      case 'CREATE_CRM_ORDER': {
        const clientId = msg.clientId || String(payload.clientId || '');
        if (!clientId) throw new Error('Před vytvořením zakázky je potřeba nejprve vybrat nebo založit klienta.');

        const year = new Date().getFullYear();
        const latestOrder = await prisma.crmOrder.findFirst({
          where: { organizationId, orderNumber: { startsWith: `ZAK-${year}-` } },
          select: { orderNumber: true },
          orderBy: { orderNumber: 'desc' },
        });
        const orderNumber = nextCrmOrderNumber(year, latestOrder?.orderNumber);

        const newOrder = await prisma.crmOrder.create({
          data: {
            organizationId,
            orderNumber,
            clientId,
            assignedUserId: actor.id,
            title: String(payload.title || `Zakázka: ${msg.subject}`),
            projectType: 'NAVIGATION',
            status: 'DRAFT',
            note: `Vytvořeno z AI Inboxu (E-mail od ${msg.fromEmail})`,
          },
        });
        createdEntityId = newOrder.id;

        await prisma.aiInboxMessage.update({
          where: { id: msg.id },
          data: { crmOrderId: newOrder.id },
        });
        break;
      }

      case 'CREATE_NAVIGATION_ORDER': {
        const clientId = msg.clientId || String(payload.clientId || '');
        if (!clientId) throw new Error('Před založením navigace je nutné vybrat nebo vytvořit klienta.');

        let crmOrderId = msg.crmOrderId;
        if (!crmOrderId) {
          const year = new Date().getFullYear();
          const latestOrder = await prisma.crmOrder.findFirst({
            where: { organizationId, orderNumber: { startsWith: `ZAK-${year}-` } },
            select: { orderNumber: true },
            orderBy: { orderNumber: 'desc' },
          });
          const orderNumber = nextCrmOrderNumber(year, latestOrder?.orderNumber);

          const crmOrder = await prisma.crmOrder.create({
            data: {
              organizationId,
              orderNumber,
              clientId,
              assignedUserId: actor.id,
              title: String(payload.title || `Navigace: ${msg.subject}`),
              projectType: 'NAVIGATION',
              status: 'DRAFT',
              note: `Vytvořeno z AI Inboxu (E-mail od ${msg.fromEmail})`,
            },
          });
          crmOrderId = crmOrder.id;
          await prisma.aiInboxMessage.update({
            where: { id: msg.id },
            data: { crmOrderId },
          });
        }

        const navOrder = await prisma.navigationOrder.create({
          data: {
            organizationId,
            crmOrderId,
            targetName: String(payload.targetName || payload.title || msg.subject || 'Nový navigační projekt'),
            targetAddress: payload.targetAddress ? String(payload.targetAddress) : null,
            targetLatitude: typeof payload.latitude === 'number' ? payload.latitude : 0,
            targetLongitude: typeof payload.longitude === 'number' ? payload.longitude : 0,
            targetNote: String(payload.title || `Navigace: ${msg.subject}`),
            status: 'POPTAVKA',
          },
        });
        createdEntityId = navOrder.id;

        await prisma.aiInboxMessage.update({
          where: { id: msg.id },
          data: { navigationOrderId: navOrder.id },
        });
        break;
      }

      case 'ACCEPT_OFFER': {
        const offerId = msg.offerId || String(payload.offerId || '');
        if (!offerId) throw new Error('Nebyla nalezena nabídka ke schválení.');

        await transitionOffer(actor, offerId, 'ACCEPTED');
        createdEntityId = offerId;
        break;
      }

      case 'CHANGE_NAVIGATION_STATUS': {
        const navigationOrderId = msg.navigationOrderId || String(payload.navigationOrderId || '');
        const targetStatus = String(payload.targetStatus || '') as NavigationOrderStatus;
        if (!navigationOrderId || !targetStatus) {
          throw new Error('Chybí parametry pro posun navigační zakázky.');
        }

        await validateStatusTransition(navigationOrderId, targetStatus);
        await prisma.navigationOrder.update({
          where: { id: navigationOrderId },
          data: { status: targetStatus },
        });
        createdEntityId = navigationOrderId;
        break;
      }

      case 'CREATE_TASK': {
        const clientId = msg.clientId || String(payload.clientId || '');
        if (!clientId) throw new Error('K úkolu je potřeba nejprve přiřadit klienta.');

        const task = await prisma.crmTask.create({
          data: {
            organizationId,
            clientId,
            crmOrderId: msg.crmOrderId || null,
            assignedUserId: actor.id,
            createdUserId: actor.id,
            title: String(payload.title || 'Úkol z AI Inboxu'),
            description: payload.description ? String(payload.description) : null,
            priority: (payload.priority as 'HIGH' | 'NORMAL' | 'URGENT') || 'HIGH',
            status: 'TODO',
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // +24h
            type: 'OTHER',
          },
        });
        createdEntityId = task.id;
        break;
      }

      case 'CREATE_COMMUNICATION': {
        const clientId = msg.clientId || String(payload.clientId || '');
        if (!clientId) throw new Error('Pro zapsání do komunikace je nutné vybrat klienta.');

        await prisma.clientCommunication.create({
          data: {
            organizationId,
            clientId,
            contactId: msg.contactId || null,
            crmOrderId: msg.crmOrderId || null,
            authorUserId: actor.id,
            type: 'EMAIL',
            subject: String(payload.subject || msg.subject),
            content: String(payload.content || msg.textBody || msg.aiSummary || 'Příchozí e-mail z AI Inboxu'),
            isInternal: false,
          },
        });
        break;
      }

      case 'STORE_DOCUMENT': {
        const clientId = msg.clientId || String(payload.clientId || '');
        if (!clientId) throw new Error('Pro uložení dokumentů je nutné vybrat klienta.');

        for (const att of msg.attachments) {
          if (att.clientDocumentId) continue;
          const doc = await prisma.clientDocument.create({
            data: {
              organizationId,
              clientId,
              crmOrderId: msg.crmOrderId || null,
              uploaderUserId: actor.id,
              name: att.filename,
              type: att.classification === 'LOGO' ? 'LOGO' : 'ARTWORK',
              fileName: att.filename,
              mimeType: att.mimeType,
              size: att.size,
              fileUrl: att.fileUrl,
            },
          });
          await prisma.aiInboxAttachment.update({
            where: { id: att.id },
            data: { clientDocumentId: doc.id },
          });
        }
        break;
      }

      default:
        break;
    }

    await prisma.aiInboxAction.update({
      where: { id: action.id },
      data: {
        status: 'EXECUTED',
        executedAt: new Date(),
        executedById: actor.id,
        errorMessage: null,
      },
    });

    // Zkontrolovat, zda zbývají nevyřízené akce; pokud ne, označit zprávu jako PROCESSED
    const remainingProposed = await prisma.aiInboxAction.count({
      where: {
        messageId: msg.id,
        status: 'PROPOSED',
      },
    });

    if (remainingProposed === 0) {
      await prisma.aiInboxMessage.update({
        where: { id: msg.id },
        data: {
          processingStatus: 'PROCESSED',
          requiresReview: false,
          reviewedAt: new Date(),
          reviewedById: actor.id,
        },
      });
    }

    return {
      actionId,
      success: true,
      createdEntityId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Neznámá chyba při provádění akce';
    await prisma.aiInboxAction.update({
      where: { id: action.id },
      data: {
        status: 'FAILED',
        errorMessage: errorMsg,
      },
    }).catch(() => null);

    throw error;
  }
}

export async function rejectAiInboxAction(
  organizationId: string,
  actionId: string,
  actor: CurrentUser
): Promise<void> {
  const action = await prisma.aiInboxAction.findFirst({
    where: { id: actionId, organizationId },
  });

  if (!action) throw new Error('Akce nebyla nalezena.');

  await prisma.aiInboxAction.update({
    where: { id: action.id },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectedById: actor.id,
    },
  });
}
