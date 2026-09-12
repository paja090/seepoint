import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { extractTextAndHtml } from '../lib/ai-inbox/providers/gmail.ts';
import { validateAndSanitizeAnalysis } from '../lib/ai-inbox/extraction.ts';

test('AI Inbox schema includes AiInboxMessage, AiInboxAttachment, AiInboxAction models', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  assert.match(schema, /model AiInboxMessage/);
  assert.match(schema, /model AiInboxAttachment/);
  assert.match(schema, /model AiInboxAction/);
  assert.match(schema, /enum AiInboxStatus/);
  assert.match(schema, /enum AiInboxClassification/);
  assert.match(schema, /enum AiInboxActionType/);
  assert.match(schema, /enum AiInboxActionStatus/);
  assert.match(schema, /@@unique\(\[organizationId, provider, providerMessageId\]\)/);
});

test('tenant layer registers AI Inbox models for strict tenant isolation', () => {
  const tenantLayer = readFileSync(new URL('../lib/tenant-prisma.ts', import.meta.url), 'utf8');
  assert.match(tenantLayer, /'AiInboxMessage'/);
  assert.match(tenantLayer, /'AiInboxAttachment'/);
  assert.match(tenantLayer, /'AiInboxAction'/);
});

test('extractTextAndHtml extracts plain text, html and attachments from MIME tree', () => {
  const textBase64 = Buffer.from('Dobrý den,\npoptáváme reklamní plochy v Opavě.').toString('base64url');
  const htmlBase64 = Buffer.from('<p>Dobrý den, poptáváme reklamní plochy v Opavě.</p>').toString('base64url');

  const part = {
    mimeType: 'multipart/mixed',
    parts: [
      {
        mimeType: 'text/plain',
        body: { data: textBase64, size: textBase64.length },
      },
      {
        mimeType: 'text/html',
        body: { data: htmlBase64, size: htmlBase64.length },
      },
      {
        mimeType: 'application/pdf',
        filename: 'poptavka_opava.pdf',
        body: { attachmentId: 'att_12345', size: 10240 },
      },
    ],
  };

  const result = extractTextAndHtml(part);
  assert.match(result.text, /poptáváme reklamní plochy v Opavě/);
  assert.match(result.html, /<p>Dobrý den/);
  assert.equal(result.attachments.length, 1);
  assert.equal(result.attachments[0].filename, 'poptavka_opava.pdf');
  assert.equal(result.attachments[0].providerAttachmentId, 'att_12345');
  assert.equal(result.attachments[0].size, 10240);
});

test('validateAndSanitizeAnalysis validates valid AI JSON output', () => {
  const rawInput = {
    classification: 'NEW_INQUIRY',
    confidence: 0.95,
    company: {
      name: 'AmRest s.r.o.',
      ico: '25114702',
      city: 'Praha',
      confidence: 0.9,
    },
    contact: {
      name: 'Jan Novák',
      email: 'jan.novak@amrest.eu',
      phone: '+420 777 123 456',
    },
    request: {
      projectType: 'NAVIGATION',
      city: 'Opava',
      requestedQuantity: 10,
      notes: 'Navigace k nové provozovně KFC',
    },
    summary: 'Poptávka 10 tabulí v Opavě pro novou restauraci KFC.',
    suggestedReply: 'Vážený pane Nováku, děkujeme za poptávku...',
  };

  const result = validateAndSanitizeAnalysis(rawInput);
  assert.equal(result.classification, 'NEW_INQUIRY');
  assert.equal(result.confidence, 0.95);
  assert.equal(result.company?.name, 'AmRest s.r.o.');
  assert.equal(result.company?.ico, '25114702');
  assert.equal(result.contact?.email, 'jan.novak@amrest.eu');
  assert.equal(result.request?.projectType, 'NAVIGATION');
  assert.equal(result.request?.requestedQuantity?.exact, 10);
});

test('validateAndSanitizeAnalysis safely sanitizes unknown classification and clamps confidence', () => {
  const rawInput = {
    classification: 'INVALID_UNKNOWN_TYPE',
    confidence: 1.5, // out of range
    summary: 'Test summary',
  };

  const result = validateAndSanitizeAnalysis(rawInput);
  assert.equal(result.classification, 'UNKNOWN');
  assert.equal(result.confidence, 1.0); // clamped to 1.0
  assert.equal(result.company, null);
});

test('AI Inbox service defines idempotent ingestion contract', () => {
  const serviceFile = readFileSync(new URL('../lib/ai-inbox/service.ts', import.meta.url), 'utf8');
  assert.match(serviceFile, /organizationId_provider_providerMessageId/);
  assert.match(serviceFile, /processingStatus:\s*'INGESTED'/);
});
