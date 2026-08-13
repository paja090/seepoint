import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const upload = readFileSync(new URL('../app/api/mobile-photos/upload/route.ts', import.meta.url), 'utf8');
const confirm = readFileSync(new URL('../app/api/mobile-photos/confirm/route.ts', import.meta.url), 'utf8');
const notifications = readFileSync(new URL('../app/api/notifications/unread/route.ts', import.meta.url), 'utf8');
const messages = readFileSync(new URL('../app/api/chat/messages/route.ts', import.meta.url), 'utf8');

test('routine mobile photos are not duplicated into installation chat', () => {
  assert.doesNotMatch(upload, /channel:\s*isDamage\s*\?\s*'urgent'\s*:\s*'installations'/);
  assert.doesNotMatch(confirm, /channel:\s*photo\.type\s*===\s*'DAMAGE'\s*\?\s*'urgent'\s*:\s*'installations'/);
  assert.match(upload, /if \(purpose !== 'DAMAGE'\) return/);
  assert.match(confirm, /if \(photo\.type !== 'DAMAGE'\) return/);
});

test('damage photos still create urgent operational alerts', () => {
  assert.match(upload, /channel:\s*'urgent'/);
  assert.match(confirm, /channel:\s*'urgent'/);
});

test('global notifications include unread chat messages but exclude own messages', () => {
  assert.match(notifications, /reads:\s*\{ none:\s*\{ userId:\s*user\.id \} \}/);
  assert.match(notifications, /userId:\s*\{ not:\s*user\.id \}/);
  assert.match(notifications, /CHAT_MESSAGE/);
});

test('opening a chat channel marks every delivered message as read', () => {
  assert.match(messages, /chatRead\.createMany/);
  assert.match(messages, /messages\.map\(\(message\)/);
  assert.match(messages, /skipDuplicates:\s*true/);
});
