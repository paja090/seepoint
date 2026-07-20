const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const photos = await prisma.photo.findMany({ take: 20 });
  console.log('Total photos in DB:', photos.length);
  console.log('Sample photos:', JSON.stringify(photos, null, 2));

  const navPoints = await prisma.navigationPoint.findMany({
    take: 10,
    include: {
      carrier: {
        include: {
          photos: true,
          surfaces: {
            include: { photos: true },
          },
        },
      },
    },
  });
  console.log('NavPoints count:', navPoints.length);
  console.log('NavPoints with photos:', JSON.stringify(navPoints, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
