import assert from 'node:assert/strict';
import test from 'node:test';
import { isBotOrSystemEmail } from '../lib/ai-inbox/service.ts';
import { buildProposedActions } from '../lib/ai-inbox/action-builder.ts';
import type { AiInboxAnalysisResult } from '../lib/ai-inbox/types.ts';

test('isBotOrSystemEmail accurately identifies automated bot and system emails', () => {
  // Known bot senders
  assert.equal(isBotOrSystemEmail('notifications@github.com'), true);
  assert.equal(isBotOrSystemEmail('noreply@github.com'), true);
  assert.equal(isBotOrSystemEmail('no-reply@accounts.google.com'), true);
  assert.equal(isBotOrSystemEmail('security-noreply@accounts.google.com'), true);
  assert.equal(isBotOrSystemEmail('support@vercel.com'), true);
  assert.equal(isBotOrSystemEmail('notifications@vercel.com'), true);
  assert.equal(isBotOrSystemEmail('mailer-daemon@googlemail.com'), true);
  assert.equal(isBotOrSystemEmail('invitations@linkedin.com'), true);

  // Common bot and noreply patterns
  assert.equal(isBotOrSystemEmail('no-reply@anycompany.cz'), true);
  assert.equal(isBotOrSystemEmail('noreply@newsletter.eu'), true);
  assert.equal(isBotOrSystemEmail('donotreply@bank.com'), true);
  assert.equal(isBotOrSystemEmail('postmaster@domain.org'), true);
  assert.equal(isBotOrSystemEmail('mailer-daemon@relay.com'), true);

  // Real client and business emails MUST NOT be identified as bots
  assert.equal(isBotOrSystemEmail('jan.novak@seznam.cz'), false);
  assert.equal(isBotOrSystemEmail('objednavky@mcdonalds.cz'), false);
  assert.equal(isBotOrSystemEmail('info@formfactory.cz'), false);
  assert.equal(isBotOrSystemEmail('petr.dvorak@firma.eu'), false);
  assert.equal(isBotOrSystemEmail('kaufland@reklama.cz'), false);
});

test('buildProposedActions returns empty array for SPAM_IRRELEVANT messages', () => {
  const analysis: AiInboxAnalysisResult = {
    classification: 'SPAM_IRRELEVANT',
    confidence: 0.99,
    summary: 'GitHub notification bot message regarding PR #331.',
    company: {
      name: 'GitHub',
      ico: null,
      tradingName: null,
      city: null,
      confidence: 0.9,
    },
    contact: {
      name: 'chatgpt-codex-connector[bot]',
      email: 'notifications@github.com',
      phone: null,
    },
    request: null,
    suggestedReply: undefined,
  };

  const actions = buildProposedActions({
    analysis,
    entities: {},
    message: {
      id: 'msg-spam-1',
      fromEmail: 'notifications@github.com',
      fromName: 'chatgpt-codex-connector[bot]',
      subject: 'Re: [paja090/seepoint] PR #331',
      hasAttachments: false,
    },
  });

  assert.equal(actions.length, 0, 'Spam messages must NEVER generate proposed CRM actions');
});

test('buildProposedActions returns empty array for spam even when client candidate is passed', () => {
  const analysis: AiInboxAnalysisResult = {
    classification: 'SPAM_IRRELEVANT',
    confidence: 0.9,
    summary: 'Irrelevant newsletter message',
    company: null,
    contact: null,
    request: null,
    suggestedReply: undefined,
  };

  const actions = buildProposedActions({
    analysis,
    entities: {
      client: {
        id: 'client-1',
        name: 'Existující firma',
        companyId: '12345678',
        matchType: 'NORMALIZED_NAME_MATCH',
        confidence: 1.0,
      },
    },
    message: {
      id: 'msg-spam-2',
      fromEmail: 'newsletter@spam.cz',
      fromName: 'Newsletter',
      subject: 'Letní slevy na všechno!',
      hasAttachments: true,
    },
  });

  assert.equal(actions.length, 0, 'Spam messages must return 0 actions even with existing client');
});
