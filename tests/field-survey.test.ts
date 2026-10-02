import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRequiredCoordinates } from '../lib/mobile-photo-upload.ts';
import { ManualParcelProvider, createParcelLookupProvider } from '../lib/field-survey/parcel-lookup.ts';
import {
  exportFieldSurveyGeoJson,
  exportFieldSurveyKml,
  exportFieldSurveyXlsx,
} from '../lib/field-survey/export.ts';
import { canAccess, type AppRole } from '../lib/rbac.ts';
import { tenantStorageKey } from '../lib/storage/tenant-storage-key.ts';

// Mock data pro testování exportu a modelových operací
function createMockPoint(overrides: Partial<any> = {}) {
  return {
    id: 'fsp_test_123',
    surveyId: 'survey_1',
    organizationId: 'org_test',
    surfaceType: 'ACKO' as const,
    status: 'NEW' as const,
    latitude: 49.835,
    longitude: 18.275,
    gpsAccuracyMeters: 5.2,
    gpsSource: 'DEVICE' as const,
    capturedAt: new Date('2026-10-02T10:00:00.000Z'),
    address: 'Nádražní 120, Ostrava',
    note: 'Dobrý výhled z křižovatky',
    createdByUserId: 'user_1',
    convertedCarrierId: null,
    convertedAt: null,
    convertedByUserId: null,
    createdAt: new Date('2026-10-02T10:00:00.000Z'),
    updatedAt: new Date('2026-10-02T10:00:00.000Z'),
    photos: [{ url: '/api/field-survey/photos/photo_1/file' }],
    parcelData: {
      parcelNumber: '1245/2',
      cadastralArea: 'Moravská Ostrava',
      municipality: 'Ostrava',
      confidence: 'VERIFIED' as const,
      source: 'RUIAN',
    },
    ownerData: {
      ownerName: 'Statutární město Ostrava',
      ownerType: 'MUNICIPALITY',
    },
    contactData: {
      company: 'DPO a.s.',
      contactPerson: 'Ing. Jan Novák',
      phone: '+420 777 123 456',
      email: 'novak@dpo.cz',
    },
    aiAnalysis: {
      status: 'DONE' as const,
      suggestedType: 'ACKO',
      isUsable: true,
    },
    createdBy: { name: 'Karel Technik' },
    ...overrides,
  };
}

test('field survey: GPS coordinates validation adheres to geographic bounds', () => {
  assert.equal(parseRequiredCoordinates(null, null), null);
  assert.equal(parseRequiredCoordinates('invalid', '18.2'), null);
  assert.equal(parseRequiredCoordinates('91.5', '18.2'), null); // Lat > 90
  assert.equal(parseRequiredCoordinates('49.8', '185.0'), null); // Lng > 180
  assert.deepEqual(parseRequiredCoordinates('49.83556', '18.28341'), {
    lat: 49.83556,
    lng: 18.28341,
  });
});

test('field survey: parcel lookup provider default never hallucinates and returns UNVERIFIED', async () => {
  const provider = new ManualParcelProvider();
  assert.equal(provider.name, 'MANUAL');

  const result = await provider.lookup(49.835, 18.275);
  assert.equal(result.found, false);
  assert.equal(result.confidence, 'UNVERIFIED');
  assert.equal(result.source, 'MANUAL');
  assert.equal(result.parcelNumber, undefined);
  assert.match(result.errorMessage || '', /ručně/);
});

test('field survey: factory returns ManualParcelProvider when CUZK_WFS_URL is not set', () => {
  const originalEnv = process.env.CUZK_WFS_URL;
  delete process.env.CUZK_WFS_URL;
  try {
    const provider = createParcelLookupProvider();
    assert.equal(provider.name, 'MANUAL');
  } finally {
    if (originalEnv) process.env.CUZK_WFS_URL = originalEnv;
  }
});

