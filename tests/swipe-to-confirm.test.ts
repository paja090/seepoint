import test from 'node:test';
import assert from 'node:assert/strict';

test('SwipeToConfirm calculation metrics - threshold and clamping logic', () => {
  const computeSwipeProgress = (dragX: number, maxDistance: number) => {
    if (maxDistance <= 0) return 0;
    return Math.max(0, Math.min(1, dragX / maxDistance));
  };

  const isConfirmed = (progress: number, threshold = 0.7) => {
    return progress >= threshold;
  };

  const maxDistance = 250;

  // Initial state (drag = 0)
  assert.equal(computeSwipeProgress(0, maxDistance), 0);
  assert.equal(isConfirmed(computeSwipeProgress(0, maxDistance)), false);

  // Negative drag (pulling backwards) is clamped to 0
  assert.equal(computeSwipeProgress(-30, maxDistance), 0);
  assert.equal(isConfirmed(computeSwipeProgress(-30, maxDistance)), false);

  // Dragging halfway (50%) - not confirmed, springs back
  assert.equal(computeSwipeProgress(125, maxDistance), 0.5);
  assert.equal(isConfirmed(computeSwipeProgress(125, maxDistance)), false);

  // Dragging just below threshold (69%) - not confirmed
  assert.equal(computeSwipeProgress(172.5, maxDistance), 0.69);
  assert.equal(isConfirmed(computeSwipeProgress(172.5, maxDistance)), false);

  // Dragging past threshold (70%+) - confirmed!
  assert.equal(computeSwipeProgress(175, maxDistance), 0.7);
  assert.equal(isConfirmed(computeSwipeProgress(175, maxDistance)), true);

  // Full drag (100%+)
  assert.equal(computeSwipeProgress(250, maxDistance), 1);
  assert.equal(isConfirmed(computeSwipeProgress(250, maxDistance)), true);

  // Over-drag (past 100%) is clamped to 1
  assert.equal(computeSwipeProgress(350, maxDistance), 1);
  assert.equal(isConfirmed(computeSwipeProgress(350, maxDistance)), true);
});

test('Stop photo safeguard check - requires confirmation when photos are missing', () => {
  const shouldPromptMissingPhotoModal = (photos?: Array<{ id: string; url: string }>) => {
    return !photos || photos.length === 0;
  };

  // Case 1: Stop has no photos array -> must prompt safeguard modal
  assert.equal(shouldPromptMissingPhotoModal(undefined), true);

  // Case 2: Stop has empty photos array -> must prompt safeguard modal
  assert.equal(shouldPromptMissingPhotoModal([]), true);

  // Case 3: Stop has 1 or more photos -> can complete directly without modal
  assert.equal(
    shouldPromptMissingPhotoModal([
      { id: 'ph_1', url: 'https://example.com/photo1.jpg' },
    ]),
    false
  );

  assert.equal(
    shouldPromptMissingPhotoModal([
      { id: 'ph_1', url: 'https://example.com/photo1.jpg' },
      { id: 'ph_2', url: 'https://example.com/photo2.jpg' },
    ]),
    false
  );
});
