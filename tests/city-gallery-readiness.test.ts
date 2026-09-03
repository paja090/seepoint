import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  assertCityGalleryActivation,
  assertCityGalleryStatusTransition,
  CityGalleryValidationError,
  parseCityGalleryFleetInput,
  parseCityGalleryProjectInput,
} from '../lib/city-gallery-policy.js';

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('project data validates capacity fields, dates and active permit', () => {
  assert.throws(() => parseCityGalleryProjectInput({ title: 'Test', frameCount: 1.5 }), CityGalleryValidationError);
  assert.throws(() => parseCityGalleryProjectInput({ title: 'Test', status: 'UNKNOWN' }), CityGalleryValidationError);
  assert.throws(() => parseCityGalleryProjectInput({ title: 'Test', status: 'ACTIVE', permitStatus: 'SUBMITTED' }), CityGalleryValidationError);
  assert.throws(() => parseCityGalleryProjectInput({ title: 'Test', permitValidFrom: '2026-10-02', permitValidTo: '2026-10-01' }), CityGalleryValidationError);
  const valid = parseCityGalleryProjectInput({
    title: ' Bezpečný projekt ',
    status: 'PLANNED',
    frameCount: 6,
    permitStatus: 'SUBMITTED',
  });
  assert.equal(valid.title, 'Bezpečný projekt');
  assert.equal(valid.frameCount, 6);
});

test('status workflow releases frames through completion and blocks reopening archive', () => {
  assert.doesNotThrow(() => assertCityGalleryStatusTransition('ACTIVE', 'COMPLETED'));
  assert.doesNotThrow(() => assertCityGalleryStatusTransition('COMPLETED', 'ARCHIVED'));
  assert.throws(() => assertCityGalleryStatusTransition('ARCHIVED', 'ACTIVE'), CityGalleryValidationError);
  assert.throws(() => assertCityGalleryStatusTransition('DRAFT', 'ACTIVE'), CityGalleryValidationError);
});

test('activation requires approved and current dated permit', () => {
  assert.throws(() => assertCityGalleryActivation({ permitStatus: 'APPROVED', permitValidFrom: null, permitValidTo: null }), CityGalleryValidationError);
  assert.throws(() => assertCityGalleryActivation({ permitStatus: 'APPROVED', permitValidFrom: new Date('2020-01-01'), permitValidTo: new Date('2020-01-02') }), CityGalleryValidationError);
  assert.throws(() => assertCityGalleryActivation({ permitStatus: 'APPROVED', permitValidFrom: new Date('2098-01-01'), permitValidTo: new Date('2099-01-01') }), CityGalleryValidationError);
  assert.doesNotThrow(() => assertCityGalleryActivation({ permitStatus: 'APPROVED', permitValidFrom: new Date('2026-01-01'), permitValidTo: new Date('2099-01-01') }));
});

test('fleet input rejects decimals and maintenance above total', () => {
  assert.deepEqual(parseCityGalleryFleetInput({ totalFrames: 24, maintenanceCount: 3 }), { totalFrames: 24, maintenanceCount: 3 });
  assert.throws(() => parseCityGalleryFleetInput({ totalFrames: 24.5, maintenanceCount: 0 }), CityGalleryValidationError);
  assert.throws(() => parseCityGalleryFleetInput({ totalFrames: 10, maintenanceCount: 11 }), CityGalleryValidationError);
});

test('capacity mutations are tenant-scoped and serializable', () => {
  const projects = source('app/api/city-gallery/projects/route.ts');
  const project = source('app/api/city-gallery/projects/[id]/route.ts');
  const fleet = source('app/api/city-gallery/fleet/route.ts');
  for (const route of [projects, project, fleet]) {
    assert.match(route, /requireApiAccess\('cityGallery'\)/);
    assert.match(route, /organizationId: auth\.organizationId/);
    assert.match(route, /runTransactionWithRetry/);
    assert.match(route, /tenantSingletonId\('city-gallery-fleet', auth\.organizationId\)/);
  }
  assert.match(fleet, /occupiedFrames \+ input\.maintenanceCount > input\.totalFrames/);
  assert.match(project, /assertCityGalleryStatusTransition/);
});

test('City Gallery offer validates server input and excludes archived projects', () => {
  const service = source('lib/offers/specialized.ts');
  const page = source('app/offers/new/city-gallery/page.tsx');
  assert.match(service, /Kontaktní e-mail není platný/);
  assert.match(service, /status: \{ not: 'ARCHIVED' \}/);
  assert.match(service, /organizationId: user\.organizationId/);
  assert.match(page, /initialProjectId/);
});
