-- CreateEnum
CREATE TYPE "NavigationDistanceSource" AS ENUM ('CALCULATED', 'MANUAL');

-- CreateEnum
CREATE TYPE "DistanceUnit" AS ENUM ('METERS', 'KILOMETERS');

-- CreateEnum
CREATE TYPE "NavigationRouteProvider" AS ENUM ('GOOGLE_ROUTES', 'OSRM', 'MANUAL');

-- CreateEnum
CREATE TYPE "NavigationTravelMode" AS ENUM ('DRIVING', 'BICYCLING', 'WALKING');

-- CreateEnum
CREATE TYPE "NavigationRouteStatus" AS ENUM ('OK', 'NOT_FOUND', 'FAILED');

-- CreateEnum
CREATE TYPE "NavigationArrowDirection" AS ENUM ('LEFT', 'RIGHT', 'STRAIGHT', 'SLANTED_LEFT', 'SLANTED_RIGHT', 'U_TURN', 'TWO_WAY');

-- AlterTable NavigationOffer
ALTER TABLE "NavigationOffer" ADD COLUMN "googlePlaceId" TEXT,
ADD COLUMN "formattedAddress" TEXT;

-- AlterTable NavigationPoint
ALTER TABLE "NavigationPoint" ADD COLUMN "targetLatitude" DOUBLE PRECISION,
ADD COLUMN "targetLongitude" DOUBLE PRECISION,
ADD COLUMN "pillarNumber" TEXT,
ADD COLUMN "pillarType" TEXT,
ADD COLUMN "calculatedDistanceMeters" INTEGER,
ADD COLUMN "manualDistanceValue" DECIMAL(10,2),
ADD COLUMN "manualDistanceUnit" "DistanceUnit",
ADD COLUMN "distanceSource" "NavigationDistanceSource" NOT NULL DEFAULT 'CALCULATED',
ADD COLUMN "routePolyline" TEXT,
ADD COLUMN "routeProvider" "NavigationRouteProvider" DEFAULT 'GOOGLE_ROUTES',
ADD COLUMN "routeDistanceMeters" INTEGER,
ADD COLUMN "routeDurationSeconds" INTEGER,
ADD COLUMN "routeTravelMode" "NavigationTravelMode" DEFAULT 'DRIVING',
ADD COLUMN "routeCalculatedAt" TIMESTAMP(3),
ADD COLUMN "routeStatus" "NavigationRouteStatus" DEFAULT 'OK',
ADD COLUMN "arrowDirectionEnum" "NavigationArrowDirection" DEFAULT 'STRAIGHT';
