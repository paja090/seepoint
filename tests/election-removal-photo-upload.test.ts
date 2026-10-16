import test from 'node:test';
import assert from 'node:assert/strict';
import { safePhotoFileName, validatePhotoFile } from '../lib/photo-validation';
import type { MyRouteStop, MyRouteStopPhoto } from '../lib/field-planning/contracts';

test('photo-validation: accepts valid images and generates safe file names', async () => {
  const dummyJpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'my photo (1).jpg', { type: 'image/jpeg' });
  const validated = await validatePhotoFile(dummyJpeg);
  assert.ok(validated);
  assert.equal(validated.mimeType, 'image/jpeg');

  const safeName = safePhotoFileName(dummyJpeg.name, 'fotodokumentace.jpg');
  assert.equal(safeName, 'my_photo__1_.jpg');
});

test('contracts: MyRouteStop properly accepts photos array and pointPhotoUrl', () => {
  const samplePhoto: MyRouteStopPhoto = {
    id: 'photo-123',
    url: '/api/photos/photo-123/file',
    type: 'AFTER_INSTALLATION',
    createdAt: '2026-10-16T15:30:00.000Z',
  };

  const stop: MyRouteStop = {
    jobId: 'job-1',
    workOrderId: 'camp-1',
    title: 'Lavička BB CALIN',
    clientName: 'BB CALIN',
    instructions: null,
    status: 'PLANNED',
    issueType: null,
    issueNote: null,
    workType: 'ELECTION_REMOVAL',
    startAt: '2026-10-16T08:00:00.000Z',
    endAt: '2026-10-16T08:05:00.000Z',
    location: { latitude: 49.83, longitude: 18.28 },
    taskId: null,
    navigationOrderId: null,
    navigationPointId: null,
    workOrderItemId: null,
    electionRemovalPointId: 'point-1',
    address: 'Nádražní, Ostrava',
    carrier: null,
    pointPhotoUrl: samplePhoto.url,
    photos: [samplePhoto],
  };

  assert.equal(stop.photos?.length, 1);
  assert.equal(stop.photos?.[0].type, 'AFTER_INSTALLATION');
  assert.equal(stop.pointPhotoUrl, samplePhoto.url);
});
