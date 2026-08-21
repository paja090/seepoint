import fs from 'fs';

const envFile = fs.readFileSync('c:/Users/42077/Documents/seepoint/.env.production.local', 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) {
    let key = match[1];
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
});

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  
  const brandKeywords = ['kfc', 'lidl', 'penny', 'globus', 'kaufland', 'mcdonald', 'billa', 'albert'];
  
  const carriers = await prisma.carrier.findMany({
    where: {
      OR: brandKeywords.map(kw => ({
        OR: [
          { name: { contains: kw, mode: 'insensitive' } },
          { code: { contains: kw, mode: 'insensitive' } },
        ]
      }))
    },
    include: {
      photos: { select: { id: true, url: true, fileName: true } },
      surfaces: { include: { photos: { select: { id: true, url: true, fileName: true } } } }
    }
  });

  console.log(`Found ${carriers.length} brand carriers.`);
  for (const c of carriers) {
    const photos = [...c.photos, ...c.surfaces.flatMap(s => s.photos)];
    console.log(`Brand Carrier: ${c.name} (${c.code}) in ${c.city}`);
    for (const p of photos) {
      console.log(`   Photo ID: ${p.id} | fileName: ${p.fileName} | url: ${p.url}`);
    }
  }

  const navSurfaces = await prisma.advertisingSurface.count({ where: { mediaType: 'NAVIGATION_SIGN' } });
  console.log('Exact NAVIGATION_SIGN count in DB:', navSurfaces);

  await prisma.$disconnect();
}

main().catch(console.error);
