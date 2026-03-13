-- CreateEnum
CREATE TYPE "ArenaStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'STOPPED', 'ERROR');

-- CreateTable
CREATE TABLE "Arena" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exchange" "ApiProvider" NOT NULL,
    "market_pair" TEXT NOT NULL,
    "interval" "RunInterval" NOT NULL,
    "duration_hours" INTEGER NOT NULL DEFAULT 1,
    "status" "ArenaStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "stopped_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Arena_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaEntry" (
    "id" TEXT NOT NULL,
    "arena_id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "bot_run_id" TEXT NOT NULL,
    "rank" INTEGER,

    CONSTRAINT "ArenaEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Arena_user_id_idx" ON "Arena"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaEntry_bot_run_id_key" ON "ArenaEntry"("bot_run_id");

-- CreateIndex
CREATE INDEX "ArenaEntry_arena_id_idx" ON "ArenaEntry"("arena_id");

-- AddForeignKey
ALTER TABLE "Arena" ADD CONSTRAINT "Arena_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaEntry" ADD CONSTRAINT "ArenaEntry_arena_id_fkey" FOREIGN KEY ("arena_id") REFERENCES "Arena"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaEntry" ADD CONSTRAINT "ArenaEntry_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaEntry" ADD CONSTRAINT "ArenaEntry_bot_run_id_fkey" FOREIGN KEY ("bot_run_id") REFERENCES "BotRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
