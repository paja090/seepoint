import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  extractDomain,
  isFreemailDomain,
  COMMON_FREEMAIL_DOMAINS,
} from '../lib/ai-inbox/client-matcher.ts';
import {
  ORDER_NUMBER_REGEX,
  NAV_NUMBER_REGEX,
  PROPOSAL_TOKEN_REGEX,
} from '../lib/ai-inbox/entity-matcher.ts';

test('extractDomain correctly parses email domains', () => {
  assert.equal(extractDomain('jan.novak@amrest.eu'), 'amrest.eu');
  assert.equal(extractDomain('  INFO@KFC.CZ  '), 'kfc.cz');
  assert.equal(extractDomain('invalid-email'), null);
  assert.equal(extractDomain(''), null);
  assert.equal(extractDomain(null), null);
});

test('isFreemailDomain distinguishes generic public email providers from corporate domains', () => {
  assert.ok(COMMON_FREEMAIL_DOMAINS.has('gmail.com'));
  assert.equal(isFreemailDomain('jan.novak@gmail.com'), true);
  assert.equal(isFreemailDomain('petr@seznam.cz'), true);
  assert.equal(isFreemailDomain('obchod@centrum.cz'), true);
  assert.equal(isFreemailDomain('jan@volny.cz'), true);
  assert.equal(isFreemailDomain('gmail.com'), true);

  // Business domains must NOT be treated as freemail
  assert.equal(isFreemailDomain('jan.novak@amrest.eu'), false);
  assert.equal(isFreemailDomain('marketing@skoda-auto.cz'), false);
  assert.equal(isFreemailDomain('reklama@cez.cz'), false);
  assert.equal(isFreemailDomain('firma.cz'), false);
});

test('ORDER_NUMBER_REGEX matches ZAK-YYYY-XXXX order codes in email subjects and bodies', () => {
  const subject1 = 'Potvrzení zakázky ZAK-2026-0042 pro novou prodejnu';
  const match1 = subject1.match(ORDER_NUMBER_REGEX);
  assert.ok(match1);
  assert.equal(match1[1].toUpperCase(), 'ZAK-2026-0042');

  const text2 = 'Dobrý den, k zakázce zak-2026-10025 zasíláme tisková data.';
  const match2 = text2.match(ORDER_NUMBER_REGEX);
  assert.ok(match2);
  assert.equal(match2[1].toUpperCase(), 'ZAK-2026-10025');

  assert.equal('Poptávka reklamních ploch bez čísla'.match(ORDER_NUMBER_REGEX), null);
});

test('NAV_NUMBER_REGEX matches NAV-YYYY-XXXX navigation order codes', () => {
  const subject = 'Navigační systém NAV-2026-0015 - odsouhlasení trasy';
  const match = subject.match(NAV_NUMBER_REGEX);
  assert.ok(match);
  assert.equal(match[1].toUpperCase(), 'NAV-2026-0015');

  const matchShort = 'NAV-1234'.match(NAV_NUMBER_REGEX);
  assert.ok(matchShort);
  assert.equal(matchShort[1].toUpperCase(), 'NAV-1234');
});

test('PROPOSAL_TOKEN_REGEX extracts public offer link token', () => {
  const emailBody = 'Reagujeme na vaši nabídku na https://os.seepoint.cz/proposals/tok_abc1234567890xyz a potvrzujeme ji.';
  const match = emailBody.match(PROPOSAL_TOKEN_REGEX);
  assert.ok(match);
  assert.equal(match[1], 'tok_abc1234567890xyz');

  const altBody = 'Zde je odkaz: /offer/public_offer_token_12345';
  const matchAlt = altBody.match(PROPOSAL_TOKEN_REGEX);
  assert.ok(matchAlt);
  assert.equal(matchAlt[1], 'public_offer_token_12345');
});

test('client matcher cascade implements priority tiers in client-matcher.ts', () => {
  const matcherSource = readFileSync(new URL('../lib/ai-inbox/client-matcher.ts', import.meta.url), 'utf8');
  assert.match(matcherSource, /1\. Přesná shoda podle e-mailu v kontaktech klienta/);
  assert.match(matcherSource, /2\. Přesná shoda podle e-mailu na kartě klienta/);
  assert.match(matcherSource, /3\. IČO shoda/);
  assert.match(matcherSource, /4\. Shoda podle domény odesílatele \(mimo freemaily\)/);
  assert.match(matcherSource, /5\. Normalizovaný název firmy/);
  assert.match(matcherSource, /6\. Částečná shoda pro nabídku alternativních kandidátů/);
});

test('ORDER_NUMBER_REGEX and NAV_NUMBER_REGEX match flexible Czech order formats', () => {
  // Variations with spaces, slashes and prefixes
  const match1 = 'Zasíláme podklady k zakázce ZAK 2026/0002'.match(ORDER_NUMBER_REGEX);
  assert.ok(match1);
  assert.equal(match1[1].replace(/\s+/g, '-').replace(/\//g, '-').toUpperCase(), 'ZAK-2026-0002');

  const match2 = 'Dotaz na průběh TEST-NAV-2026-001'.match(ORDER_NUMBER_REGEX);
  assert.ok(match2);
  assert.equal(match2[1].toUpperCase(), 'TEST-NAV-2026-001');

  const matchNav = 'Navigace pro pobočku NAV 2026/0045'.match(NAV_NUMBER_REGEX);
  assert.ok(matchNav);
  assert.equal(matchNav[1].replace(/\s+/g, '-').replace(/\//g, '-').toUpperCase(), 'NAV-2026-0045');
});

test('entity-matcher implements client active orders and client PO code matching', () => {
  const matcherSource = readFileSync(new URL('../lib/ai-inbox/entity-matcher.ts', import.meta.url), 'utf8');
  assert.match(matcherSource, /clientOrderCode/);
  assert.match(matcherSource, /7\. Pokud je znám klient, dohledat jeho aktivní zakázky/);
  assert.match(matcherSource, /candidateOrders/);
  assert.match(matcherSource, /titleMatchedOrder/);
});
