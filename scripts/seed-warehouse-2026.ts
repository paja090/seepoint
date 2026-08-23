import { PrismaClient, WarehouseItemCategory } from '@prisma/client';
import { getTenantContext, enterTenantContext } from '../lib/tenant-context';
import { tenantPrismaExtension } from '../lib/tenant-prisma';

const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL;
if (!getTenantContext()) enterTenantContext({ organizationId: process.env.ORGANIZATION_ID ?? 'org_seepoint_default', source: 'script' });
const prisma = new PrismaClient(databaseUrl ? { datasourceUrl: databaseUrl } : undefined).$extends(tenantPrismaExtension) as unknown as PrismaClient;

const defaultWarehouseItems = [
  // SPOTŘEBNÍ MATERIÁL (CONSUMABLE)
  {
    name: 'Stahovací pásky černé 500x7.6mm (balení 100ks)',
    code: 'PAS-500-BLK',
    category: 'CONSUMABLE' as WarehouseItemCategory,
    unit: 'balení',
    quantityInStock: 25,
    minQuantity: 10,
    unitPrice: 180,
    location: 'Regál A1 - Plasty',
    supplierName: 'Hornbach / Velkoobchod',
    supplierContact: 'sklad@hornbach.cz',
    note: 'Standardní pásky pro uchycení plachet a minitowerů',
  },
  {
    name: 'Stahovací pásky bílé 300x4.8mm (balení 100ks)',
    code: 'PAS-300-WHT',
    category: 'CONSUMABLE' as WarehouseItemCategory,
    unit: 'balení',
    quantityInStock: 15,
    minQuantity: 5,
    unitPrice: 95,
    location: 'Regál A1 - Plasty',
    supplierName: 'Hornbach',
    note: 'Pásky pro lehčí plakáty a rámečky',
  },
  {
    name: 'Lepidlo na billboardy a postery Den Braven (kbelík 10kg)',
    code: 'LEP-POSTER-10KG',
    category: 'CONSUMABLE' as WarehouseItemCategory,
    unit: 'ks',
    quantityInStock: 8,
    minQuantity: 3,
    unitPrice: 650,
    location: 'Regál B2 - Chemické přípravky',
    supplierName: 'Den Braven ČR',
    supplierContact: 'obchod@denbraven.cz',
    note: 'Speciální voděodolné lepidlo pro lepení papírových bilboardů',
  },
  {
    name: 'Samořezné šrouby s podložkou M4.8x19mm (balení 500ks)',
    code: 'SROUB-M48-19',
    category: 'CONSUMABLE' as WarehouseItemCategory,
    unit: 'balení',
    quantityInStock: 12,
    minQuantity: 4,
    unitPrice: 320,
    location: 'Regál A3 - Spojovací materiál',
    supplierName: 'Würth s.r.o.',
    supplierContact: '731 000 111',
    note: 'Šrouby do plechových rámů a konstrukcí',
  },
  {
    name: 'Kotevní ocelové hmoždinky a šrouby M10x100mm (balení 50ks)',
    code: 'KOTVA-M10-100',
    category: 'CONSUMABLE' as WarehouseItemCategory,
    unit: 'balení',
    quantityInStock: 6,
    minQuantity: 2,
    unitPrice: 580,
    location: 'Regál A3 - Spojovací materiál',
    supplierName: 'Hilti ČR',
    supplierContact: '800 11 22 33',
    note: 'Kotvení minitowerů a městské navigace do betonu',
  },
  {
    name: 'Oboustranná lepící páska 50mm x 50m heavy duty',
    code: 'PAS-OBOUSTRAN-50',
    category: 'CONSUMABLE' as WarehouseItemCategory,
    unit: 'role',
    quantityInStock: 10,
    minQuantity: 4,
    unitPrice: 240,
    location: 'Regál B1 - Pásky',
    supplierName: 'Hornbach',
    note: 'Pro upevňování panelů a city posterů',
  },
  {
    name: 'Ocelové lanko 4mm nerezové (cívka 100m)',
    code: 'LANKO-4MM',
    category: 'CONSUMABLE' as WarehouseItemCategory,
    unit: 'role',
    quantityInStock: 3,
    minQuantity: 1,
    unitPrice: 1250,
    location: 'Regál C1 - Lana a svorky',
    supplierName: 'Velkoobchod lana',
    note: 'Vypínací lanko pro zavěšení velkoplošných plachet',
  },

  // VRATNÉ VYBAVENÍ & NÁŘADÍ (RETURNABLE)
  {
    name: 'Hliníkový trojdílný žebřík 3x11 příček (Krause Profi)',
    code: 'ZEBRIK-3X11',
    category: 'RETURNABLE' as WarehouseItemCategory,
    unit: 'ks',
    quantityInStock: 4,
    minQuantity: 2,
    unitPrice: 6500,
    location: 'Dílna - Stojan na žebříky',
    supplierName: 'Krause ČR',
    note: 'Vratný žebřík pro výjezdy na vysoko zavěšené billboardy',
  },
  {
    name: 'Aku rázový utahovák & vrtačka DeWalt 18V (Sada v kufru)',
    code: 'VRTACKA-DEWALT-1',
    category: 'RETURNABLE' as WarehouseItemCategory,
    unit: 'sada',
    quantityInStock: 3,
    minQuantity: 2,
    unitPrice: 8900,
    location: 'Dílna - Skříň s nářadím',
    supplierName: 'DeWalt prodej',
    note: 'Kufr obsahuje 2x aku 5Ah, nabíječku a sadu bitů',
  },
  {
    name: 'Minitower kovová konstrukce stohovatelná (Sada rámů)',
    code: 'RAM-MINITOWER-SET',
    category: 'RETURNABLE' as WarehouseItemCategory,
    unit: 'sada',
    quantityInStock: 6,
    minQuantity: 2,
    unitPrice: 12000,
    location: 'Venkovní sklad - Sektor M1',
    supplierName: 'Vlastní výroba SeePOINT',
    note: 'Opakovaně použitelná základna pro reklamní minitowery',
  },
  {
    name: 'Sada napínacích ráčen a popruhů 5t (4ks)',
    code: 'POPRUH-RACNA-4KS',
    category: 'RETURNABLE' as WarehouseItemCategory,
    unit: 'sada',
    quantityInStock: 8,
    minQuantity: 3,
    unitPrice: 1400,
    location: 'Dílna - Regal C2',
    supplierName: 'Hornbach',
    note: 'Pro zajištění nákladu na vozících a převoz minitowerů',
  },
];

export async function seedWarehouseItems() {
  let count = 0;
  for (const item of defaultWarehouseItems) {
    const existing = await prisma.warehouseItem.findFirst({
      where: { name: item.name },
    });

    if (!existing) {
      await prisma.warehouseItem.create({ data: item });
      count++;
    }
  }
  return count;
}

if (require.main === module) {
  seedWarehouseItems()
    .then((c) => {
      console.log(`Successfully seeded ${c} warehouse items!`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Warehouse seed error:', err);
      process.exit(1);
    });
}
