import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12 || !/[a-zá-ž]/i.test(password) || !/\d/.test(password)) throw new Error('Nastavte SEED_ADMIN_EMAIL a SEED_ADMIN_PASSWORD (min. 12 znaků, písmeno a číslice).');
  const salt = randomBytes(16); const derived = await promisify(scryptCallback)(password, salt, 64); const passwordHash = `scrypt:${salt.toString('base64')}:${derived.toString('base64')}`;
  await prisma.user.upsert({
    where: { email },
    update: { name: process.env.SEED_ADMIN_NAME || 'SeePoint Admin', role: 'ADMIN', status: 'ACTIVE', passwordHash, sessionVersion: { increment: 1 } },
    create: { name: process.env.SEED_ADMIN_NAME || 'SeePoint Admin', email, role: 'ADMIN', status: 'ACTIVE', passwordHash },
  });

  const carriers = [
    { id: 'c1', name: 'Billboard D1 Průhonice', code: 'PHA-D1-001', type: 'BILLBOARD', latitude: 50.0019, longitude: 14.5515, address: 'D1 exit 6', city: 'Praha', region: 'Praha', status: 'ACTIVE', note: 'Prémiová plocha u dálnice.' },
    { id: 'c2', name: 'Citylight Anděl', code: 'PHA-CL-014', type: 'CITYLIGHT', latitude: 50.0705, longitude: 14.4031, address: 'Plzeňská 2', city: 'Praha', region: 'Praha', status: 'ACTIVE', note: 'Vysoký pěší provoz.' },
    { id: 'c3', name: 'LED Screen Olympia', code: 'BRN-LED-007', type: 'LED_SCREEN', latitude: 49.1466, longitude: 16.6348, address: 'U Dálnice 777', city: 'Brno', region: 'JMK', status: 'MAINTENANCE', note: 'Servis panelu.' },
  ];
  for (const carrier of carriers) {
    await prisma.advertisingCarrier.upsert({ where: { id: carrier.id }, update: carrier, create: carrier });
  }

  const surfaces = [
    { id: 's1', carrierId: 'c1', name: 'Strana A', size: '5.1 x 2.4 m', orientation: 'směr Brno', status: 'OCCUPIED', price: 18000 },
    { id: 's2', carrierId: 'c1', name: 'Strana B', size: '5.1 x 2.4 m', orientation: 'směr Praha', status: 'AVAILABLE', price: 15000 },
    { id: 's3', carrierId: 'c2', name: 'CL vitrína', size: '118.5 x 175 cm', orientation: 'stanice tram', status: 'RESERVED', price: 9000 },
    { id: 's4', carrierId: 'c3', name: 'Hlavní smyčka', size: '10 s spot', orientation: 'vstup', status: 'OUT_OF_SERVICE', price: 25000 },
  ];
  for (const surface of surfaces) {
    await prisma.advertisingSurface.upsert({ where: { id: surface.id }, update: surface, create: surface });
  }

  const occupancies = [
    { id: 'o1', surfaceId: 's1', clientName: 'Auto ESA', campaignName: 'Letní akce', dateFrom: new Date('2026-06-01T00:00:00.000Z'), dateTo: new Date('2026-06-30T00:00:00.000Z'), status: 'OCCUPIED', price: 18000 },
    { id: 'o2', surfaceId: 's3', clientName: 'Kavárna Metro', campaignName: 'Opening', dateFrom: new Date('2026-07-01T00:00:00.000Z'), dateTo: new Date('2026-07-31T00:00:00.000Z'), status: 'RESERVED', price: 9000 },
  ];
  for (const occupancy of occupancies) {
    await prisma.occupancy.upsert({ where: { id: occupancy.id }, update: occupancy, create: occupancy });
  }

  await prisma.photo.upsert({
    where: { id: 'p1' },
    update: { carrierId: 'c1', url: '/placeholder.svg', type: 'LOCATION' },
    create: { id: 'p1', carrierId: 'c1', url: '/placeholder.svg', type: 'LOCATION' },
  });
}

main()
  .then(() => console.log('Database seeded successfully.'))
  .finally(async () => prisma.$disconnect());
