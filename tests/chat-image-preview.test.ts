import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../components/chat/TeamChatContainer.tsx', import.meta.url), 'utf8');

test('chat image opens in an in-app modal instead of an unreliable data URL window', () => {
  assert.doesNotMatch(source, /window\.open\(msg\.imageUrl/);
  assert.match(source, /openImagePreview\(msg\.imageUrl!/);
  assert.match(source, /aria-label="Náhled fotografie z chatu"/);
});

test('chat image preview supports close, Escape, containment and load errors', () => {
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /object-contain/);
  assert.match(source, /onError=\{\(\) => setPreviewImageFailed\(true\)\}/);
  assert.match(source, /aria-label="Zavřít náhled fotografie"/);
});

test('chat delegates carrier photography to the dedicated mobile workflow', () => {
  assert.doesNotMatch(source, /CarrierPhotoUploadModal/);
  assert.match(source, /href="\/mobile-photos"/);
  assert.match(source, /Mobilní focení ploch/);
});
