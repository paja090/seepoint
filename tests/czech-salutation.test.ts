import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCzechBusinessSalutation } from '../lib/czech-salutation.ts';

test('Pavel Šubert je v e-mailu osloven českým vokativem', () => {
  assert.equal(formatCzechBusinessSalutation('Pavel Šubert'), 'pane Šuberte');
  assert.equal(formatCzechBusinessSalutation('  Pavel   Šubert  '), 'pane Šuberte');
});

test('neznámé jméno zůstane beze změny místo chybného automatického skloňování', () => {
  assert.equal(formatCzechBusinessSalutation('Alex Taylor'), 'Alex Taylor');
  assert.equal(formatCzechBusinessSalutation(''), 'kliente');
});
