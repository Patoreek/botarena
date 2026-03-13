import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth.js";
import { encrypt } from "../src/lib/crypto.js";

const prisma = new PrismaClient();

const TEST_EMAIL = "testing@gmail.com";
const TEST_PASSWORD = "Testing123!";

/**
 * Three DOGE/USDT grid bots with very different strategies:
 *
 * 1) "DOGE Scalper" — Tight grid, 5s ticks, NEUTRAL, aims for many rapid trades
 * 2) "DOGE Trend Rider" — Wider grid, LONG-biased, fewer but larger moves
 * 3) "DOGE Contrarian" — SHORT-biased, geometric grid, sells into rallies
 *
 * DOGE is ~$0.093 right now (24h range: $0.090 – $0.100).
 */

interface BotSeed {
  name: string;
  grid: {
    upperPrice: number;
    lowerPrice: number;
    gridCount: number;
    gridType: "ARITHMETIC" | "GEOMETRIC";
    gridMode: "LONG" | "SHORT" | "NEUTRAL";
    orderType: "LIMIT" | "MARKET";
    totalInvestment: number;
    amountPerGrid: number;
    minProfitPerGrid: number | null;
    maxOpenOrders: number | null;
    triggerPrice: number | null;
    stopLossPrice: number | null;
    takeProfitPrice: number | null;
    trailingUp: boolean;
    trailingDown: boolean;
    stopLossAction: "CLOSE_ALL" | "STOP_ONLY";
    takeProfitAction: "CLOSE_ALL" | "STOP_ONLY";
  };
}

const bots: BotSeed[] = [
  {
    // ── Bot 1: Tight scalper ──────────────────────────────────────────────
    // Very narrow range around current price, 30 levels = tiny ~$0.00033 gap
    // NEUTRAL mode: buys dips + sells rallies. No min profit → trades constantly.
    name: "DOGE Scalper (Sandbox)",
    grid: {
      upperPrice: 0.1,
      lowerPrice: 0.085,
      gridCount: 30,
      gridType: "ARITHMETIC",
      gridMode: "NEUTRAL",
      orderType: "MARKET",
      totalInvestment: 300,
      amountPerGrid: 80, // ~80 DOGE per grid ≈ $7.44
      minProfitPerGrid: null, // trade at any micro-move
      maxOpenOrders: null,
      triggerPrice: null,
      stopLossPrice: 0.075, // stop-loss 19% below
      takeProfitPrice: 0.115, // take-profit 24% above
      trailingUp: false,
      trailingDown: false,
      stopLossAction: "STOP_ONLY",
      takeProfitAction: "STOP_ONLY",
    },
  },
  {
    // ── Bot 2: LONG Trend Rider ───────────────────────────────────────────
    // Wider range, LONG mode = only buys. Accumulates on dips, holds.
    // 15 grid levels, geometric spacing (wider at the top, tighter at bottom).
    name: "DOGE Trend Rider (Sandbox)",
    grid: {
      upperPrice: 0.105,
      lowerPrice: 0.08,
      gridCount: 15,
      gridType: "GEOMETRIC",
      gridMode: "LONG",
      orderType: "MARKET",
      totalInvestment: 500,
      amountPerGrid: 150, // ~150 DOGE per grid ≈ $14
      minProfitPerGrid: null,
      maxOpenOrders: 10,
      triggerPrice: null,
      stopLossPrice: 0.07,
      takeProfitPrice: 0.12,
      trailingUp: true,
      trailingDown: false,
      stopLossAction: "CLOSE_ALL",
      takeProfitAction: "STOP_ONLY",
    },
  },
  {
    // ── Bot 3: SHORT Contrarian ───────────────────────────────────────────
    // SHORT mode = sells positions into rallies. Tight grid, aggressive.
    // This bot will frequently sell at small losses when price drops after buying.
    name: "DOGE Contrarian (Sandbox)",
    grid: {
      upperPrice: 0.098,
      lowerPrice: 0.088,
      gridCount: 25,
      gridType: "ARITHMETIC",
      gridMode: "NEUTRAL", // uses NEUTRAL so it buys AND sells
      orderType: "MARKET",
      totalInvestment: 250,
      amountPerGrid: 60, // ~60 DOGE per grid ≈ $5.58
      minProfitPerGrid: null, // no minimum profit → sells even at a loss
      maxOpenOrders: null,
      triggerPrice: null,
      stopLossPrice: null, // no stop-loss: let it trade recklessly
      takeProfitPrice: null,
      trailingUp: false,
      trailingDown: false,
      stopLossAction: "STOP_ONLY",
      takeProfitAction: "STOP_ONLY",
    },
  },
];

