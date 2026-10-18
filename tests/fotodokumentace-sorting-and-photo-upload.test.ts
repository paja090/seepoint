import test from 'node:test';
import assert from 'node:assert/strict';

test('Fotodokumentace album sorting prioritizes latest photo capture date', () => {
  interface MockAlbum {
    id: string;
    title: string;
    createdAt: string;
    latestPhotoAt?: string | null;
    photosCount: number;
  }

  const albums: MockAlbum[] = [
    {
      id: 'old-campaign-many-photos',
      title: 'Kampaň před 2 měsíci (mnoho fotek)',
      createdAt: '2026-08-01T10:00:00.000Z',
      latestPhotoAt: '2026-08-05T12:00:00.000Z',
      photosCount: 45,
    },
    {
      id: 'today-campaign-new-photo',
      title: 'Dnešní trasa Poruba (1 nová fotka z terénu)',
      createdAt: '2026-10-18T08:00:00.000Z',
      latestPhotoAt: '2026-10-18T14:15:00.000Z',
      photosCount: 1,
    },
    {
      id: 'yesterday-campaign',
      title: 'Včerejší kampaň',
      createdAt: '2026-10-17T09:00:00.000Z',
      latestPhotoAt: '2026-10-17T16:00:00.000Z',
      photosCount: 10,
    },
    {
      id: 'brand-new-route-no-photos-yet',
      title: 'Právě založená trasa bez fotek',
      createdAt: '2026-10-18T14:30:00.000Z',
      latestPhotoAt: null,
      photosCount: 0,
    },
  ];

  const sorted = [...albums].sort((a, b) => {
    const timeA = a.latestPhotoAt ? new Date(a.latestPhotoAt).getTime() : new Date(a.createdAt).getTime();
    const timeB = b.latestPhotoAt ? new Date(b.latestPhotoAt).getTime() : new Date(b.createdAt).getTime();
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return b.photosCount - a.photosCount;
  });

  // The brand-new route created at 14:30 is at the top because its createdAt (14:30) is the latest activity
  assert.equal(sorted[0].id, 'brand-new-route-no-photos-yet');
  // Today's route with photo taken at 14:15 is second
  assert.equal(sorted[1].id, 'today-campaign-new-photo');
  // Yesterday's campaign with photo at 16:00 is third
  assert.equal(sorted[2].id, 'yesterday-campaign');
  // 2-month old campaign with 45 photos is at the bottom despite high photo count
  assert.equal(sorted[3].id, 'old-campaign-many-photos');
});

test('Photos inside album grid are sorted in descending order by capture date', () => {
  const photos = [
    { id: 'p1', fileName: 'old.jpg', createdAt: '2026-10-18T10:00:00.000Z' },
    { id: 'p2', fileName: 'newest.jpg', createdAt: '2026-10-18T14:20:00.000Z' },
    { id: 'p3', fileName: 'middle.jpg', createdAt: '2026-10-18T12:00:00.000Z' },
  ];

  const sorted = [...photos].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  assert.equal(sorted[0].id, 'p2');
  assert.equal(sorted[1].id, 'p3');
  assert.equal(sorted[2].id, 'p1');
});

test('handlePhotosUpdated correctly recalculates album metrics on upload, rename, and delete', () => {
  interface InternalPhotoItem {
    id: string;
    url: string;
    type: string;
    fileName: string | null;
    createdAt: string;
  }
  interface InternalPoint {
    id: string;
    photos: InternalPhotoItem[];
  }
  interface AlbumState {
    id: string;
    points: InternalPoint[];
    photosCount: number;
    latestPhotoAt: string | null;
    coverPhotoUrl: string | null;
  }

  let album: AlbumState = {
    id: 'campaign-1',
    points: [
      {
        id: 'point-1',
        photos: [
          { id: 'photo-1', url: '/p1.jpg', type: 'CONTROL', fileName: 'orig.jpg', createdAt: '2026-10-18T10:00:00Z' }
        ]
      }
    ],
    photosCount: 1,
    latestPhotoAt: '2026-10-18T10:00:00Z',
    coverPhotoUrl: '/p1.jpg',
  };

  const updateAlbum = (updatedPoints: InternalPoint[]) => {
    const allPhotos = updatedPoints.flatMap((pt) => pt.photos || []);
    const photosCount = allPhotos.length;
    let latestPhotoAt = null;
    if (allPhotos.length > 0) {
      const sortedDates = allPhotos
        .map((p) => new Date(p.createdAt).getTime())
        .filter((t) => !isNaN(t))
        .sort((a, b) => b - a);
      if (sortedDates.length > 0) {
        latestPhotoAt = new Date(sortedDates[0]).toISOString();
      }
    }
    const coverPhotoUrl = allPhotos[0]?.url || null;
    album = {
      ...album,
      points: updatedPoints,
      photosCount,
      latestPhotoAt,
      coverPhotoUrl,
    };
  };

  // 1. Test Upload
  const newPhoto: InternalPhotoItem = {
    id: 'photo-2',
    url: '/p2.jpg',
    type: 'INSTALLATION',
    fileName: 'novy-polep.jpg',
    createdAt: '2026-10-18T12:00:00Z',
  };
  updateAlbum([
    {
      id: 'point-1',
      photos: [newPhoto, ...album.points[0].photos],
    }
  ]);
  assert.equal(album.photosCount, 2);
  assert.equal(album.latestPhotoAt, '2026-10-18T12:00:00.000Z');
  assert.equal(album.coverPhotoUrl, '/p2.jpg');

  // 2. Test Rename
  const renamedPoints = album.points.map((pt) => ({
    ...pt,
    photos: pt.photos.map((ph) => ph.id === 'photo-2' ? { ...ph, fileName: 'prejmenovany.jpg' } : ph),
  }));
  updateAlbum(renamedPoints);
  assert.equal(album.points[0].photos[0].fileName, 'prejmenovany.jpg');
  assert.equal(album.photosCount, 2);

  // 3. Test Delete
  const deletedPoints = album.points.map((pt) => ({
    ...pt,
    photos: pt.photos.filter((ph) => ph.id !== 'photo-2'),
  }));
  updateAlbum(deletedPoints);
  assert.equal(album.photosCount, 1);
  assert.equal(album.latestPhotoAt, '2026-10-18T10:00:00.000Z');
  assert.equal(album.coverPhotoUrl, '/p1.jpg');
});

