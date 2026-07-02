UPDATE "AdvertisingCarrier" AS carrier
SET "type" = 'NAVIGATION'::"CarrierType"
WHERE carrier."type" = 'OTHER'::"CarrierType"
  AND EXISTS (
    SELECT 1
    FROM "AdvertisingSurface" AS surface
    WHERE surface."carrierId" = carrier."id"
      AND surface."mediaType" = 'NAVIGATION_SIGN'::"MediaType"
  );