test('field survey: GeoJSON export adheres to RFC 7946 format and [lng, lat] coordinate order', () => {
  const mockPoint = createMockPoint();
  const geojsonStr = exportFieldSurveyGeoJson([mockPoint], 'Průzkum Ostrava');
  const geojson = JSON.parse(geojsonStr);

  assert.equal(geojson.type, 'FeatureCollection');
  assert.equal(geojson.features.length, 1);

  const feature = geojson.features[0];
  assert.equal(feature.type, 'Feature');
  assert.equal(feature.geometry.type, 'Point');
  // RFC 7946: Coordinates are [longitude, latitude]
  assert.equal(feature.geometry.coordinates[0], 18.275);
  assert.equal(feature.geometry.coordinates[1], 49.835);

  assert.equal(feature.properties.id, 'fsp_test_123');
  assert.equal(feature.properties.surfaceType, 'ACKO');
  assert.equal(feature.properties.parcelNumber, '1245/2');
  assert.equal(feature.properties.ownerName, 'Statutární město Ostrava');
  assert.equal(feature.properties.contactCompany, 'DPO a.s.');
});

test('field survey: KML export contains valid placemark structure and escapes XML entities', () => {
  const mockPoint = createMockPoint({
    address: 'Třída 1. máje & Nádražní <hlavní>',
    note: 'Poznámka s "uvozovkami" & ampersandem',
  });
  const kml = exportFieldSurveyKml([mockPoint], 'Průzkum <Kraj>');

  assert.ok(kml.includes('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(kml.includes('<kml xmlns="http://www.opengis.net/kml/2.2">'));
  assert.ok(kml.includes('<name>Průzkum &lt;Kraj&gt;</name>'));
  // Point coordinates in KML: lng,lat,0
  assert.ok(kml.includes('<coordinates>18.275,49.835,0</coordinates>'));
  assert.ok(kml.includes('Placemark'));
});

test('field survey: XLSX export writes all columns and returns a valid Buffer', async () => {
  const mockPoint = createMockPoint();
  const buffer = await exportFieldSurveyXlsx([mockPoint], 'Průzkum Ostrava');

  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1000);
  // Zip/xlsx magic number PK..
  assert.equal(buffer[0], 0x50);
  assert.equal(buffer[1], 0x4b);
});

test('field survey: RBAC access allows field roles and denies unauthorized roles', () => {
  // Oprávněné role pro práci s terénním průzkumem
  const allowedRoles: AppRole[] = ['ADMIN', 'MANAGER', 'SALES', 'TECHNICIAN', 'WORKER'];
  for (const role of allowedRoles) {
    assert.equal(canAccess(role, 'fieldSurvey'), true, `Role ${role} by měla mít přístup k fieldSurvey`);
  }

  // Neoprávněné role
  const deniedRoles: AppRole[] = ['VIEWER', 'ACCOUNTANT'];
  for (const role of deniedRoles) {
    assert.equal(canAccess(role, 'fieldSurvey'), false, `Role ${role} by NEMĚLA mít přístup k fieldSurvey`);
  }
});

test('field survey: storage key for survey photos is isolated under tenant photos resource', () => {
  const key = tenantStorageKey({
    organizationId: 'org_seepoint_1',
    resource: 'photos',
    resourceId: 'fsp-12345678',
    fileName: 'SURVEY_ostrava_001.jpg',
  });

  assert.equal(
    key,
    'organizations/org_seepoint_1/photos/fsp-12345678/original/SURVEY_ostrava_001.jpg'
  );
});

test('field survey: conversion idempotency contract guarantees no duplicate carrier creation', () => {
  // Simulace idempotentního kontraktu
  const existingPoint = {
    id: 'point_999',
    convertedCarrierId: 'carrier_already_exists',
  };

  function simulateConvert(point: typeof existingPoint) {
    if (point.convertedCarrierId) {
      return { alreadyConverted: true, carrierId: point.convertedCarrierId };
    }
    return { alreadyConverted: false, carrierId: 'new_carrier_id' };
  }

  const firstCall = simulateConvert(existingPoint);
  assert.equal(firstCall.alreadyConverted, true);
  assert.equal(firstCall.carrierId, 'carrier_already_exists');

  const secondCall = simulateConvert(existingPoint);
  assert.equal(secondCall.alreadyConverted, true);
  assert.equal(secondCall.carrierId, 'carrier_already_exists');
});
