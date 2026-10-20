CREATE TABLE "PhotoAlbumSettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL DEFAULT current_setting('app.current_organization_id'::text, true),
  "albumKey" TEXT NOT NULL,
  "publicTitle" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PhotoAlbumSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PhotoAlbumSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PhotoAlbumSettings_organizationId_albumKey_key" ON "PhotoAlbumSettings"("organizationId", "albumKey");
