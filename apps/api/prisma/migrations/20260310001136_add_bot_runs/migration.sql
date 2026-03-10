-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'STOPPED', 'COMPLETED', 'ERROR');

-- CreateEnum
CREATE TYPE "RunInterval" AS ENUM ('ONE_SECOND', 'FIVE_SECONDS', 'FIFTEEN_SECONDS', 'THIRTY_SECONDS', 'ONE_MINUTE', 'FIVE_MINUTES', 'FIFTEEN_MINUTES', 'THIRTY_MINUTES', 'ONE_HOUR', 'FOUR_HOURS', 'ONE_DAY');

-- CreateEnum
CREATE TYPE "RunLogAction" AS ENUM ('RUN_START', 'RUN_PAUSE', 'RUN_RESUME', 'RUN_STOP', 'RUN_COMPLETE', 'RUN_ERROR', 'TRADE_BUY', 'TRADE_SELL', 'CONFIG_CHANGE');

-- CreateTable
CREATE TABLE "BotRun" (
    "id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "exchange" "ApiProvider" NOT NULL,
    "market_pair" TEXT NOT NULL,
    "interval" "RunInterval" NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "stopped_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "total_profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_loss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_pnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_buys" INTEGER NOT NULL DEFAULT 0,
    "total_sells" INTEGER NOT NULL DEFAULT 0,
    "total_trades" INTEGER NOT NULL DEFAULT 0,
    "win_count" INTEGER NOT NULL DEFAULT 0,
    "loss_count" INTEGER NOT NULL DEFAULT 0,
    "roi" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "BotRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunLog" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "action" "RunLogAction" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BotRun_bot_id_created_at_idx" ON "BotRun"("bot_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "RunLog_run_id_created_at_idx" ON "RunLog"("run_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "BotRun" ADD CONSTRAINT "BotRun_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunLog" ADD CONSTRAINT "RunLog_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "BotRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
