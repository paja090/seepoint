import type { CurrentUser } from '@/lib/rbac';
import { getGeminiApiKey } from '@/lib/ai-gemini';
import { logAIUsage } from '@/lib/ai-usage';
import type { RealizationContext } from './contracts/realization-context';
import type {
  RealizationInsight,
  RealizationInsightType,
  RealizationInsightSeverity,
} from './contracts/realization-insight';

/**
 * Builds deterministic insights from the RealizationContext blockers and requirements.
 */
export function buildDeterministicRealizationInsights(
  context: RealizationContext
): RealizationInsight[] {
  const insights: RealizationInsight[] = [];
  const orderId = context.orderId;
  const now = new Date();

  for (const b of context.blockers) {
    let type: RealizationInsightType = 'DEPENDENCY_BLOCKED';
    let severity: RealizationInsightSeverity = b.severity === 'BLOCKING' ? 'HIGH' : 'MEDIUM';

    switch (b.code) {
      case 'MISSING_GRAPHICS':
        type = 'MISSING_GRAPHICS';
        severity = 'CRITICAL';
        break;
      case 'GRAPHICS_NOT_APPROVED':
        type = 'GRAPHICS_NOT_APPROVED';
        severity = 'HIGH';
        break;
      case 'PRODUCTION_DELAY':
      case 'DEPENDENCY_BLOCKED':
        type = b.code === 'PRODUCTION_DELAY' ? 'PRODUCTION_DELAY' : 'DEPENDENCY_BLOCKED';
        severity = 'HIGH';
        break;
      case 'INSTALLATION_NOT_ASSIGNED':
        type = 'INSTALLATION_NOT_ASSIGNED';
        severity = 'MEDIUM';
        break;
      case 'INSTALLATION_DEADLINE_RISK':
        type = 'INSTALLATION_DEADLINE_RISK';
        severity = 'HIGH';
        break;
      case 'SURFACE_TECHNICAL_ISSUE':
        type = 'SURFACE_TECHNICAL_ISSUE';
        severity = 'CRITICAL';
        break;
      case 'MISSING_PHOTO_DOCUMENTATION':
        type = 'MISSING_PHOTO_DOCUMENTATION';
        severity = b.severity === 'BLOCKING' ? 'HIGH' : 'MEDIUM';
        break;
      case 'INCOMPLETE_INSTALLATION':
        type = 'INCOMPLETE_INSTALLATION';
        severity = 'MEDIUM';
        break;
      case 'BILLING_BLOCKED':
        type = 'BILLING_BLOCKED';
        severity = 'HIGH';
        break;
    }

    insights.push({
      id: `insight-${orderId}-${b.code}-${b.entityId || 'general'}`,
      type,
      severity,
      title: b.title,
      deterministicReason: b.message,
      surfaceId: b.entityId,
      orderId,
      detectedAt: now,
    });
  }

  // If ready for billing:
  if (context.billingReadiness.isReady) {
    insights.push({
      id: `insight-${orderId}-ready-for-billing`,
      type: 'READY_FOR_BILLING',
      severity: 'INFO',
      title: 'Zakázka je připravena k fakturaci',
      deterministicReason: context.billingReadiness.explanation,
      orderId,
      detectedAt: now,
    });
  }

  return insights;
}

/**
 * Generates AI-assisted explanation and summary for a realization order.
 * Strictly uses deterministic fallback if LLM is unavailable or fails.
 */
export async function generateRealizationSummary(
  context: RealizationContext,
  currentUser: CurrentUser
): Promise<{
  summary: string;
  recommendations: string[];
  insights: RealizationInsight[];
  isAiGenerated: boolean;
}> {
  const deterministicInsights = buildDeterministicRealizationInsights(context);

  // Deterministic Czech fallback template
  const fallbackRecommendations = deterministicInsights.map((i) => i.deterministicReason);
  const fallbackSummary = `Zakázka ${context.orderNumber} (${context.clientName}) se nachází ve fázi ${context.overallPhase}. ` +
    (context.billingReadiness.isReady
      ? 'Všechny podmínky a fotodokumentace jsou kompletní, zakázka je připravena k fakturaci.'
      : context.blockers.length > 0
        ? `Aktuálně evidujeme ${context.blockers.length} blokací či upozornění, které vyžadují pozornost obchodníka nebo koordinátora montáží.`
        : 'Realizace probíhá podle plánu.');

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return {
      summary: fallbackSummary,
      recommendations: fallbackRecommendations,
      insights: deterministicInsights,
      isAiGenerated: false,
    };
  }

  try {
    const prompt = `Jsi seniorní provozní a realizační koordinátor pro českou OOH mediální agenturu SeePOINT.
Analyzuj stav realizace zakázky a poskytni věcné, stručné české shrnutí a 2–4 doporučené kroky.

FAKTA ZE SYSTÉMU:
- Zakázka: ${context.orderNumber} (${context.clientName})
- Typ projektu: ${context.projectType}
- Aktuální fáze: ${context.overallPhase}
- Kampaň: ${context.campaign.dateFrom?.toISOString().slice(0, 10) || 'neuvedeno'} až ${context.campaign.dateTo?.toISOString().slice(0, 10) || 'neuvedeno'}
- Počet ploch celkem: ${context.items.length}
- Nainstalováno: ${context.items.filter((i) => i.isInstalled).length}
- S fotodokumentací: ${context.items.filter((i) => i.isPhotographed).length}
- Defekty / poškození: ${context.items.filter((i) => i.hasDefect).length}
- Termínové riziko: ${context.deadlineRisk.reason}
- Připravenost k fakturaci: ${context.billingReadiness.isReady ? 'ANO' : 'NE'} (${context.billingReadiness.explanation})
- Blokace:
${context.blockers.map((b) => `- [${b.severity}] ${b.title}: ${b.message}`).join('\n') || '- Žádné blokace'}

PRAVIDLA:
- NEVYMÝŠLEJ žádné nové skutečnosti, které nejsou uvedeny ve faktech.
- Vrať POUZE validní JSON ve formátu:
{
  "summary": "string (stručné shrnutí stavu pro manažera)",
  "recommendations": ["string (doporučený krok 1)", "string (doporučený krok 2)"]
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, response_mime_type: 'application/json' },
      }),
    });

    if (resp.ok) {
      const data = (await resp.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textContent) {
        const parsed = JSON.parse(textContent) as { summary?: string; recommendations?: string[] };
        if (parsed.summary?.trim() && Array.isArray(parsed.recommendations)) {
          void logAIUsage({
            organizationId: context.organizationId,
            userId: currentUser.id,
            feature: 'ASSISTANT',
            modelName: 'gemini-3.6-flash',
            promptTokens: prompt.length / 4,
            outputTokens: 250,
            costEstimateUsd: 0.0008,
            metadata: { orderId: context.orderId, orderNumber: context.orderNumber },
          });

          return {
            summary: parsed.summary.trim(),
            recommendations: parsed.recommendations,
            insights: deterministicInsights,
            isAiGenerated: true,
          };
        }
      }
    }
  } catch {
    // Fallback on error
  }

  return {
    summary: fallbackSummary,
    recommendations: fallbackRecommendations,
    insights: deterministicInsights,
    isAiGenerated: false,
  };
}
