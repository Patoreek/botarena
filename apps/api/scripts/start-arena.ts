/**
 * start-arena.ts
 *
 * Logs into the API, finds all IDLE bots, and starts a 1-hour DOGE/USDT run
 * on each of them with 5-second intervals. Run from the api package root:
 *
 *   npx tsx scripts/start-arena.ts
 */

const API_BASE = process.env.API_URL ?? "http://localhost:3001";
const EMAIL = process.env.TEST_EMAIL ?? "testing@gmail.com";
const PASSWORD = process.env.TEST_PASSWORD ?? "Testing123!";

const MARKET_PAIR = "DOGE/USDT";
const EXCHANGE = "BINANCE";
const INTERVAL = "FIVE_SECONDS";
const DURATION_HOURS = 1;

async function api(path: string, opts: RequestInit = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  console.log("══════════════════════════════════════════════════════════");
  console.log("  🤖 Bot Arena — Starting all bots for 1 hour");
  console.log("══════════════════════════════════════════════════════════\n");

  // 1. Login
  console.log(`Logging in as ${EMAIL}...`);
  const auth = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = auth.accessToken;
  console.log("  ✔ Authenticated\n");

  const headers = { Authorization: `Bearer ${token}` };

  // 2. Fetch all bots
  const botsRes = await api("/bots?limit=50", { headers });
  const bots = botsRes.items ?? botsRes;
  console.log(`Found ${bots.length} bot(s):\n`);

  // 3. Start a run on each IDLE bot
  let started = 0;
  for (const bot of bots) {
    const status = bot.status ?? "IDLE";
    const emoji = status === "IDLE" ? "🟢" : status === "RUNNING" ? "🔴" : "⚪";
    console.log(`  ${emoji} ${bot.name} (${bot.id}) — ${status}`);

    if (status !== "IDLE") {
      console.log(`     ⏭  Skipping (not IDLE)\n`);
      continue;
    }

    try {
      const run = await api(`/bots/${bot.id}/runs`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          exchange: EXCHANGE,
          marketPair: MARKET_PAIR,
          interval: INTERVAL,
          durationHours: DURATION_HOURS,
        }),
      });
      console.log(`     ✔ Run started: ${run.id}`);
      console.log(`       Pair: ${MARKET_PAIR} | Interval: ${INTERVAL} | Duration: ${DURATION_HOURS}h`);
      console.log();
      started++;
    } catch (err) {
      console.error(`     ✘ Failed to start: ${err instanceof Error ? err.message : err}\n`);
    }
  }

  console.log("══════════════════════════════════════════════════════════");
  console.log(`  ✅ ${started}/${bots.length} bots now running for ${DURATION_HOURS} hour(s)`);
  console.log("══════════════════════════════════════════════════════════");
  console.log("\nMonitor at: http://localhost:3000/runs");
  console.log("Bots will auto-stop after 1 hour.\n");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
