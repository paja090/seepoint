import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('regular photo upload returns metadata without re-reading stored database image bytes', () => {
  const source = read('app/api/photos/route.ts');
  assert.match(source, /const created = await tx\.photo\.create\(\{[\s\S]*?omit:\s*\{\s*content:\s*true\s*\}/);
  assert.match(source, /return NextResponse\.json\(\{ \.\.\.photo, storageWarning: storage\.warning \}/);
  assert.match(source, /content:\s*storage\.storageProvider === 'DATABASE'/, 'database fallback still stores the image');
});

test('photo PATCH and album sorting do not fetch binary image payloads', () => {
  const source = read('app/api/photos/[id]/route.ts');
  assert.match(source, /const photo = await prisma\.photo\.findUnique\(\{[\s\S]*?omit:\s*\{\s*content:\s*true\s*\}/);
  assert.match(source, /const allPhotos = await tx\.photo\.findMany\(\{[\s\S]*?select:\s*\{\s*id:\s*true\s*\}/);
  assert.match(source, /const sibling = await tx\.photo\.findFirst\(\{[\s\S]*?select:\s*\{\s*id:\s*true\s*\}/);
  assert.match(source, /const updated = await prisma\.photo\.findUnique\(\{\s*where:\s*\{\s*id\s*\},\s*omit:\s*\{\s*content:\s*true\s*\}/);
});

test('authorized file endpoint still selects content for database-backed images', () => {
  const source = read('app/api/photos/[id]/file/route.ts');
  assert.match(source, /content:\s*true/);
  assert.match(source, /canReadPhoto\(user, photo\)/);
});
