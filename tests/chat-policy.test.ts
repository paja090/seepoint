import assert from 'node:assert/strict';
import test from 'node:test';
import { canAssignChatMessage, canResolveChatMessage, isChatChannel, validateChatImage } from '../lib/chat-policy.ts';

test('chat accepts only declared channels', () => {
  assert.equal(isChatChannel('general'), true);
  assert.equal(isChatChannel('urgent'), true);
  assert.equal(isChatChannel('private-admin'), false);
});

test('chat assignment and resolution respect author, assignee and manager roles', () => {
  const message = { userId: 'author', assignedToUserId: 'solver' };
  assert.equal(canAssignChatMessage({ id: 'other', role: 'WORKER' }, message), false);
  assert.equal(canAssignChatMessage({ id: 'author', role: 'WORKER' }, message), true);
  assert.equal(canAssignChatMessage({ id: 'manager', role: 'MANAGER' }, message), true);
  assert.equal(canResolveChatMessage({ id: 'solver', role: 'WORKER' }, message), true);
  assert.equal(canResolveChatMessage({ id: 'solver-user', role: 'WORKER', employee: { id: 'solver' } }, message), true);
  assert.equal(canResolveChatMessage({ id: 'other', role: 'WORKER' }, message), false);
});

test('chat image validation rejects raw Base64 and enforces stored file URLs', () => {
  const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3]).toString('base64')}`;
  // Default chat validation rejects inline base64
  assert.match(validateChatImage(jpeg).error ?? '', /Base64 obrázky nelze ukládat do chatu/);

  // Valid stored photo URLs are accepted
  assert.equal(validateChatImage('/api/photos/cm12345/file').value, '/api/photos/cm12345/file');
  assert.equal(validateChatImage('https://storage.seepoint.cz/photos/test.jpg').value, 'https://storage.seepoint.cz/photos/test.jpg');

  // Invalid or dangerous schemes are rejected
  assert.match(validateChatImage('javascript:alert(1)').error ?? '', /platná adresa uloženého souboru/);

  // With explicit allowInline flag, validates format and signature
  assert.equal(validateChatImage(jpeg, { allowInline: true }).value, jpeg);
  const fake = `data:image/jpeg;base64,${Buffer.from('not an image').toString('base64')}`;
  assert.match(validateChatImage(fake, { allowInline: true }).error ?? '', /neodpovídá/);
});
