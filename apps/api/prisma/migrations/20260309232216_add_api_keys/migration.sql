-- CreateEnum
CREATE TYPE "ApiProvider" AS ENUM ('BINANCE', 'OPENAI');

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "ApiProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "encrypted_secret" TEXT,
    "key_hint" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiKey_user_id_idx" ON "ApiKey"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_user_id_provider_key" ON "ApiKey"("user_id", "provider");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
