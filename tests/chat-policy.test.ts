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

test('chat image validation checks data type, size and file signature', () => {
  const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3]).toString('base64')}`;
  assert.equal(validateChatImage(jpeg).value, jpeg);
  assert.match(validateChatImage('https://tracker.invalid/pixel.png').error ?? '', /vložený obrázek/);
  const fake = `data:image/jpeg;base64,${Buffer.from('not an image').toString('base64')}`;
  assert.match(validateChatImage(fake).error ?? '', /neodpovídá/);
});
