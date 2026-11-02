import type { OrderConversationGroup } from './types';
import type { AiInboxListItem } from '@/components/ai-inbox/AiInboxMessageCard';

/**
 * Seskupí e-maily v AI Inboxu podle zakázek a konverzačních vláken.
 * Čistá funkce použitelná na serveru i na klientovi.
 */
export function groupAiInboxMessagesByOrder(items: AiInboxListItem[]): OrderConversationGroup[] {
  const groupsMap = new Map<string, OrderConversationGroup>();

  for (const item of items) {
    let key: string;
    let type: OrderConversationGroup['type'];
    let title: string;
    let orderNumber: string | null = null;
    let status: string | null = null;
    const projectType: string | null = null;
    const client = item.client || null;

    if (item.crmOrder?.id) {
      key = `order-${item.crmOrder.id}`;
      type = 'CRM_ORDER';
      orderNumber = item.crmOrder.orderNumber;
      title = `${item.crmOrder.orderNumber} – ${item.crmOrder.title}`;
      status = item.crmOrder.status;
    } else if (item.navigationOrder?.id) {
      key = `nav-${item.navigationOrder.id}`;
      type = 'NAVIGATION_ORDER';
      orderNumber = item.navigationOrder.orderNumber;
      title = `Navigační zakázka ${item.navigationOrder.orderNumber || ''}`;
      status = item.navigationOrder.status;
    } else if (item.offer?.id) {
      key = `offer-${item.offer.id}`;
      type = 'OFFER';
      title = `Nabídka: ${item.offer.title}`;
      status = item.offer.status;
    } else if (item.providerThreadId) {
      key = `thread-${item.providerThreadId}`;
      type = 'THREAD';
      title = item.subject || 'E-mailové vlákno';
    } else if (item.client?.id) {
      key = `client-${item.client.id}`;
      type = 'CLIENT';
      title = item.client.name;
    } else {
      key = `msg-${item.id}`;
      type = 'UNASSIGNED';
      title = item.fromName || item.fromEmail || item.subject;
    }

    let group = groupsMap.get(key);
    if (!group) {
      group = {
        key,
        type,
        title,
        orderNumber,
        status,
        projectType,
        client,
        items: [],
        messageCount: 0,
        attentionCount: 0,
        newCount: 0,
        hasNewIncoming: false,
        latestReceivedAt: item.receivedAt,
        latestAiSummary: item.aiSummary,
        participants: [],
      };
      groupsMap.set(key, group);
    }

    group.items.push(item);
    group.messageCount += 1;

    const isAttention =
      item.requiresReview &&
      item.processingStatus !== 'PROCESSED' &&
      item.processingStatus !== 'IGNORED' &&
      item.classification !== 'SPAM_IRRELEVANT';
    if (isAttention) {
      group.attentionCount += 1;
    }

    const isNew =
      (item.processingStatus === 'INGESTED' || item.processingStatus === 'READY') &&
      item.classification !== 'SPAM_IRRELEVANT';
    if (isNew) {
      group.newCount += 1;
      group.hasNewIncoming = true;
    }

    if (new Date(item.receivedAt) > new Date(group.latestReceivedAt)) {
      group.latestReceivedAt = item.receivedAt;
      group.latestAiSummary = item.aiSummary || group.latestAiSummary;
    }

    const senderName = item.fromName || item.fromEmail;
    if (!group.participants.some((p) => p.email === item.fromEmail || p.name === senderName)) {
      group.participants.push({
        name: senderName,
        email: item.fromEmail,
        isTeam: item.fromEmail.toLowerCase().includes('@seepoint.cz'),
      });
    }
  }

  // Řazení: skupiny vyžadující pozornost nebo s novými zprávami nahoře, následně podle času poslední zprávy
  const groups = Array.from(groupsMap.values());
  groups.sort((a, b) => {
    if (a.attentionCount !== b.attentionCount) {
      return b.attentionCount - a.attentionCount;
    }
    if (a.newCount !== b.newCount) {
      return b.newCount - a.newCount;
    }
    return new Date(b.latestReceivedAt).getTime() - new Date(a.latestReceivedAt).getTime();
  });

  return groups;
}
