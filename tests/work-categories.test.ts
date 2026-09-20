import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_WORK_CATEGORIES,
  WORK_CATEGORY_PRESETS,
  sanitizeWorkCategories,
  type WorkCategory,
} from '../lib/work-categories';

test('DEFAULT_WORK_CATEGORIES obsahuje jak dílnu tak výjezdy a pokrývá základní činnosti', () => {
  assert.ok(DEFAULT_WORK_CATEGORIES.length >= 8);
  const workshop = DEFAULT_WORK_CATEGORIES.filter((c) => c.scope === 'WORKSHOP');
  const field = DEFAULT_WORK_CATEGORIES.filter((c) => c.scope === 'FIELD');

  assert.ok(workshop.length >= 4, 'Dílna má alespoň 4 činnosti');
  assert.ok(field.length >= 3, 'Výjezdy mají alespoň 3 činnosti');

  // Check specific categories requested by user
  assert.ok(DEFAULT_WORK_CATEGORIES.some((c) => c.label.includes('Velkoformátový tisk')));
  assert.ok(DEFAULT_WORK_CATEGORIES.some((c) => c.label.includes('Grafika & DTP')));
  assert.ok(DEFAULT_WORK_CATEGORIES.some((c) => c.label.includes('Kašírování desek')));
  assert.ok(DEFAULT_WORK_CATEGORIES.some((c) => c.label.includes('Expedice & Balení')));
  assert.ok(DEFAULT_WORK_CATEGORIES.some((c) => c.label.includes('Polep výlohy / polep vozidla')));
  assert.ok(DEFAULT_WORK_CATEGORIES.some((c) => c.label.includes('Montáž reklamy / banneru')));
  assert.ok(DEFAULT_WORK_CATEGORIES.some((c) => c.label.includes('Předvýrobní zaměření')));
  assert.ok(DEFAULT_WORK_CATEGORIES.some((c) => c.label.includes('Údržba strojů')));
});

test('WORK_CATEGORY_PRESETS obsahuje všech 5 oborových šablon', () => {
  const keys = Object.keys(WORK_CATEGORY_PRESETS);
  assert.ok(keys.includes('AGENCY'));
  assert.ok(keys.includes('WRAP_STUDIO'));
  assert.ok(keys.includes('OOH_MEDIA'));
  assert.ok(keys.includes('EXPO_EVENTS'));
  assert.ok(keys.includes('PRINT_SHOP'));

  // Wrap studio specific categories
  const wrap = WORK_CATEGORY_PRESETS.WRAP_STUDIO.categories;
  assert.ok(wrap.some((c) => c.label.includes('PPF') && c.scope === 'WORKSHOP'));
  assert.ok(wrap.some((c) => c.label.includes('Tónování') && c.scope === 'WORKSHOP'));
  assert.ok(wrap.some((c) => c.label.includes('Car Wrap') && c.scope === 'FIELD'));

  // OOH specific categories
  const ooh = WORK_CATEGORY_PRESETS.OOH_MEDIA.categories;
  assert.ok(ooh.some((c) => c.label.includes('Výlep') && c.scope === 'FIELD'));
  assert.ok(ooh.some((c) => c.label.includes('Noční kontrola') && c.scope === 'FIELD'));

  // Expo specific categories
  const expo = WORK_CATEGORY_PRESETS.EXPO_EVENTS.categories;
  assert.ok(expo.some((c) => c.label.includes('veletržního stánku') && c.scope === 'FIELD'));
  assert.ok(expo.some((c) => c.label.includes('Elektroinstalace') && c.scope === 'FIELD'));

  // Print shop specific categories
  const print = WORK_CATEGORY_PRESETS.PRINT_SHOP.categories;
  assert.ok(print.some((c) => c.label.includes('UV tisk') && c.scope === 'WORKSHOP'));
  assert.ok(print.some((c) => c.label.includes('CNC') && c.scope === 'WORKSHOP'));
});

test('sanitizeWorkCategories vrací výchozí činnosti při prázdném vstupu', () => {
  assert.deepEqual(sanitizeWorkCategories(null), DEFAULT_WORK_CATEGORIES);
  assert.deepEqual(sanitizeWorkCategories([]), DEFAULT_WORK_CATEGORIES);
  assert.deepEqual(sanitizeWorkCategories('invalid'), DEFAULT_WORK_CATEGORIES);
});

test('sanitizeWorkCategories bezpečně očistí a validuje vlastní položky', () => {
  const custom = [
    {
      key: 'laser_cut',
      label: '  Laserové řezání plexi  ',
      scope: 'WORKSHOP',
      icon: '⚡',
      defaultWorkType: 'INSTALLATION',
    },
    {
      key: 'laser_cut', // Duplicate key
      label: 'Druhé laserování',
      scope: 'INVALID_SCOPE',
      icon: '',
      defaultWorkType: 'INVALID_TYPE',
    },
    {
      // Missing label should be omitted
      key: 'empty',
      label: '   ',
      scope: 'WORKSHOP',
    },
  ];

  const result = sanitizeWorkCategories(custom);
  assert.equal(result.length, 2);

  // First item sanitized
  assert.equal(result[0].key, 'LASER_CUT');
  assert.equal(result[0].label, 'Laserové řezání plexi');
  assert.equal(result[0].scope, 'WORKSHOP');
  assert.equal(result[0].icon, '⚡');
  assert.equal(result[0].defaultWorkType, 'INSTALLATION');

  // Duplicate key deduplicated, invalid scope defaulted to WORKSHOP, invalid workType defaulted to INSTALLATION
  assert.notEqual(result[1].key, 'LASER_CUT');
  assert.ok(result[1].key.startsWith('LASER_CUT_'));
  assert.equal(result[1].label, 'Druhé laserování');
  assert.equal(result[1].scope, 'WORKSHOP');
  assert.equal(result[1].icon, '⚡');
  assert.equal(result[1].defaultWorkType, 'INSTALLATION');
});
