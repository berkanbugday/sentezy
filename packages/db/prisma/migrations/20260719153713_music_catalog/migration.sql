-- CreateTable
CREATE TABLE "music_catalog" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mood" TEXT NOT NULL,
    "mood_label" TEXT NOT NULL,
    "r2_key" TEXT NOT NULL,
    "duration_sec" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT '',
    "license" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "music_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "music_catalog_slug_key" ON "music_catalog"("slug");

-- CreateIndex
CREATE INDEX "music_catalog_mood_idx" ON "music_catalog"("mood");