async function main() {
  // 1. Upsert test user
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash, name: "Test User" },
    create: { email: TEST_EMAIL, passwordHash, name: "Test User" },
  });
  console.log("Test user ready:", user.email);

  // 2. Upsert dummy Binance API key (paper trading doesn't need real keys,
  //    but the run creation endpoint checks for one)
  const dummyKey = encrypt("paper-trading-sandbox-key");
  const dummySecret = encrypt("paper-trading-sandbox-secret");
  await prisma.apiKey.upsert({
    where: { userId_provider: { userId: user.id, provider: "BINANCE" } },
    update: {
      label: "Paper Trading (Sandbox)",
      encryptedKey: dummyKey,
      encryptedSecret: dummySecret,
      keyHint: "...dbox",
    },
    create: {
      userId: user.id,
      provider: "BINANCE",
      label: "Paper Trading (Sandbox)",
      encryptedKey: dummyKey,
      encryptedSecret: dummySecret,
      keyHint: "...dbox",
    },
  });
  console.log("Binance API key (sandbox) ready");

  // 3. Create all three bots
  const createdBots: { id: string; name: string }[] = [];

  for (const botSeed of bots) {
    // Delete existing bot with same name to allow re-seeding
    const existing = await prisma.bot.findFirst({
      where: { userId: user.id, name: botSeed.name },
    });
    if (existing) {
      await prisma.bot.delete({ where: { id: existing.id } });
      console.log("  Deleted previous bot:", botSeed.name);
    }

    const bot = await prisma.bot.create({
      data: {
        userId: user.id,
        name: botSeed.name,
        strategy: "GRID",
        status: "IDLE",
      },
    });

    await prisma.gridStrategyConfig.create({
      data: {
        botId: bot.id,
        upperPrice: botSeed.grid.upperPrice,
        lowerPrice: botSeed.grid.lowerPrice,
        gridCount: botSeed.grid.gridCount,
        gridType: botSeed.grid.gridType,
        gridMode: botSeed.grid.gridMode,
        orderType: botSeed.grid.orderType,
        totalInvestment: botSeed.grid.totalInvestment,
        amountPerGrid: botSeed.grid.amountPerGrid,
        trailingUp: botSeed.grid.trailingUp,
        trailingDown: botSeed.grid.trailingDown,
        stopLossAction: botSeed.grid.stopLossAction,
        takeProfitAction: botSeed.grid.takeProfitAction,
        minProfitPerGrid: botSeed.grid.minProfitPerGrid,
        maxOpenOrders: botSeed.grid.maxOpenOrders,
        triggerPrice: botSeed.grid.triggerPrice,
        stopLossPrice: botSeed.grid.stopLossPrice,
        takeProfitPrice: botSeed.grid.takeProfitPrice,
      },
    });

    await prisma.botStats.create({
      data: { botId: bot.id },
    });

    createdBots.push({ id: bot.id, name: botSeed.name });
    console.log(`  ✔ Bot created: "${botSeed.name}" (${bot.id})`);
  }

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  3 DOGE/USDT grid bots ready for paper trading");
  console.log("══════════════════════════════════════════════════════════");
  console.log("\nBots:");
  for (const b of createdBots) {
    console.log(`  • ${b.name} (${b.id})`);
  }
  console.log("\nTo start all bots:");
  console.log("  1. Login at http://localhost:3000 with testing@gmail.com / Testing123!");
  console.log("  2. Go to Bots and start each one individually");
  console.log("  3. Or run: npx tsx scripts/start-arena.ts");
  console.log("     to auto-start all 3 bots for 1 hour via API\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
