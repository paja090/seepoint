import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const messages = readFileSync(new URL('../app/api/chat/messages/route.ts', import.meta.url), 'utf8');
const chatPage = readFileSync(new URL('../app/chat/page.tsx', import.meta.url), 'utf8');
const notifications = readFileSync(new URL('../app/api/notifications/unread/route.ts', import.meta.url), 'utf8');
const notificationService = readFileSync(new URL('../lib/notifications-service.ts', import.meta.url), 'utf8');
const notificationBell = readFileSync(new URL('../components/notifications/NotificationBellCenter.tsx', import.meta.url), 'utf8');

test('chat assignments use user ids and keep legacy employee-id notifications compatible', () => {
  assert.match(chatPage, /id:\s*e\.userId!/);
  assert.doesNotMatch(chatPage, /id:\s*e\.id/);
  assert.match(notifications, /user\.employee\?\.id/);
  assert.match(messages, /organizationMember\.findFirst/);
  assert.match(messages, /userId:\s*assignedToUserId/);
});

test('fuel and fault side effects are atomic with chat message creation', () => {
  assert.match(messages, /prisma\.\$transaction\(async \(tx\)/);
  assert.match(messages, /tx\.vehicleFuelExpense\.create/);
  assert.match(messages, /tx\.vehicleServiceRecord\.create/);
  assert.match(messages, /tx\.chatMessage\.create/);
  assert.match(messages, /TransactionIsolationLevel\.Serializable/);
});

test('chat mutation and media boundaries are enforced server-side', () => {
  assert.match(messages, /canAssignChatMessage/);
  assert.match(messages, /canResolveChatMessage/);
  assert.match(messages, /validateChatImage/);
  assert.match(messages, /rateLimitPolicies\.chatMessage/);
});

test('automatic notification polling does not invoke AI and module alerts are role-gated', () => {
  assert.match(notificationBell, /fetchNotifications\(\)/);
  assert.match(notificationBell, /fetchNotifications\(true\)/);
  assert.match(notificationService, /options\.includeAi/);
  assert.match(notificationService, /canAccess\(userRole, 'warehouse'\)/);
  assert.match(notificationService, /canAccess\(userRole, 'cityGallery'\)/);
  assert.doesNotMatch(notificationService, /UNRETURNED_TOOL/);
});
