import type {
  AiInboxActionType,
  AiInboxAnalysisResult,
  MatchedEntityResult,
} from './types';

export type ProposedActionDraft = {
  type: AiInboxActionType;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  confidence: number;
};

export function buildProposedActions(input: {
  analysis: AiInboxAnalysisResult;
  entities: Partial<MatchedEntityResult>;
  message: {
    id: string;
    fromEmail: string;
    fromName?: string | null;
    subject: string;
    textBody?: string | null;
    hasAttachments: boolean;
  };
}): ProposedActionDraft[] {
  const { analysis, entities, message } = input;
  const actions: ProposedActionDraft[] = [];

  const matchedClient = entities.client || null;
  const companyName = analysis.company?.name || message.fromName || 'Neznámá firma';

  // 1. Klient: Založit nebo propojit
  if (!matchedClient) {
    actions.push({
      type: 'CREATE_CLIENT',
      title: `Založit nového CRM klienta: "${companyName}"`,
      description: `Automaticky vytvoří kartu firmy v CRM s kontaktní osobou ${analysis.contact?.name || message.fromName || message.fromEmail}.`,
      confidence: analysis.company?.confidence || 0.85,
      payload: {
        name: companyName,
        tradingName: analysis.company?.tradingName || null,
        companyId: analysis.company?.ico || null,
        dic: analysis.company?.dic || null,
        billingStreet: analysis.company?.address || null,
        billingCity: analysis.company?.city || null,
        email: analysis.contact?.email || message.fromEmail,
        phone: analysis.contact?.phone || null,
        contactPerson: analysis.contact?.name || message.fromName || null,
      },
    });
  } else {
    actions.push({
      type: 'LINK_CLIENT',
      title: `Propojit s existujícím klientem: ${matchedClient.name}`,
      description: `Spáruje tuto zprávu a veškerou návaznou komunikaci s kartou klienta ${matchedClient.name}.`,
      confidence: matchedClient.confidence,
      payload: {
        clientId: matchedClient.id,
      },
    });
  }

  // 2. Podle typu klasifikace
  switch (analysis.classification) {
    case 'NEW_INQUIRY': {
      const pType = analysis.request?.projectType || 'NAVIGATION';
      if (pType === 'NAVIGATION') {
        actions.push({
          type: 'CREATE_NAVIGATION_ORDER',
          title: `Vytvořit návrh navigačního projektu (${analysis.request?.location || 'Nová lokalita'})`,
          description: `Založí navigační poptávku pro ${analysis.request?.location || companyName} s požadovaným rozsahem ${analysis.request?.requestedQuantity?.min ? `${analysis.request.requestedQuantity.min}–${analysis.request.requestedQuantity.max || 12} tabulí` : 'navigačních tabulí'}.`,
          confidence: analysis.confidence,
          payload: {
            title: `Navigace: ${companyName} (${analysis.request?.location || 'lokalita'})`,
            location: analysis.request?.location || null,
            openingDate: analysis.request?.openingDate || null,
            requestedCount: analysis.request?.requestedQuantity?.exact || analysis.request?.requestedQuantity?.max || 10,
          },
        });
      } else {
        actions.push({
          type: 'CREATE_OFFER',
          title: `Vytvořit koncept nabídky reklamních ploch`,
          description: `Založí koncept obchodní nabídky pro ${companyName}.`,
          confidence: analysis.confidence,
          payload: {
            title: `Nabídka ploch: ${companyName}`,
            projectType: pType,
            location: analysis.request?.location || null,
          },
        });
      }

      actions.push({
        type: 'CREATE_TASK',
        title: `Vytvořit úkol: Zpracovat poptávku a připravit trasu / kalkulaci`,
        description: `Zadá úkol pro obchodníka s termínem do 24 hodin na přípravu podkladů.`,
        confidence: 0.95,
        payload: {
          title: `Zpracovat poptávku: ${companyName}`,
          description: `Požadavek z e-mailu:\n${analysis.summary}\n\nTermín otevření: ${analysis.request?.openingDate || 'není uveden'}\nLokalita: ${analysis.request?.location || 'neuvedena'}`,
          priority: 'HIGH',
        },
      });
      break;
    }

    case 'OFFER_ACCEPTED': {
      if (entities.offerId) {
        actions.push({
          type: 'ACCEPT_OFFER',
          title: `Potvrdit schválení nabídky klientem`,
          description: `Převede nabídku ze stavu SENT do ACCEPTED a zaeviduje schválení s auditním záznamem.`,
          confidence: analysis.confidence,
          payload: {
            offerId: entities.offerId,
          },
        });
      }
      break;
    }

    case 'CHANGE_REQUEST': {
      const changeDesc = (analysis.detectedChanges || [])
        .map((c) => `${c.label}: ${c.fromValue ? `${c.fromValue} → ` : ''}${c.toValue}`)
        .join(', ');

      actions.push({
        type: 'UPDATE_OFFER',
        title: `Aktualizovat parametry nabídky / zakázky`,
        description: changeDesc
          ? `Zapracovat detekované změny: ${changeDesc}.`
          : `Zapracovat změnu požadavku klienta: ${analysis.summary}`,
        confidence: analysis.confidence,
        payload: {
          offerId: entities.offerId || null,
          crmOrderId: entities.crmOrderId || null,
          changes: analysis.detectedChanges || [],
        },
      });

      actions.push({
        type: 'CREATE_TASK',
        title: `Úkol: Zapracovat změnu požadavku klienta`,
        description: `Klient požaduje úpravu: ${analysis.summary}`,
        confidence: 0.90,
        payload: {
          title: `Změna požadavku: ${companyName}`,
          description: analysis.summary,
          priority: 'HIGH',
        },
      });
      break;
    }

    case 'GRAPHIC_APPROVAL': {
      if (entities.navigationOrderId) {
        actions.push({
          type: 'CHANGE_NAVIGATION_STATUS',
          title: `Posunout stav navigační zakázky do TISK_VYROBA`,
          description: `Schválení grafiky klientem posune zakázku do výrobní fáze v souladu se stavovým automatem.`,
          confidence: analysis.confidence,
          payload: {
            navigationOrderId: entities.navigationOrderId,
            targetStatus: 'TISK_VYROBA',
          },
        });
      }
      break;
    }

    default:
      break;
  }

  // 3. Uložit přílohy do klientských dokumentů
  if (message.hasAttachments) {
    actions.push({
      type: 'STORE_DOCUMENT',
      title: `Uložit e-mailové přílohy do klientských dokumentů`,
      description: `Uloží grafické podklady, loga a dokumenty z přílohy tohoto e-mailu ke kartě klienta.`,
      confidence: 0.95,
      payload: {},
    });
  }

  // 4. Vždy navrhnout zapsání do historie komunikace
  actions.push({
    type: 'CREATE_COMMUNICATION',
    title: `Zaevidovat e-mail do historie komunikace klienta`,
    description: `Záznam bude zobrazen v časové ose klienta v CRM pro všechny členy týmu.`,
    confidence: 1.0,
    payload: {
      subject: message.subject,
      content: message.textBody || analysis.summary,
      type: 'EMAIL',
    },
  });

  return actions;
}
