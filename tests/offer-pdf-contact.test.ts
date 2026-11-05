import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { formatSalespersonPhone } from '../lib/offers/pdf';

test('formatSalespersonPhone formats various inputs to +420 777 807 717 or normalized Czech mobile', () => {
  assert.equal(formatSalespersonPhone('777807717'), '+420 777 807 717');
  assert.equal(formatSalespersonPhone('+420777807717'), '+420 777 807 717');
  assert.equal(formatSalespersonPhone('777 807 717'), '+420 777 807 717');
  assert.equal(formatSalespersonPhone('+420 777 807 717'), '+420 777 807 717');
  assert.equal(formatSalespersonPhone(null), '+420 777 807 717');
  assert.equal(formatSalespersonPhone(undefined), '+420 777 807 717');
  assert.equal(formatSalespersonPhone(''), '+420 777 807 717');
  assert.equal(formatSalespersonPhone('—'), '+420 777 807 717');
  assert.equal(formatSalespersonPhone('605958363'), '+420 605 958 363');
  assert.equal(formatSalespersonPhone('+420605958363'), '+420 605 958 363');
});

test('Offer PDF: includes Potřebujete poradit block with formatted salesperson phone', () => {
  const pdfPath = path.join(process.cwd(), 'lib/offers/pdf.ts');
  const content = fs.readFileSync(pdfPath, 'utf8');

  assert.match(content, /Potřebujete poradit nebo vybrat jiné pozice\?/, 'PDF should contain advice question');
  assert.match(content, /formatSalespersonPhone\(offer\.salesperson\.phone\)/, 'PDF should format salesperson phone');
  assert.match(content, /safe\(offer\.salesperson\.name \|\| 'Pavel Šubert'\)/, 'PDF should have Pavel Šubert fallback');
  assert.match(content, /safe\(offer\.salesperson\.email \|\| 'subert\.pvel@gmail\.com'\)/, 'PDF should have subert.pvel fallback');
});

test('Offer Presentation: salesperson uses creator phone/email and does not leak client contacts', () => {
  const presPath = path.join(process.cwd(), 'lib/offers/presentation.ts');
  const content = fs.readFileSync(presPath, 'utf8');

  assert.match(content, /phone: offer\.createdBy\.phone \|\| '\+420 777 807 717'/, 'salesperson phone must use createdBy and fallback to +420 777 807 717');
  assert.doesNotMatch(content, /phone: offer\.contactPhone \|\| offer\.createdBy\.phone/, 'salesperson phone must NEVER take client contactPhone');
  assert.doesNotMatch(content, /email: offer\.contactEmail \|\| offer\.createdBy\.email/, 'salesperson email must NEVER take client contactEmail');
});

test('Offer Service: serializeOffer preserves salesperson contact details', () => {
  const servicePath = path.join(process.cwd(), 'lib/offers/service.ts');
  const content = fs.readFileSync(servicePath, 'utf8');

  assert.match(content, /\+420 777 807 717/, 'service.ts should include +420 777 807 717 fallback');
  assert.doesNotMatch(content, /const phone = row\.contactPhone \?\? spEmployee\?\.phone/, 'service.ts must NOT use row.contactPhone as author phone');
});
