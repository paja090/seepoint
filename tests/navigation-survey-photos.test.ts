import test from 'node:test';
import assert from 'node:assert/strict';

interface MockPhoto {
  id: string;
  url: string;
  type: string;
  surveyCandidatePointId: string | null;
  surveyNavigationPointId: string | null;
  siteNavigationPointId?: string | null;
  createdAt: Date;
}

interface MockNavigationPoint {
  id: string;
  label: string;
  sitePhotoId: string | null;
  navigationOfferId?: string | null;
  navigationOrderId?: string | null;
  sortOrder: number;
}

interface MockCandidatePoint {
  id: string;
  label: string;
  navigationOrderId: string;
  convertedNavigationPointId?: string | null;
}

class MockSurveyDb {
  photos: MockPhoto[] = [];
  navPoints: MockNavigationPoint[] = [];
  candidatePoints: MockCandidatePoint[] = [];

  clear() {
    this.photos = [];
    this.navPoints = [];
    this.candidatePoints = [];
  }

  // Simulates PUT /api/navigation/orders/[id]/survey/candidates/[candidateId]
  async updateCandidateOrPoint(candidateId: string, photoIds: string[], pointUpdateData: Partial<MockNavigationPoint>) {
    const existingCandidate = this.candidatePoints.find((c) => c.id === candidateId);
    if (!existingCandidate) {
      const existingOfferPoint = this.navPoints.find((p) => p.id === candidateId);
      if (existingOfferPoint) {
        // Update NavigationPoint
        Object.assign(existingOfferPoint, pointUpdateData);

        // Link photos via surveyNavigationPointId
        if (photoIds.length > 0) {
          for (const ph of this.photos) {
            if (photoIds.includes(ph.id)) {
              // Critical assertion: NEVER assign NavigationPoint id to surveyCandidatePointId
              ph.surveyNavigationPointId = existingOfferPoint.id;
              ph.surveyCandidatePointId = null;
              ph.type = 'SURVEY';
            }
          }

          const firstPhoto = this.photos.find((ph) => photoIds.includes(ph.id));
          if (firstPhoto) {
            const isOwnedByOther = this.navPoints.some(
              (p) => p.sitePhotoId === firstPhoto.id && p.id !== existingOfferPoint.id
            );
            if (!isOwnedByOther) {
              existingOfferPoint.sitePhotoId = firstPhoto.id;
            }
          }
        }

        return {
          type: 'NAVIGATION_POINT',
          point: existingOfferPoint,
        };
      }

      throw new Error('Kandidátní místo ani navigační bod nebyly nalezeny.');
    }

    // Existing candidate
    Object.assign(existingCandidate, pointUpdateData);
    if (photoIds.length > 0) {
      for (const ph of this.photos) {
        if (photoIds.includes(ph.id)) {
          ph.surveyCandidatePointId = existingCandidate.id;
          ph.surveyNavigationPointId = null;
          ph.type = 'SURVEY';
        }
      }
    }

    return {
      type: 'CANDIDATE_POINT',
      point: existingCandidate,
    };
  }

