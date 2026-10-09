import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
test('Academy migration prevents cross-tenant relationships and keeps business tables intact', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE "Organization" (id TEXT PRIMARY KEY); INSERT INTO "Organization" VALUES (\'a\'), (\'b\'); CREATE TABLE "Photo" (id TEXT); INSERT INTO "Photo" VALUES (\'untouched\');');
    await db.exec(readFileSync('prisma/migrations/20261009010000_academy_foundation/migration.sql', 'utf8'));
    await db.exec(`INSERT INTO "AcademyCategory" VALUES ('ca','a','start','Začínáme'),('cb','b','start','Začínáme'); INSERT INTO "AcademyLesson" (id,"organizationId","categoryId",slug) VALUES ('la','a','ca','start');`);
    await assert.rejects(db.exec(`INSERT INTO "AcademyLesson" (id,"organizationId","categoryId",slug) VALUES ('foreign','b','ca','foreign');`), /foreign key/i);
    await db.exec(`INSERT INTO "AcademyLessonRevision" (id,"organizationId","lessonId",version,title,summary,capability,"durationMinutes",content,"sourceCommit","contentHash") VALUES ('ra','a','la',1,'Title','Summary','basics',2,'{}','fixture','hash');`);
    await assert.rejects(db.exec(`INSERT INTO "AcademyFeedback" (id,"organizationId","revisionId","reporterUserId",category,message) VALUES ('fa','b','ra','user','BROKEN','detail');`), /foreign key/i);
    await db.exec(`INSERT INTO "AcademyFeedback" (id,"organizationId","revisionId","reporterUserId",category,message) VALUES ('fa','a','ra','user','BROKEN','detail');`);
    const photos = await db.query('SELECT * FROM "Photo"'); assert.deepEqual(photos.rows, [{ id: 'untouched' }]);
    const revisions = await db.query('SELECT status FROM "AcademyLessonRevision"'); assert.deepEqual(revisions.rows, [{ status: 'PLANNED' }]);
  } finally { await db.close(); }
});
