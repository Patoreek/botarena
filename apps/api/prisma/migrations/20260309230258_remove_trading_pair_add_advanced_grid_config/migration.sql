/*
  Warnings:

  - You are about to drop the column `trading_pair` on the `Bot` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "GridMode" AS ENUM ('LONG', 'SHORT', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('LIMIT', 'MARKET');

-- CreateEnum
CREATE TYPE "StopAction" AS ENUM ('CLOSE_ALL', 'STOP_ONLY');

-- AlterTable
ALTER TABLE "Bot" DROP COLUMN "trading_pair";

-- AlterTable
ALTER TABLE "GridStrategyConfig" ADD COLUMN     "grid_mode" "GridMode" NOT NULL DEFAULT 'NEUTRAL',
ADD COLUMN     "max_open_orders" INTEGER,
ADD COLUMN     "min_profit_per_grid" DOUBLE PRECISION,
ADD COLUMN     "order_type" "OrderType" NOT NULL DEFAULT 'LIMIT',
ADD COLUMN     "stop_loss_action" "StopAction" NOT NULL DEFAULT 'STOP_ONLY',
ADD COLUMN     "take_profit_action" "StopAction" NOT NULL DEFAULT 'STOP_ONLY',
ADD COLUMN     "trailing_down" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trailing_up" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trigger_price" DOUBLE PRECISION;
