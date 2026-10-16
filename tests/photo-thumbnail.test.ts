import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';

test('Photo thumbnail: sharp converts image buffer to small WebP under 400x400', async () => {
  // Create a large 1920x1080 mock image
  const largeImage = await sharp({
    create: {
      width: 1920,
      height: 1080,
      channels: 3,
      background: { r: 100, g: 150, b: 200 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();

  assert.ok(largeImage.length > 5000, 'Original image should be substantial size');

  // Resize via sharp (same logic as thumbnail route)
  const thumbnail = await sharp(largeImage)
    .rotate()
    .resize({
      width: 400,
      height: 400,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();

  // Inspect resized dimensions
  const meta = await sharp(thumbnail).metadata();
  assert.equal(meta.format, 'webp');
  assert.ok(meta.width! <= 400, `Width should be <= 400, was ${meta.width}`);
  assert.ok(meta.height! <= 400, `Height should be <= 400, was ${meta.height}`);
  assert.ok(thumbnail.length < largeImage.length, 'Thumbnail should be significantly smaller in bytes');
});
