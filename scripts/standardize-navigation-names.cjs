const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function formatDistance(dist) {
  if (!dist) return '';
  if (typeof dist === 'number') {
    if (dist >= 1000) {
      const km = (dist / 1000).toFixed(1).replace('.0', '').replace('.', ',');
      return `${km}km`;
    }
    return `${Math.round(dist)}m`;
  }
  const s = String(dist).trim().toLowerCase();
  const m = s.match(/^([\d.,]+)\s*(m|km)$/i);
  if (m) {
    const num = m[1].replace('.', ',');
    const unit = m[2].toLowerCase();
    return `${num}${unit}`;
  }
  return s;
}

function cleanStreetName(rawStreet, rawAddress, rawCity) {
  let val = rawStreet || rawAddress || rawCity || 'Ostravská';
  val = val.split(',')[0].trim();
  val = val.replace(/\s+\d+\/\d+.*$/, '');
  val = val.replace(/\s+\d+.*$/, '');
  if (/17\.\s*list/i.test(val)) return '17. listopadu';
  if (/collo/i.test(val)) return 'Collo-louky';
  if (/slav[ií]k/i.test(val)) return 'Slavíkova';
  if (/krmel/i.test(val)) return 'Krmelínská';
  return val.trim() || 'Ostravská';
}

function cleanDirectionAndDistance(rawDistAndDir, street, distanceMeters, directionDescription) {
  let text = (rawDistAndDir || '').trim();

  if (/řádek|strana/i.test(text)) {
    text = '';
  }

  if (street && text) {
    const unaccent = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const cleanSt = unaccent(street);
    if (unaccent(text).startsWith(cleanSt)) {
      text = text.slice(cleanSt.length).replace(/^[-–—\s]+/, '').trim();
    }
  }

  if (!text || (street && text.toLowerCase() === street.toLowerCase())) {
    text = directionDescription ? directionDescription.trim() : '';
  }

  text = text
    .replace(/(\d+)\s+m\b/gi, '$1m')
    .replace(/([\d.,]+)\s+km\b/gi, '$1km')
    .replace(/\bdoprava\b/gi, 'vpravo')
    .replace(/\bdoleva\b/gi, 'vlevo')
    .trim();

  if (distanceMeters != null) {
    const formattedDist = formatDistance(distanceMeters);
    if (!text) {
      text = formattedDist;
    } else if (!/\d+\s*(m|km)\b/i.test(text)) {
      text = `${formattedDist} ${text}`;
    }
  }

  return text;
}

async function main() {
  const surfaces = await prisma.advertisingSurface.findMany({
    where: {
      OR: [
        { mediaType: 'NAVIGATION_SIGN' },
        { carrier: { type: 'NAVIGATION' } }
      ]
    },
    select: {
      id: true,
      name: true,
      distanceMeters: true,
      directionDescription: true,
      currentClientId: true,
      currentClient: { select: { id: true, name: true } },
      carrier: {
        select: {
          id: true,
          code: true,
          name: true,
          street: true,
          address: true,
          city: true,
          structureCode: true,
        }
      }
    },
    orderBy: [{ carrier: { city: 'asc' } }, { carrier: { code: 'asc' } }, { name: 'asc' }]
  });

  const clientGroups = new Map();
  for (const s of surfaces) {
    const key = s.currentClientId || `no-client-${s.carrier.id}`;
    if (!clientGroups.has(key)) {
      clientGroups.set(key, []);
    }
    clientGroups.get(key).push(s);
  }

  let totalUpdated = 0;
  for (const [key, group] of clientGroups.entries()) {
    let nextAvailableP = 1;
    const assigned = [];

    for (const s of group) {
      const pMatch = s.name.match(/\bP(\d+)\b/i);
      let pNum = pMatch ? parseInt(pMatch[1], 10) : null;
      assigned.push({ surface: s, pNum });
    }

    const usedNums = new Set(assigned.map(a => a.pNum).filter(Boolean));
    for (const item of assigned) {
      if (!item.pNum) {
        while (usedNums.has(nextAvailableP)) {
          nextAvailableP++;
        }
        item.pNum = nextAvailableP;
        usedNums.add(nextAvailableP);
      }
    }

    assigned.sort((a, b) => a.pNum - b.pNum);

    for (const item of assigned) {
      const s = item.surface;
      const street = cleanStreetName(s.carrier.street, s.carrier.address, s.carrier.city);

      let rawDistDir = '';
      const nameParts = s.name.split(/[-–—]/).map(p => p.trim());
      if (nameParts.length >= 3) {
        rawDistDir = nameParts.slice(2).join(' - ');
      } else if (nameParts.length === 2 && !nameParts[1].startsWith('řádek')) {
        rawDistDir = nameParts[1];
      }

      const distAndDir = cleanDirectionAndDistance(rawDistDir, street, s.distanceMeters, s.directionDescription);

      const newName = distAndDir
        ? `P${item.pNum} - ${street} - ${distAndDir}`
        : `P${item.pNum} - ${street}`;

      if (s.name !== newName) {
        await prisma.advertisingSurface.update({
          where: { id: s.id },
          data: { name: newName }
        });

        totalUpdated++;
        if (totalUpdated % 25 === 0) {
          console.log(`Updated ${totalUpdated} surfaces...`);
        }
      }
    }
  }

  console.log(`Done! Successfully standardized ${totalUpdated} of ${surfaces.length} navigation surfaces in database.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
