-- CreateTable
CREATE TABLE "brand_kits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "brand_name" TEXT,
    "handle" TEXT,
    "logo_key" TEXT,
    "color" TEXT NOT NULL DEFAULT '#0A0A0B',
    "font" TEXT NOT NULL DEFAULT 'General Sans',
    "outro_cta" TEXT,
    "intro_clip_key" TEXT,
    "intro_clip_ms" INTEGER,
    "outro_clip_key" TEXT,
    "outro_clip_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_kits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_kits_user_id_key" ON "brand_kits"("user_id");
