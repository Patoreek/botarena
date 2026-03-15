-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BotStrategy" ADD VALUE 'TREND_FOLLOWING';
ALTER TYPE "BotStrategy" ADD VALUE 'MEAN_REVERSION';
ALTER TYPE "BotStrategy" ADD VALUE 'MARKET_MAKING';
ALTER TYPE "BotStrategy" ADD VALUE 'ARBITRAGE';
ALTER TYPE "BotStrategy" ADD VALUE 'DCA';
ALTER TYPE "BotStrategy" ADD VALUE 'SCALPING';
ALTER TYPE "BotStrategy" ADD VALUE 'REGIME';
ALTER TYPE "BotStrategy" ADD VALUE 'AI_SIGNAL';

-- AlterTable
ALTER TABLE "Bot" ADD COLUMN     "config_json" JSONB;
