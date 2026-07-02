import type { Carrier } from './types';

export const carriers: Carrier[] = [
  {
    id: 'c1',
    name: 'Billboard D1 Průhonice',
    code: 'PHA-D1-001',
    type: 'BILLBOARD',
    latitude: 50.0019,
    longitude: 14.5515,
    gpsStatus: 'VERIFIED',
    address: 'D1 exit 6',
    city: 'Praha',
    region: 'Praha',
    mountingType: 'UNKNOWN',
    status: 'ACTIVE',
    note: 'Prémiová plocha u dálnice.',
    photos: [{ id: 'p1', carrierId: 'c1', url: '/placeholder.svg', type: 'LOCATION' }],
    surfaces: [
      {
        id: 's1',
        carrierId: 'c1',
        name: 'Strana A',
        mediaType: 'BILLBOARD',
        size: '5.1 x 2.4 m',
        orientation: 'směr Brno',
        status: 'OCCUPIED',
        price: 18000,
        occupancies: [{ id: 'o1', surfaceId: 's1', clientName: 'Auto ESA', campaignName: 'Letní akce', dateFrom: '2026-06-01', dateTo: '2026-06-30', status: 'ACTIVE', price: 18000 }],
        photos: [],
      },
      {
        id: 's2',
        carrierId: 'c1',
        name: 'Strana B',
        mediaType: 'BILLBOARD',
        size: '5.1 x 2.4 m',
        orientation: 'směr Praha',
        status: 'AVAILABLE',
        price: 15000,
        occupancies: [],
        photos: [],
      },
    ],
  },
  {
    id: 'c2',
    name: 'Citylight Anděl',
    code: 'PHA-CL-014',
    type: 'CITYLIGHT',
    latitude: 50.0705,
    longitude: 14.4031,
    gpsStatus: 'VERIFIED',
    address: 'Plzeňská 2',
    city: 'Praha',
    region: 'Praha',
    mountingType: 'UNKNOWN',
    status: 'ACTIVE',
    note: 'Vysoký pěší provoz.',
    photos: [],
    surfaces: [{
      id: 's3',
      carrierId: 'c2',
      name: 'CL vitrína',
      mediaType: 'CITYLIGHT',
      size: '118.5 x 175 cm',
      orientation: 'stanice tram',
      status: 'RESERVED',
      price: 9000,
      occupancies: [{ id: 'o2', surfaceId: 's3', clientName: 'Kavárna Metro', campaignName: 'Opening', dateFrom: '2026-07-01', dateTo: '2026-07-31', status: 'RESERVED', price: 9000 }],
      photos: [],
    }],
  },
  {
    id: 'c3',
    name: 'LED Screen Olympia',
    code: 'BRN-LED-007',
    type: 'LED_SCREEN',
    latitude: 49.1466,
    longitude: 16.6348,
    gpsStatus: 'VERIFIED',
    address: 'U Dálnice 777',
    city: 'Brno',
    region: 'JMK',
    mountingType: 'UNKNOWN',
    status: 'MAINTENANCE',
    note: 'Servis panelu.',
    photos: [],
    surfaces: [{
      id: 's4',
      carrierId: 'c3',
      name: 'Hlavní smyčka',
      mediaType: 'LED_SCREEN',
      size: '10 s spot',
      orientation: 'vstup',
      status: 'OUT_OF_SERVICE',
      price: 25000,
      occupancies: [],
      photos: [],
    }],
  },
];

export const surfaceColor = {
  AVAILABLE: '#22c55e',
  OCCUPIED: '#ef4444',
  RESERVED: '#f97316',
  NEGOTIATION: '#f59e0b',
  OUT_OF_SERVICE: '#64748b',
} as const;

export const carrierMapColor = (carrier: Carrier) =>
  carrier.status !== 'ACTIVE'
    ? '#64748b'
    : carrier.surfaces.some((surface) => surface.status === 'OCCUPIED')
      ? '#ef4444'
      : carrier.surfaces.some((surface) => surface.status === 'RESERVED')
        ? '#f97316'
        : '#22c55e';
