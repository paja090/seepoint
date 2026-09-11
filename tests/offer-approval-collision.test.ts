import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('respondToPublicOffer and transitionOffer enforce availability conflict check before accepting standard media offers', () => {
  const service = read('lib/offers/service.ts');

  // transitionOffer must check conflicts for ACCEPTED
  assert.match(
    service,
    /if\s*\(\s*target\s*===\s*'ACCEPTED'\s*&&\s*existing\.offerType\s*===\s*'STANDARD_MEDIA'\s*\)\s*\{[\s\S]*?findConflicts\(tx,\s*existing\.items,\s*existing\.id\)[\s\S]*?AVAILABILITY_CONFLICT/,
    'transitionOffer must check findConflicts and throw AVAILABILITY_CONFLICT on accepted standard media offers'
  );

  // respondToPublicOffer must check conflicts for ACCEPTED
  assert.match(
    service,
    /if\s*\(\s*target\s*===\s*'ACCEPTED'\s*&&\s*row\.offerType\s*===\s*'STANDARD_MEDIA'\s*\)\s*\{[\s\S]*?findConflicts\(tx,\s*row\.items,\s*row\.id\)[\s\S]*?AVAILABILITY_CONFLICT/,
    'respondToPublicOffer must check findConflicts and throw AVAILABILITY_CONFLICT on accepted standard media offers'
  );
});

test('respondToPublicOffer respects selectedPointIds for Navigation Phase 1', () => {
  const service = read('lib/offers/service.ts');

  assert.match(
    service,
    /const\s+selectedPointIds\s*=\s*Array\.isArray\(body\?\.selectedPointIds\)/,
    'respondToPublicOffer must parse body.selectedPointIds'
  );
  assert.match(
    service,
    /isSelectedByClient:\s*selectedSet\s*\?\s*selectedSet\.has\(point\.id\)\s*:\s*true/,
    'respondToPublicOffer must mark isSelectedByClient according to selectedSet'
  );
});

test('sendTransactionalEmail and all offer notification routes scope EmailLog with organizationId', () => {
  const email = read('lib/email.ts');
  const service = read('lib/offers/service.ts');
  const selectionRoute = read('app/api/proposals/[token]/selection/route.ts');
  const artworkRoute = read('app/api/proposals/[token]/artwork/route.ts');

  assert.match(email, /organizationId\?:\s*string;/);
  assert.match(email, /organizationId:\s*input\.organizationId/);
  assert.match(service, /sendTransactionalEmail\(\{[\s\S]*?organizationId:\s*row\.organizationId/);
  assert.match(selectionRoute, /sendTransactionalEmail\(\{[\s\S]*?organizationId:\s*offer\.organizationId/);
  assert.match(artworkRoute, /sendTransactionalEmail\(\{[\s\S]*?organizationId:\s*offer\.organizationId/);
});
