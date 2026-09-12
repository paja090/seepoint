import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildProposedActions } from '../lib/ai-inbox/action-builder.ts';
import type { AiInboxAnalysisResult } from '../lib/ai-inbox/types.ts';

test('buildProposedActions generates CREATE_CLIENT, CREATE_NAVIGATION_ORDER, CREATE_TASK for new inquiry without client', () => {
  const analysis: AiInboxAnalysisResult = {
    classification: 'NEW_INQUIRY',
    confidence: 0.95,
    company: {
      name: 'AmRest s.r.o.',
      ico: '25114702',
      tradingName: 'KFC Opava',
      city: 'Opava',
      confidence: 0.9,
    },
    contact: {
      name: 'Jan Novák',
      email: 'jan.novak@amrest.eu',
      phone: '+420 777 123 456',
    },
    request: {
      projectType: 'NAVIGATION',
      location: 'Opava',
      requestedQuantity: { min: null, max: null, exact: 10 },
      notes: 'Navigační tabule k nové pobočce',
    },
    summary: 'Poptávka 10 navigačních tabulí v Opavě.',
    suggestedReply: 'Dobrý den, děkujeme za poptávku...',
  };

  const actions = buildProposedActions({
    analysis,
    entities: {},
    message: {
      id: 'msg-123',
      fromEmail: 'jan.novak@amrest.eu',
      fromName: 'Jan Novák',
      subject: 'Poptávka navigačního značení KFC Opava',
      hasAttachments: true,
    },
  });

  const actionTypes = actions.map((a) => a.type);
  assert.ok(actionTypes.includes('CREATE_CLIENT'), 'Should propose creating a client');
  assert.ok(actionTypes.includes('CREATE_NAVIGATION_ORDER'), 'Should propose creating a navigation order');
  assert.ok(actionTypes.includes('CREATE_TASK'), 'Should propose creating a follow-up task');
  assert.ok(actionTypes.includes('CREATE_COMMUNICATION'), 'Should propose logging client communication');
  assert.ok(actionTypes.includes('STORE_DOCUMENT'), 'Should propose saving attachments');

  const clientAction = actions.find((a) => a.type === 'CREATE_CLIENT')!;
  assert.equal(clientAction.payload.name, 'AmRest s.r.o.');
  assert.equal(clientAction.payload.companyId, '25114702');
  assert.equal(clientAction.payload.contactPerson, 'Jan Novák');
});

test('buildProposedActions generates LINK_CLIENT when client already exists', () => {
  const analysis: AiInboxAnalysisResult = {
    classification: 'NEW_INQUIRY',
    confidence: 0.9,
    summary: 'Poptávka od stávajícího klienta',
    company: null,
    contact: null,
    request: null,
  };

  const actions = buildProposedActions({
    analysis,
    entities: {
      client: {
        id: 'client-existing-456',
        name: 'AmRest s.r.o.',
        confidence: 0.98,
        matchType: 'EXACT_CONTACT_EMAIL',
      },
    },
    message: {
      id: 'msg-124',
      fromEmail: 'jan.novak@amrest.eu',
      subject: 'Další poptávka',
      hasAttachments: false,
    },
  });

  const linkAction = actions.find((a) => a.type === 'LINK_CLIENT');
  assert.ok(linkAction);
  assert.equal(linkAction?.payload.clientId, 'client-existing-456');
  assert.equal(actions.some((a) => a.type === 'CREATE_CLIENT'), false);
});

test('buildProposedActions generates ACCEPT_OFFER for OFFER_ACCEPTED classification with matched offer', () => {
  const analysis: AiInboxAnalysisResult = {
    classification: 'OFFER_ACCEPTED',
    confidence: 0.98,
    summary: 'Klient schvaluje nabídku NAB-2026-0012.',
    company: null,
    contact: null,
    request: null,
  };

  const actions = buildProposedActions({
    analysis,
    entities: {
      offerId: 'offer-789',
    },
    message: {
      id: 'msg-125',
      fromEmail: 'klient@firma.cz',
      subject: 'Re: Nabídka NAB-2026-0012 - akceptace',
      hasAttachments: false,
    },
  });

  const acceptAction = actions.find((a) => a.type === 'ACCEPT_OFFER');
  assert.ok(acceptAction);
  assert.equal(acceptAction?.payload.offerId, 'offer-789');
  assert.ok(actions.some((a) => a.type === 'CREATE_COMMUNICATION'));
});

test('buildProposedActions generates CHANGE_NAVIGATION_STATUS on GRAPHIC_APPROVAL', () => {
  const analysis: AiInboxAnalysisResult = {
    classification: 'GRAPHIC_APPROVAL',
    confidence: 0.92,
    summary: 'Klient odsouhlasil grafiku k tisku.',
    company: null,
    contact: null,
    request: null,
  };

  const actions = buildProposedActions({
    analysis,
    entities: {
      navigationOrderId: 'nav-order-101',
    },
    message: {
      id: 'msg-126',
      fromEmail: 'grafik@klient.cz',
      subject: 'Odsouhlasení grafiky NAV-2026-0042',
      hasAttachments: false,
    },
  });

  const statusAction = actions.find((a) => a.type === 'CHANGE_NAVIGATION_STATUS');
  assert.ok(statusAction);
  assert.equal(statusAction?.payload.targetStatus, 'TISK_VYROBA');
  assert.equal(statusAction?.payload.navigationOrderId, 'nav-order-101');
});

test('human-in-the-loop: actions in schema default to PROPOSED and requiresReview is true', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  assert.match(schema, /model AiInboxAction[\s\S]*status\s+AiInboxActionStatus\s+@default\(PROPOSED\)/);
  assert.match(schema, /model AiInboxMessage[\s\S]*requiresReview\s+Boolean\s+@default\(true\)/);
});

test('safe action executor enforces tenant isolation, idempotence and valid state transitions', () => {
  const executorSource = readFileSync(new URL('../lib/ai-inbox/action-executor.ts', import.meta.url), 'utf8');
  // Tenant isolation check
  assert.match(executorSource, /where:\s*\{\s*id:\s*actionId,\s*organizationId\s*\}/);
  // Idempotency: cannot re-execute EXECUTED actions
  assert.match(executorSource, /action\.status === 'EXECUTED'/);
  // Valid status transition check for navigation orders
  assert.match(executorSource, /validateStatusTransition/);
  // Valid status transition check for offers
  assert.match(executorSource, /transitionOffer/);
  // Records audit metadata
  assert.match(executorSource, /executedAt:\s*new Date\(\)/);
  assert.match(executorSource, /executedById:\s*actor\.id/);
});
