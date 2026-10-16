import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCampaignAlbumToken,
  buildCampaignAlbumSlug,
  verifyCampaignAlbumSlug,
} from '../lib/election-removal/album-token';
import { taskSteps, parseTaskSpec } from '../lib/election-removal/task-spec';

describe('Field Work Duplication and Public Album Token Security', () => {
  it('generates consistent HMAC slug for campaign and verifies correctly', () => {
    const campaignId = 'cm89abcdef1234567890';
    const slug = buildCampaignAlbumSlug(campaignId);

    assert.ok(slug.startsWith(`${campaignId}.`));
    assert.equal(verifyCampaignAlbumSlug(slug), campaignId);
  });

  it('rejects tampered or forged album slug signatures', () => {
    const campaignId = 'cm89abcdef1234567890';
    const slug = buildCampaignAlbumSlug(campaignId);

    // Tamper with signature
    const tamperedSlug = slug.slice(0, -1) + (slug.endsWith('a') ? 'b' : 'a');
    assert.equal(verifyCampaignAlbumSlug(tamperedSlug), null);

    // Tamper with campaign ID
    const tamperedIdSlug = `cm89forged9999999999.${slug.split('.')[1]}`;
    assert.equal(verifyCampaignAlbumSlug(tamperedIdSlug), null);

    // Malformed formats
    assert.equal(verifyCampaignAlbumSlug(''), null);
    assert.equal(verifyCampaignAlbumSlug('no-dot-token'), null);
    assert.equal(verifyCampaignAlbumSlug('a.b.c'), null);
  });

  it('builds proper steps when duplicating a point with target operation INSTALL_AD', () => {
    const spec = parseTaskSpec({
      label: 'Bod 1',
      latitude: 50.08,
      longitude: 14.42,
      gpsConfirmed: true,
      operationType: 'INSTALL_AD',
      mediaType: 'BANNER',
      objectType: 'STAND',
      materialDisposition: 'LEAVE',
      quantity: 1,
    });
    const steps = taskSteps(spec);

    assert.equal(steps.length, 1);
    assert.equal(steps[0].photoType, 'AFTER_INSTALLATION');
  });

  it('builds proper steps when duplicating a point with target operation REMOVE_OBJECT', () => {
    const spec = parseTaskSpec({
      label: 'Bod 2',
      latitude: 50.08,
      longitude: 14.42,
      gpsConfirmed: true,
      operationType: 'REMOVE_OBJECT',
      materialDisposition: 'LEAVE',
      mediaType: 'ACKO',
      objectType: 'STAND',
      quantity: 1,
    });
    const steps = taskSteps(spec);

    assert.equal(steps.length, 1);
    assert.equal(steps[0].photoType, 'AFTER_DEINSTALLATION');
  });

  it('builds proper steps when duplicating a point with target operation RELOCATION', () => {
    const spec = parseTaskSpec({
      label: 'Bod 3',
      latitude: 50.08,
      longitude: 14.42,
      gpsConfirmed: true,
      operationType: 'RELOCATION',
      mediaType: 'ACKO',
      objectType: 'STAND',
      quantity: 1,
      materialDisposition: 'TRANSFER',
      destinationName: 'Sklad Brno',
      destinationLatitude: 49.19,
      destinationLongitude: 16.60,
      destinationGpsConfirmed: true,
    });
    const steps = taskSteps(spec);

    assert.ok(steps.length >= 2, 'Relocation requires pickup and placement steps');
  });
});
