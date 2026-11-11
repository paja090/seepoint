import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGoogleDriveUrl, formatGoogleDriveLabel } from '../lib/work';

test('resolveGoogleDriveUrl handles null, undefined, and empty inputs', () => {
  assert.equal(resolveGoogleDriveUrl(null), null);
  assert.equal(resolveGoogleDriveUrl(undefined), null);
  assert.equal(resolveGoogleDriveUrl(''), null);
  assert.equal(resolveGoogleDriveUrl('   '), null);
});

test('resolveGoogleDriveUrl preserves full https and http URLs', () => {
  assert.equal(
    resolveGoogleDriveUrl('https://drive.google.com/drive/folders/1abcxyz123'),
    'https://drive.google.com/drive/folders/1abcxyz123'
  );
  assert.equal(
    resolveGoogleDriveUrl('http://drive.google.com/drive/folders/1abcxyz123'),
    'http://drive.google.com/drive/folders/1abcxyz123'
  );
  assert.equal(
    resolveGoogleDriveUrl('  https://drive.google.com/drive/u/0/folders/my-folder  '),
    'https://drive.google.com/drive/u/0/folders/my-folder'
  );
});

test('resolveGoogleDriveUrl handles drive.google.com and docs.google.com without scheme', () => {
  assert.equal(
    resolveGoogleDriveUrl('drive.google.com/drive/folders/1abcxyz123'),
    'https://drive.google.com/drive/folders/1abcxyz123'
  );
  assert.equal(
    resolveGoogleDriveUrl('docs.google.com/spreadsheets/d/xyz'),
    'https://docs.google.com/spreadsheets/d/xyz'
  );
});

test('resolveGoogleDriveUrl converts raw Google Drive ID to folders URL', () => {
  const driveId = '1VcssEXqBmRSV0xBkzP23Miadt2zTTR8l';
  assert.equal(
    resolveGoogleDriveUrl(driveId),
    `https://drive.google.com/drive/folders/${driveId}`
  );
});

test('resolveGoogleDriveUrl converts folder names from Google Sheets into Drive search query URLs', () => {
  assert.equal(
    resolveGoogleDriveUrl('04 01 Promed optic 1 ks deinstalace'),
    'https://drive.google.com/drive/search?q=04%2001%20Promed%20optic%201%20ks%20deinstalace'
  );
  assert.equal(
    resolveGoogleDriveUrl('08 12 OKD - Praha, Kozi placek'),
    'https://drive.google.com/drive/search?q=08%2012%20OKD%20-%20Praha%2C%20Kozi%20placek'
  );
  assert.equal(
    resolveGoogleDriveUrl('  PetCenter deinstalace  '),
    'https://drive.google.com/drive/search?q=PetCenter%20deinstalace'
  );
});

test('formatGoogleDriveLabel returns descriptive labels', () => {
  assert.equal(formatGoogleDriveLabel(null), 'Otevřít Google Disk ↗');
  assert.equal(formatGoogleDriveLabel(''), 'Otevřít Google Disk ↗');
  assert.equal(
    formatGoogleDriveLabel('https://drive.google.com/drive/folders/xyz'),
    'Otevřít složku na Google Disku ↗'
  );
  assert.equal(
    formatGoogleDriveLabel('04 01 Promed optic'),
    'Otevřít složku na Disku („04 01 Promed optic“) ↗'
  );
});
