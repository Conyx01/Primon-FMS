-- Pending days are created when Date Fumigant Placed is recorded (task 6.1).
-- Values are filled in later via POST /api/readings.
ALTER TYPE "ReadingStatus" ADD VALUE IF NOT EXISTS 'pending';

ALTER TABLE "gas_readings" ALTER COLUMN "airspacePpm" DROP NOT NULL;
ALTER TABLE "gas_readings" ALTER COLUMN "probeCasePpm" DROP NOT NULL;
