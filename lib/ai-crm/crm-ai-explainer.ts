/**
 * AI CRM Intelligence — Explainable AI Summary Service
 *
 * Generates transparent natural language explanations based SOLELY
 * on facts already established in the database.
 *
 * Fully resilient with 100% deterministic fallback when AI provider is unavailable.
 */

import { getGeminiApiKey } from '@/lib/ai-gemini';
import { logAIUsage, estimateGeminiFlashCostUsd } from '@/lib/ai-usage';
import type { Client360Data } from './contracts/types';

/**
 * Builds a natural-language CRM summary for a client.
 * Falls back safely to deterministic template if AI provider fails or is not configured.
 */
export async function generateClientAiExplanation(
  data: Client360Data,
  userId?: string
): Promise<string> {
  const apiKey = getGeminiApiKey();

  // If no Gemini key is set, use deterministic template immediately
  if (!apiKey || apiKey.startsWith('sk-')) {
    return generateDeterministicTemplateExplanation(data);
  }

  const prompt = buildExplanationPrompt(data);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 300,
          },
        }),
      }
    );

    if (!res.ok) {
      return generateDeterministicTemplateExplanation(data);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (text) {
      const promptTokens = json.usageMetadata?.promptTokenCount || 250;
      const outputTokens = json.usageMetadata?.candidatesTokenCount || 60;
      const costEstimateUsd = estimateGeminiFlashCostUsd({ promptTokens, outputTokens });

      await logAIUsage({
        organizationId: data.identity.organizationId,
        userId: userId || null,
        feature: 'ASSISTANT',
        modelName: 'gemini-2.5-flash',
        promptTokens,
        outputTokens,
        costEstimateUsd,
        metadata: {
          source: 'CRM_INTELLIGENCE',
          clientId: data.identity.id,
        },
      }).catch(() => null);

      return text;
    }

    return generateDeterministicTemplateExplanation(data);
  } catch {
    return generateDeterministicTemplateExplanation(data);
  }
}

/**
 * Clean, transparent deterministic explanation without LLM.
 */
export function generateDeterministicTemplateExplanation(data: Client360Data): string {
  const parts: string[] = [];
  const name = data.identity.name;

  // 1. Business summary
  if (data.business.activeOffersCount > 0) {
    parts.push(
      `${name} má aktuálně ${data.business.activeOffersCount} aktivní ${
        data.business.activeOffersCount === 1 ? 'nabídku' : 'nabídky'
      } v celkové hodnotě ${data.business.activeOffersValueCz.toLocaleString('cs-CZ')} Kč.`
    );
  } else if (data.campaigns.activeCampaigns.length > 0) {
    parts.push(
      `${name} má v běhu ${data.campaigns.activeCampaigns.length} ${
        data.campaigns.activeCampaigns.length === 1 ? 'kampaň' : 'kampaně'
      }.`
    );
  } else {
    parts.push(`U klienta ${name} v současnosti neevidujeme žádné otevřené nabídky ani běžící kampaně.`);
  }

  // 2. Risks or Attention points
  if (data.realization.blockedCount > 0) {
    parts.push(
      `Pozor: ${data.realization.blockedCount} realizací má hlášený blocker nebo čeká na podklady.`
    );
  }

  if (data.finance.overdueInvoicesCount > 0) {
    parts.push(
      `Upozornění na finance: ${data.finance.overdueInvoicesCount} faktur po splatnosti (${data.finance.overdueTotalCz.toLocaleString('cs-CZ')} Kč).`
    );
  }

  const expiringCampaign = data.campaigns.activeCampaigns.find((c) => c.daysRemaining <= 30);
  if (expiringCampaign) {
    parts.push(
      `Plocha v lokalitě ${expiringCampaign.carrierCity || 'kampaně'} končí za ${expiringCampaign.daysRemaining} dní (příležitost pro renewal).`
    );
  }

  // 3. Recommended action
  const topAction = data.intelligence.nextBestActions[0];
  if (topAction) {
    parts.push(`Doporučený další krok: ${topAction.title}.`);
  }

  return parts.join(' ');
}

function buildExplanationPrompt(data: Client360Data): string {
  return `Jsi AI analytik obchodního systému SeePoint OS. Shrň stav klienta pro obchodníka do 2-3 stručných českých vět na základě NÍŽE UVEDENÝCH FAKTŮ Z DATABÁZE. Nevymýšlej si žádné informace, které nejsou uvedeny.

FAKTA Z DATABÁZE:
- Klient: ${data.identity.name} (${data.identity.clientType}, segment: ${data.identity.pricingSegment})
- Stav vztahu: ${data.intelligence.relationship.status} (skóre: ${data.intelligence.relationship.healthScore}/100)
- Otevřené nabídky: ${data.business.activeOffersCount} (hodnota: ${data.business.activeOffersValueCz} Kč)
- Aktivní kampaně: ${data.campaigns.activeCampaigns.length} (blízko konce: ${data.campaigns.expiringIn30DaysCount})
- Blokované realizace: ${data.realization.blockedCount}
- Faktury po splatnosti: ${data.finance.overdueInvoicesCount} (${data.finance.overdueTotalCz} Kč)
- Dnů od posledního kontaktu: ${data.intelligence.relationship.daysSinceLastContact ?? 'neznámo'}
- Doporučený krok (Next Best Action): ${data.intelligence.nextBestActions[0]?.title || 'Bez urgentní akce'}

Požadavek: Napiš věcný, profesionální souhrn pro obchodníka, který vysvětluje, čemu má věnovat pozornost.`;
}
