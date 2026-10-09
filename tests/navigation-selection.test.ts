import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveNavigationSelection } from '../lib/offers/navigation-selection';
const points = [{ id: 'internal-a' }, { id: 'internal-b' }];
test('navigation selection resolves both public keys and existing internal ids', () => {
  assert.deepEqual([...resolveNavigationSelection(['point-1', 'internal-b'], points)], ['internal-a', 'internal-b']);
});
test('both selection callers must reject missing, empty, foreign and canonical duplicate ids', () => {
  for (const input of [undefined, null, [], ['foreign'], [42], ['point-1', 'point-1'], ['point-1', 'internal-a']]) assert.throws(() => resolveNavigationSelection(input, points));
});
