import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth.js";
import { encrypt } from "../src/lib/crypto.js";

const prisma = new PrismaClient();

const TEST_EMAIL = "testing@gmail.com";
const TEST_PASSWORD = "Testing123!";

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

  // 3. Create aggressive grid bot for DOGE/USDT
  //
  // DOGE is ~$0.092 right now. We set a tight grid to maximize trades:
  //   - Range: $0.085 – $0.100 (~8% spread around current price)
  //   - 20 grid levels (~$0.00075 per level)
  //   - NEUTRAL mode (both buy and sell)
  //   - MARKET order type
  //   - No min profit per grid (trades at any micro-movement)
  //   - $200 paper investment, ~$10 per grid
  //
  const BOT_NAME = "DOGE Scalper (Sandbox)";

  // Delete existing bot with same name to allow re-seeding
  const existing = await prisma.bot.findFirst({
    where: { userId: user.id, name: BOT_NAME },
  });
  if (existing) {
    await prisma.bot.delete({ where: { id: existing.id } });
    console.log("Deleted previous bot:", BOT_NAME);
  }

  const bot = await prisma.bot.create({
    data: {
      userId: user.id,
      name: BOT_NAME,
      strategy: "GRID",
      status: "IDLE",
    },
  });

  await prisma.gridStrategyConfig.create({
    data: {
      botId: bot.id,
      upperPrice: 0.1,
      lowerPrice: 0.085,
      gridCount: 20,
      gridType: "ARITHMETIC",
      gridMode: "NEUTRAL",
      orderType: "MARKET",
      totalInvestment: 200,
      amountPerGrid: 100, // ~100 DOGE per grid (~$9.2 per order)
      trailingUp: false,
      trailingDown: false,
      stopLossAction: "STOP_ONLY",
      takeProfitAction: "STOP_ONLY",
      minProfitPerGrid: null,
      maxOpenOrders: null,
      triggerPrice: null,
      stopLossPrice: null,
      takeProfitPrice: null,
    },
  });

  await prisma.botStats.create({
    data: { botId: bot.id },
  });

  console.log(`\nBot created: "${BOT_NAME}" (${bot.id})`);
  console.log("Grid config: DOGE/USDT, $0.085 - $0.100, 20 levels, NEUTRAL, MARKET");
  console.log("Investment: $200 paper money, ~100 DOGE per grid level");
  console.log("\nTo start a run:");
  console.log("  1. Login at http://localhost:3000 with testing@gmail.com / Testing123!");
  console.log("  2. Go to Bots > DOGE Scalper > Start Run");
  console.log("  3. Select: Exchange=BINANCE, Pair=DOGE/USDT, Interval=5s");
  console.log("  4. Watch the bot decisions and trades in real-time!\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
