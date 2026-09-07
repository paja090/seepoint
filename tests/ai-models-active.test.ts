import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('no application logic refers to deprecated gemini-2.5-flash', () => {
  const filesToCheck = [
    'lib/ai-gemini.ts',
    'lib/opportunities/parser.ts',
    'lib/notifications-service.ts',
    'lib/ai-offers/service.ts',
    'lib/ai-usage.ts',
    'app/api/crm/clients/[id]/ai-enrich/route.ts',
    'app/api/crm/clients/ai-lookup/route.ts',
    'app/api/ai/parse-quick-tasks/route.ts',
  ];

  for (const file of filesToCheck) {
    const content = source(file);
    assert.doesNotMatch(content, /gemini-2\.5-flash/, `File ${file} should not reference deprecated gemini-2.5-flash`);
    assert.match(content, /gemini-3\.6-flash/, `File ${file} should configure gemini-3.6-flash as primary model`);
  }
});
