import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateChatImage } from '../lib/chat-policy';

const chat = readFileSync(new URL('../components/chat/TeamChatContainer.tsx', import.meta.url), 'utf8');
const messages = readFileSync(new URL('../app/api/chat/messages/route.ts', import.meta.url), 'utf8');
const ocr = readFileSync(new URL('../app/api/fuel/ocr/route.ts', import.meta.url), 'utf8');

test('OCR accepts image bytes while persistent chat rejects inline images', () => {
  const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64')}`;
  assert.equal(validateChatImage(jpeg, { allowInline: true, maxBytes: 3_000_000 }).value, jpeg);
  assert.ok('error' in validateChatImage(jpeg));
  assert.ok('error' in validateChatImage('data:image/jpeg;base64,aGVsbG8=', { allowInline: true }));
  assert.match(chat, /JSON\.stringify\(\{ imageUrl: compressedDataUrl \}\)/);
  assert.match(ocr, /allowInline: true/);
});

test('vehicle receipt is saved independently of the chat attachment', () => {
  const submit = chat.slice(chat.indexOf('async function handleSendFuelExpense'), chat.indexOf('async function handleSendVehicleFault'));
  assert.match(submit, /imageUrl: null/);
  assert.match(submit, /receiptUrl: fuelReceiptUrl/);
  assert.doesNotMatch(submit, /setImageUrl/);
  assert.match(messages, /validateChatImage\(fuel\?\.receiptUrl \?\? body.imageUrl\)/);
  assert.match(messages, /receiptUrl: receipt.value/);
});

test('failed OCR is visible and does not claim success just because a photo exists', () => {
  assert.match(chat, /fuelOcrStatus === 'success'/);
  assert.match(chat, /fuelOcrStatus === 'error'/);
  assert.match(chat, /Vyplňte částku ručně/);
  assert.doesNotMatch(chat, /!aiScanningFuel && imageUrl/);
});