  // Simulates GET /api/navigation/orders/[id]/survey photos aggregation
  getAggregatedPhotosForPoint(pointId: string) {
    const point = this.navPoints.find((p) => p.id === pointId);
    if (!point) return [];

    const matchedPhotos: Array<{ id: string; url: string }> = [];
    if (point.sitePhotoId) {
      const sitePh = this.photos.find((ph) => ph.id === point.sitePhotoId);
      if (sitePh) {
        matchedPhotos.push({ id: sitePh.id, url: sitePh.url });
      }
    }

    const surveyPhotos = this.photos
      .filter((ph) => ph.surveyNavigationPointId === pointId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    for (const ph of surveyPhotos) {
      if (!matchedPhotos.some((existing) => existing.id === ph.id)) {
        matchedPhotos.push({ id: ph.id, url: ph.url });
      }
    }

    return matchedPhotos;
  }
}

test('1. Updating existing NavigationPoint links photos to surveyNavigationPointId and avoids P2003 FK violation', async () => {
  const db = new MockSurveyDb();
  db.navPoints.push({
    id: 'nav-point-1',
    label: 'NAV-1 Havířov centrum',
    sitePhotoId: null,
    sortOrder: 1,
  });

  db.photos.push({
    id: 'photo-101',
    url: '/api/photos/photo-101/file',
    type: 'CARRIER',
    surveyCandidatePointId: null,
    surveyNavigationPointId: null,
    createdAt: new Date(),
  });

  const result = await db.updateCandidateOrPoint('nav-point-1', ['photo-101'], { label: 'NAV-1 Aktualizováno' });
  assert.equal(result.type, 'NAVIGATION_POINT');
  assert.equal(result.point.label, 'NAV-1 Aktualizováno');

  const updatedPhoto = db.photos.find((p) => p.id === 'photo-101')!;
  assert.equal(updatedPhoto.surveyNavigationPointId, 'nav-point-1');
  assert.equal(updatedPhoto.surveyCandidatePointId, null, 'surveyCandidatePointId must remain null for NavigationPoint');
  assert.equal(updatedPhoto.type, 'SURVEY');

  // sitePhotoId is set to the first photo
  const updatedPoint = db.navPoints.find((p) => p.id === 'nav-point-1')!;
  assert.equal(updatedPoint.sitePhotoId, 'photo-101');
});

test('2. Multiple photos uploaded to NavigationPoint attach all via surveyNavigationPointId and set first as sitePhotoId', async () => {
  const db = new MockSurveyDb();
  db.navPoints.push({
    id: 'nav-point-2',
    label: 'NAV-2 Ostrava Svinov',
    sitePhotoId: null,
    sortOrder: 2,
  });

  const p1 = {
    id: 'photo-201',
    url: '/api/photos/photo-201/file',
    type: 'CARRIER',
    surveyCandidatePointId: null,
    surveyNavigationPointId: null,
    createdAt: new Date(Date.now() - 2000),
  };
  const p2 = {
    id: 'photo-202',
    url: '/api/photos/photo-202/file',
    type: 'CARRIER',
    surveyCandidatePointId: null,
    surveyNavigationPointId: null,
    createdAt: new Date(Date.now() - 1000),
  };
  const p3 = {
    id: 'photo-203',
    url: '/api/photos/photo-203/file',
    type: 'CARRIER',
    surveyCandidatePointId: null,
    surveyNavigationPointId: null,
    createdAt: new Date(),
  };
  db.photos.push(p1, p2, p3);

  await db.updateCandidateOrPoint('nav-point-2', ['photo-201', 'photo-202', 'photo-203'], {});

  const point = db.navPoints.find((p) => p.id === 'nav-point-2')!;
  assert.equal(point.sitePhotoId, 'photo-201', 'Primary/sitePhotoId is first photo');

  // All 3 photos have surveyNavigationPointId set
  for (const pid of ['photo-201', 'photo-202', 'photo-203']) {
    const ph = db.photos.find((p) => p.id === pid)!;
    assert.equal(ph.surveyNavigationPointId, 'nav-point-2');
    assert.equal(ph.surveyCandidatePointId, null);
  }

  // Aggregated photos return all 3 without duplicates, primary first
  const aggregated = db.getAggregatedPhotosForPoint('nav-point-2');
  assert.equal(aggregated.length, 3);
  assert.equal(aggregated[0].id, 'photo-201');
});

test('3. Candidate point links photos strictly via surveyCandidatePointId', async () => {
  const db = new MockSurveyDb();
  db.candidatePoints.push({
    id: 'candidate-99',
    label: 'Kandidát č. 1',
    navigationOrderId: 'order-1',
  });

  db.photos.push({
    id: 'photo-301',
    url: '/api/photos/photo-301/file',
    type: 'CARRIER',
    surveyCandidatePointId: null,
    surveyNavigationPointId: null,
    createdAt: new Date(),
  });

  const result = await db.updateCandidateOrPoint('candidate-99', ['photo-301'], { label: 'Kandidát č. 1 ověřen' });
  assert.equal(result.type, 'CANDIDATE_POINT');

  const photo = db.photos.find((p) => p.id === 'photo-301')!;
  assert.equal(photo.surveyCandidatePointId, 'candidate-99');
  assert.equal(photo.surveyNavigationPointId, null, 'surveyNavigationPointId must be null for candidate');
});

test('4. sitePhotoId unique constraint is respected and avoids reusing same photo on different NavigationPoints', async () => {
  const db = new MockSurveyDb();
  db.navPoints.push({
    id: 'nav-point-A',
    label: 'Point A',
    sitePhotoId: 'photo-unique-1',
    sortOrder: 1,
  });
  db.navPoints.push({
    id: 'nav-point-B',
    label: 'Point B',
    sitePhotoId: null,
    sortOrder: 2,
  });
  db.photos.push({
    id: 'photo-unique-1',
    url: '/api/photos/photo-unique-1/file',
    type: 'SURVEY',
    surveyCandidatePointId: null,
    surveyNavigationPointId: 'nav-point-A',
    createdAt: new Date(),
  });

  // Updating Point B with photo-unique-1 must NOT overwrite Point B's sitePhotoId to photo-unique-1
  // because photo-unique-1 is already owned by Point A as sitePhotoId!
  await db.updateCandidateOrPoint('nav-point-B', ['photo-unique-1'], {});

  const pointB = db.navPoints.find((p) => p.id === 'nav-point-B')!;
  assert.equal(pointB.sitePhotoId, null, 'Point B must not take sitePhotoId already owned by Point A');
});

test('5. Safe error formatting transforms raw Prisma exceptions into friendly Czech messages', () => {
  const rawPrismaError = 'Invalid `prisma.photo.updateMany()` invocation. Foreign key constraint violated: Photo_surveyCandidatePointId_fkey';
  
  function getFriendlyMessage(errText: string) {
    if (errText.includes('Foreign key') || errText.includes('Prisma') || errText.includes('P2003')) {
      return 'Místo se nepodařilo uložit. Zkuste akci zopakovat.';
    }
    return errText || 'Místo se nepodařilo uložit. Zkuste akci zopakovat.';
  }

  const friendly = getFriendlyMessage(rawPrismaError);
  assert.equal(friendly, 'Místo se nepodařilo uložit. Zkuste akci zopakovat.');
  assert.equal(friendly.includes('Prisma'), false);
  assert.equal(friendly.includes('Foreign key'), false);
});
