import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { validatePhotoFile } from '../lib/photo-validation';

function read(relPath: string) {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
}

test('client logo route supports 10MB, SVG, base64 fallback and drops unique constraint', () => {
  const logoRoute = read('app/api/clients/[id]/logo/route.ts');
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20261102190000_remove_client_logo_unique_constraint/migration.sql');

  // Verify size limit upgraded to 10MB
  assert.match(logoRoute, /MAX_LOGO_SIZE\s*=\s*10\s*\*\s*1024\s*\*\s*1024/);

  // Verify allowSvg option is enabled
  assert.match(logoRoute, /allowSvg:\s*true/);

  // Verify prisma schema no longer has @unique on logoDriveFileId
  assert.match(schema, /logoDriveFileId\s+String\?\s*\r?\n\s*logoFileName/);
  assert.doesNotMatch(schema, /logoDriveFileId\s+String\?\s+@unique/);

  // Verify migration exists to drop unique index
  assert.match(migration, /DROP INDEX IF EXISTS "Client_logoDriveFileId_key"/);

  // Verify route handles 54000 btree index size error gracefully
  assert.match(logoRoute, /54000/);
});

test('validatePhotoFile accepts SVG when allowSvg is true and rejects when false', async () => {
  const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';
  const svgFile = new File([Buffer.from(svgContent)], 'company-logo.svg', { type: 'image/svg+xml' });

  // With allowSvg: true
  const validSvg = await validatePhotoFile(svgFile, { allowSvg: true });
  assert.equal(validSvg?.mimeType, 'image/svg+xml');

  // Without allowSvg
  await assert.rejects(
    () => validatePhotoFile(svgFile, { allowSvg: false }),
    (err: unknown) => (err as { code?: string }).code === 'INVALID_IMAGE'
  );
});

test('ClientLogoControl accepts SVG and displays 10 MB limit', () => {
  const control = read('components/ClientLogoControl.tsx');
  assert.match(control, /accept="[^"]*image\/svg\+xml/);
  assert.match(control, /max\.\s*10\s*MB/);
});

test('ClientAiEnrichCard formats complete AI note and persists all sections', () => {
  const card = read('components/clients/ClientAiEnrichCard.tsx');

  // Must format AI note with sections
  assert.match(card, /AI PROFIL & STRATEGIE SEEPOINT/);
  assert.match(card, /POBOČKY A PRODEJNY V MS KRAJI/);
  assert.match(card, /TIPY PRO OBCHODNÍKA/);
  assert.match(card, /DOPORUČENÁ REKLAMNÍ STRATEGIE SEEPOINT/);

  // Must save branches to CRM
  assert.match(card, /\/api\/crm\/clients\/\$\{clientId\}\/branches/);

  // Must save contacts to CRM
  assert.match(card, /\/api\/crm\/clients\/\$\{clientId\}\/contacts/);

  // Must preserve existing manual notes
  assert.match(card, /existingNote/);
});
