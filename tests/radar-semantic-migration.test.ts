import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('additive radar migration preserves historical opportunities and articles with tenant-safe source identity', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "SalesOpportunity" (id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "companyName" TEXT, city TEXT, region TEXT, address TEXT, "eventType" TEXT, summary TEXT, "sourceUrl" TEXT, "sourceTitle" TEXT, "sourcePublishedAt" TIMESTAMP, "radarSignalId" TEXT, "createdAt" TIMESTAMP DEFAULT now(), "updatedAt" TIMESTAMP DEFAULT now());
      CREATE TABLE "RadarSignal" (id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "sourceUrl" TEXT NOT NULL, "sourceTitle" TEXT, "sourcePublishedAt" TIMESTAMP, status TEXT, "parsedData" JSONB, "discoveredOpportunityId" TEXT, "createdAt" TIMESTAMP DEFAULT now(), "updatedAt" TIMESTAMP DEFAULT now(), UNIQUE("organizationId", "sourceUrl"));
      INSERT INTO "SalesOpportunity" (id,"organizationId","companyName",city,"eventType",summary,"sourceUrl","sourceTitle","radarSignalId") VALUES
      ('a1','a','ČEZ','Kadaň','EXPANSION','První zpráva','https://example.test/1','A','s1'),
      ('a2','a','ČEZ','Kadaň','EXPANSION','Druhá zpráva','https://example.test/2','B',null),
      ('a3','a','ČEZ','Kadaň','EXPANSION','Historická duplicita URL','https://example.test/1','A kopie',null),
      ('b1','b','ČEZ','Kadaň','EXPANSION','Jiná organizace','https://example.test/1','B tenant',null);
      INSERT INTO "RadarSignal" (id,"organizationId","sourceUrl","sourceTitle","discoveredOpportunityId") VALUES ('s1','a','https://example.test/1','A','a1'),('s2','a','https://example.test/extra','Další článek','a1');`);
    const migration = readFileSync(new URL('../prisma/migrations/20260917120000_radar_semantic_sources/migration.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    assert.equal((await db.query('SELECT id FROM "SalesOpportunity"')).rows.length, 4, 'no historical opportunity removed');
    assert.equal((await db.query('SELECT id FROM "RadarSignal"')).rows.length, 4, 'reuse two source rows and add two distinct tenant URLs');
    assert.deepEqual((await db.query('SELECT "canonicalOpportunityId" FROM "RadarSignal" WHERE id=\'s2\'')).rows, [{ canonicalOpportunityId: 'a1' }]);
    assert.deepEqual((await db.query('SELECT "normalizedCompany", "normalizedCity" FROM "SalesOpportunity" WHERE id=\'a1\'')).rows, [{ normalizedCompany: 'cez', normalizedCity: 'kadan' }]);
    assert.equal((await db.query('SELECT id FROM "SalesOpportunity" WHERE "mergedIntoId" IS NOT NULL')).rows.length, 0);
    await assert.rejects(db.exec(`UPDATE "RadarSignal" SET "canonicalOpportunityId"='b1' WHERE id='s1'`), /foreign key/);
    await assert.rejects(db.exec(`INSERT INTO "RadarSignal" (id,"organizationId","sourceUrl") VALUES ('duplicate','a','https://example.test/1')`), /unique constraint/);
    await assert.rejects(db.exec(`DELETE FROM "SalesOpportunity" WHERE id='a1'`), /foreign key/);
    // Backfill statements can be rerun independently without multiplying records.
    await db.exec(migration.slice(migration.indexOf('-- Additive backfill only:')));
    assert.equal((await db.query('SELECT id FROM "RadarSignal"')).rows.length, 4);
  } finally { await db.close(); }
});
