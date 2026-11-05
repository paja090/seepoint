import type { OrderConversationGroup } from './types';
import type { AiInboxListItem } from '@/components/ai-inbox/AiInboxMessageCard';
import {
  calculateAiInboxImportance,
  sortAiInboxItems,
  PRIORITY_TIER_META,
  type AiInboxSortOption,
  type AiInboxPriorityTier,
} from './importance';

/**
 * Seskupí e-maily v AI Inboxu podle zakázek a konverzačních vláken.
 * Řadí skupiny i zprávy uvnitř skupin podle zvoleného režimu řazení.
 */
export function groupAiInboxMessagesByOrder(
  items: AiInboxListItem[],
  sortOption: AiInboxSortOption = 'IMPORTANCE_AND_TIME'
): OrderConversationGroup[] {
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
      orderNumber = item.navigationOrder.orderNumber || null;
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
        priorityTier: 'NORMAL',
        maxImportanceScore: 0,
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

  // Vyhodnocení prioritního pásma a seřazení zpráv uvnitř každé skupiny
  const groups = Array.from(groupsMap.values());
  for (const group of groups) {
    // Seřadit zprávy uvnitř skupiny dle zvoleného řazení
    group.items = sortAiInboxItems(group.items, sortOption);

    // Zjistit nejvyšší prioritní pásmo a skóre uvnitř skupiny
    let highestTier: AiInboxPriorityTier = 'LOW';
    let maxScore = -999;

    for (const item of group.items) {
      const evaluation = calculateAiInboxImportance(item);
      if (evaluation.score > maxScore) {
        maxScore = evaluation.score;
      }
      const currentOrder = PRIORITY_TIER_META[evaluation.tier]?.order ?? 0;
      const highestOrder = PRIORITY_TIER_META[highestTier]?.order ?? 0;
      if (currentOrder > highestOrder) {
        highestTier = evaluation.tier;
      }
    }

    group.priorityTier = highestTier;
    group.maxImportanceScore = maxScore;
  }

  // Řazení skupin podle zvoleného kritéria
  groups.sort((a, b) => {
    if (sortOption === 'NEWEST') {
      return new Date(b.latestReceivedAt).getTime() - new Date(a.latestReceivedAt).getTime();
    }

    if (sortOption === 'OLDEST') {
      return new Date(a.latestReceivedAt).getTime() - new Date(b.latestReceivedAt).getTime();
    }

    if (sortOption === 'IMPORTANCE_ONLY') {
      const scoreDiff = (b.maxImportanceScore ?? 0) - (a.maxImportanceScore ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.latestReceivedAt).getTime() - new Date(a.latestReceivedAt).getTime();
    }

    // Výchozí režim: IMPORTANCE_AND_TIME
    // 1. Prioritní pásmo skupiny (URGENT > HIGH > NORMAL > LOW > SPAM)
    const tierOrderA = PRIORITY_TIER_META[a.priorityTier ?? 'NORMAL']?.order ?? 0;
    const tierOrderB = PRIORITY_TIER_META[b.priorityTier ?? 'NORMAL']?.order ?? 0;
    if (tierOrderA !== tierOrderB) {
      return tierOrderB - tierOrderA;
    }

    // 2. Počet zpráv vyžadujících pozornost
    if (a.attentionCount !== b.attentionCount) {
      return b.attentionCount - a.attentionCount;
    }

    // 3. Počet nových zpráv
    if (a.newCount !== b.newCount) {
      return b.newCount - a.newCount;
    }

    // 4. Čas poslední zprávy (novější nahoře)
    return new Date(b.latestReceivedAt).getTime() - new Date(a.latestReceivedAt).getTime();
  });

  return groups;
}
