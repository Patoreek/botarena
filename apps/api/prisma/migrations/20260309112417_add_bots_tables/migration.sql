-- CreateEnum
CREATE TYPE "BotStrategy" AS ENUM ('GRID');

-- CreateEnum
CREATE TYPE "BotStatus" AS ENUM ('IDLE', 'RUNNING', 'STOPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "GridType" AS ENUM ('ARITHMETIC', 'GEOMETRIC');

-- CreateEnum
CREATE TYPE "BotLogAction" AS ENUM ('TRADE_BUY', 'TRADE_SELL', 'BOT_START', 'BOT_STOP', 'BOT_ERROR', 'CONFIG_CHANGE', 'MANUAL');

-- CreateTable
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strategy" "BotStrategy" NOT NULL,
    "status" "BotStatus" NOT NULL DEFAULT 'IDLE',
    "exchange" TEXT NOT NULL,
    "trading_pair" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotStats" (
    "id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "total_profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_loss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_pnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_buys" INTEGER NOT NULL DEFAULT 0,
    "total_sells" INTEGER NOT NULL DEFAULT 0,
    "total_trades" INTEGER NOT NULL DEFAULT 0,
    "win_count" INTEGER NOT NULL DEFAULT 0,
    "loss_count" INTEGER NOT NULL DEFAULT 0,
    "success_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_drawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GridStrategyConfig" (
    "id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "upper_price" DOUBLE PRECISION NOT NULL,
    "lower_price" DOUBLE PRECISION NOT NULL,
    "grid_count" INTEGER NOT NULL,
    "grid_type" "GridType" NOT NULL DEFAULT 'ARITHMETIC',
    "total_investment" DOUBLE PRECISION NOT NULL,
    "amount_per_grid" DOUBLE PRECISION NOT NULL,
    "take_profit_price" DOUBLE PRECISION,
    "stop_loss_price" DOUBLE PRECISION,

    CONSTRAINT "GridStrategyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotLog" (
    "id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "action" "BotLogAction" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bot_user_id_idx" ON "Bot"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "BotStats_bot_id_key" ON "BotStats"("bot_id");

-- CreateIndex
CREATE UNIQUE INDEX "GridStrategyConfig_bot_id_key" ON "GridStrategyConfig"("bot_id");

-- CreateIndex
CREATE INDEX "BotLog_bot_id_created_at_idx" ON "BotLog"("bot_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotStats" ADD CONSTRAINT "BotStats_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GridStrategyConfig" ADD CONSTRAINT "GridStrategyConfig_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotLog" ADD CONSTRAINT "BotLog_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
