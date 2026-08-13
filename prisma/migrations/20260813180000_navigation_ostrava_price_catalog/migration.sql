ALTER TABLE "OfferPriceRule" ADD COLUMN "mountingType" "MountingType";

CREATE INDEX "OfferPriceRule_pricingSegment_mediaType_mountingType_category_active_idx"
  ON "OfferPriceRule"("pricingSegment", "mediaType", "mountingType", "category", "active");

-- Starší importy mají typ konstrukce v textovém structureCode, ale mountingType zůstal UNKNOWN.
UPDATE "AdvertisingCarrier" SET "mountingType" = 'TRACTION'
WHERE "type" = 'NAVIGATION' AND "mountingType" = 'UNKNOWN' AND LOWER(COALESCE("structureCode", '')) LIKE '%trakc%';
UPDATE "AdvertisingCarrier" SET "mountingType" = 'COLUMN'
WHERE "type" = 'NAVIGATION' AND "mountingType" = 'UNKNOWN' AND (LOWER(COALESCE("structureCode", '')) LIKE '%sloupek%' OR LOWER(COALESCE("structureCode", '')) LIKE '%patka%');
UPDATE "AdvertisingCarrier" SET "mountingType" = 'LIGHT_POLE'
WHERE "type" = 'NAVIGATION' AND "mountingType" = 'UNKNOWN' AND (LOWER(COALESCE("structureCode", '')) LIKE '%osvetleni%' OR UPPER(TRIM(COALESCE("structureCode", ''))) = 'VO');
UPDATE "AdvertisingCarrier" SET "mountingType" = 'POLE'
WHERE "type" = 'NAVIGATION' AND "mountingType" = 'UNKNOWN' AND (LOWER(COALESCE("structureCode", '')) LIKE '%sloup%' OR LOWER(COALESCE("structureCode", '')) LIKE '%pylon%');

INSERT INTO "OfferPriceRule" ("id", "code", "category", "label", "description", "mediaType", "mountingType", "pricingSegment", "city", "minDurationMonths", "maxDurationMonths", "calculation", "unit", "unitPrice", "defaultSelected", "active", "sortOrder", "createdAt", "updatedAt") VALUES
  ('nav_ostrava_rental_vo', 'NAV_OSR_RENTAL_LIGHT_POLE_12M', 'RENTAL', 'Navigace 67 × 90 jednostranná – VO', 'Roční pronájem dle dodaného ceníku Ostrava.', 'NAVIGATION_SIGN', 'LIGHT_POLE', 'COMMERCIAL', 'Ostrava', 12, 12, 'PER_SURFACE', 'rok', 9500, true, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('nav_ostrava_rental_traction', 'NAV_OSR_RENTAL_TRACTION_12M', 'RENTAL', 'Navigace 67 × 90 jednostranná – trakce', 'Roční pronájem dle dodaného ceníku Ostrava.', 'NAVIGATION_SIGN', 'TRACTION', 'COMMERCIAL', 'Ostrava', 12, 12, 'PER_SURFACE', 'rok', 12000, true, true, 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('nav_ostrava_rental_column', 'NAV_OSR_RENTAL_COLUMN_12M', 'RENTAL', 'Navigace 67 × 90 jednostranná – sloupek', 'Roční pronájem dle dodaného ceníku Ostrava.', 'NAVIGATION_SIGN', 'COLUMN', 'COMMERCIAL', 'Ostrava', 12, 12, 'PER_SURFACE', 'rok', 12000, true, true, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('nav_ostrava_installation', 'NAV_OSR_INSTALLATION', 'INSTALLATION', 'Instalace navigace 67 × 90', 'Cena za kus dle dodaného ceníku Ostrava.', 'NAVIGATION_SIGN', NULL, 'COMMERCIAL', 'Ostrava', NULL, NULL, 'PER_SURFACE', 'ks', 800, true, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('nav_ostrava_removal', 'NAV_OSR_REMOVAL', 'REMOVAL', 'Deinstalace navigace 67 × 90', 'Cena za kus dle dodaného ceníku Ostrava.', 'NAVIGATION_SIGN', NULL, 'COMMERCIAL', 'Ostrava', NULL, NULL, 'PER_SURFACE', 'ks', 600, true, true, 21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('nav_ostrava_frame', 'NAV_OSR_FRAME_DFLEX', 'PRODUCTION', 'Rám D-FLEX 67 × 90', 'Cena za kus dle dodaného ceníku Ostrava.', 'NAVIGATION_SIGN', NULL, 'COMMERCIAL', 'Ostrava', NULL, NULL, 'PER_SURFACE', 'ks', 1960, true, true, 22, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('nav_ostrava_print', 'NAV_OSR_PRINT_UV_DIBOND', 'PRINT', 'UV tisk na dibond 67 × 90', 'Cena za kus dle dodaného ceníku Ostrava.', 'NAVIGATION_SIGN', NULL, 'COMMERCIAL', 'Ostrava', NULL, NULL, 'PER_SURFACE', 'ks', 600, true, true, 23, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "mediaType" = EXCLUDED."mediaType",
  "mountingType" = EXCLUDED."mountingType",
  "pricingSegment" = EXCLUDED."pricingSegment",
  "city" = EXCLUDED."city",
  "minDurationMonths" = EXCLUDED."minDurationMonths",
  "maxDurationMonths" = EXCLUDED."maxDurationMonths",
  "unit" = EXCLUDED."unit",
  "unitPrice" = EXCLUDED."unitPrice",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
