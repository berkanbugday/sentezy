-- AlterTable
ALTER TABLE "brand_kits" ADD COLUMN     "intro_clip_crop" JSONB,
ADD COLUMN     "outro_clip_crop" JSONB,
ALTER COLUMN "updated_at" DROP DEFAULT;
