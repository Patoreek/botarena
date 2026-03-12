/**
 * Bot runner — the main execution loop that drives a single bot run.
 *
 * On each tick:
 *   1. Fetch current market price from Binance
 *   2. Evaluate the grid strategy
 *   3. Execute paper trades if needed
 *   4. Log the decision and any trades to the database
 *   5. Update run stats
 */

import { prisma } from "../db.js";
import { fetchTicker, toSymbol } from "../binance.js";
import {
  generateGridLevels,
  evaluateGrid,
  type GridConfig,
  type GridLevel,
  type GridDecision,
} from "./grid.js";
import { PaperTrader } from "./paper-trader.js";
import { INTERVAL_MS, type RunInterval } from "@repo/shared";

export interface RunnerConfig {
  runId: string;
  botId: string;
  marketPair: string;
  interval: RunInterval;
  gridConfig: GridConfig;
  durationMs: number; // auto-stop after this many ms
}

export class BotRunner {
  private config: RunnerConfig;
  private timer: ReturnType<typeof setInterval> | null = null;
  private gridLevels: GridLevel[];
  private paperTrader: PaperTrader;
  private previousPrice: number | null = null;
  private startTime: number;
  private tickCount = 0;
  private paused = false;
  private stopped = false;

  constructor(config: RunnerConfig) {
    this.config = config;
    this.gridLevels = generateGridLevels(config.gridConfig);
    this.paperTrader = new PaperTrader(config.gridConfig.totalInvestment);
    this.startTime = Date.now();
  }

  /**
   * Start the execution loop.
   */
  start(): void {
    if (this.stopped) return;
    const intervalMs = INTERVAL_MS[this.config.interval];
    this.log("info", `Runner started. Interval: ${intervalMs}ms, Duration: ${this.config.durationMs}ms`);

    // Run first tick immediately
    this.tick();

    // Then schedule subsequent ticks
    this.timer = setInterval(() => {
      if (!this.paused && !this.stopped) {
        this.tick();
      }
    }, intervalMs);
  }

  /**
   * Pause the execution loop (keeps timer running but skips ticks).
   */
  pause(): void {
    this.paused = true;
    this.log("info", "Runner paused");
  }

  /**
   * Resume from pause.
   */
  resume(): void {
    this.paused = false;
    this.log("info", "Runner resumed");
  }

  /**
   * Stop the execution loop permanently.
   */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.updateRunStats();
    this.log("info", "Runner stopped");
  }

  get isRunning(): boolean {
    return !this.stopped && !this.paused;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get isStopped(): boolean {
    return this.stopped;
  }

  /**
   * Single tick of the execution loop.
   */
  private async tick(): Promise<void> {
    if (this.stopped) return;

    // Check duration limit
    const elapsed = Date.now() - this.startTime;
    if (elapsed >= this.config.durationMs) {
      await this.autoComplete();
      return;
    }

    this.tickCount++;

    try {
      // 1. Fetch current price
      const symbol = toSymbol(this.config.marketPair);
      const ticker = await fetchTicker(symbol);
      const currentPrice = parseFloat(ticker.lastPrice);

      // 2. Evaluate grid strategy
      const decision = evaluateGrid(
        currentPrice,
        this.gridLevels,
        this.config.gridConfig,
        this.previousPrice
      );

      // 3. Execute paper trade if needed
      if (decision.decision === "BUY") {
        await this.executeBuy(decision, currentPrice);
      } else if (decision.decision === "SELL") {
        await this.executeSell(decision, currentPrice);
      } else {
        await this.logTick(decision);
      }

      this.previousPrice = currentPrice;

      // 4. Periodically update run stats (every 5 ticks to avoid DB spam)
      if (this.tickCount % 5 === 0) {
        await this.updateRunStats();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log("error", `Tick error: ${msg}`);

      try {
        await prisma.runLog.create({
          data: {
            runId: this.config.runId,
            action: "RUN_ERROR",
            message: `Tick #${this.tickCount} error: ${msg}`,
          },
        });
      } catch {
        // DB logging failed too, just continue
      }
    }
  }

  private async executeBuy(decision: GridDecision, currentPrice: number): Promise<void> {
    const trade = this.paperTrader.buy(
      currentPrice,
      decision.amount,
      decision.gridLevel
    );

    if (!trade) {
      // Insufficient balance, log as HOLD instead
      await this.logTick({
        ...decision,
        decision: "HOLD",
        reason: `${decision.reason} — SKIPPED: insufficient USDT balance (${this.paperTrader.portfolio.quoteBalance.toFixed(2)} USDT)`,
      });
      return;
    }

    // Update grid level state
    const levelIdx = parseInt(decision.gridLevel.replace("L", ""), 10);
    if (!isNaN(levelIdx) && this.gridLevels[levelIdx]) {
      this.gridLevels[levelIdx].hasPosition = true;
      this.gridLevels[levelIdx].buyPrice = currentPrice;
    }

    const position = this.paperTrader.positionSummary(currentPrice);

    // Log the TICK decision
    await prisma.runLog.create({
      data: {
        runId: this.config.runId,
        action: "TICK",
        message: decision.reason,
        metadata: {
          price: currentPrice,
          decision: "BUY",
          reason: decision.reason,
          position,
          gridLevel: decision.gridLevel,
          confidence: decision.confidence,
        },
      },
    });

    // Log the TRADE_BUY
    await prisma.runLog.create({
      data: {
        runId: this.config.runId,
        action: "TRADE_BUY",
        message: `BUY ${trade.amount.toFixed(4)} @ ${trade.price.toFixed(6)} (cost: ${trade.cost.toFixed(2)} USDT, fee: ${trade.fee.toFixed(4)} USDT)`,
        metadata: {
          price: trade.price,
          amount: trade.amount,
          cost: trade.cost,
          fee: trade.fee,
          gridLevel: trade.gridLevel,
          quoteBalance: this.paperTrader.portfolio.quoteBalance,
          baseBalance: this.paperTrader.portfolio.baseBalance,
        },
      },
    });

    // Also log to bot logs
    await prisma.botLog.create({
      data: {
        botId: this.config.botId,
        action: "TRADE_BUY",
        message: `[${this.config.marketPair}] BUY ${trade.amount.toFixed(4)} @ ${trade.price.toFixed(6)}`,
        metadata: { runId: this.config.runId, ...trade },
      },
    });

    await this.updateRunStats();
  }

  private async executeSell(decision: GridDecision, currentPrice: number): Promise<void> {
    // Find the buy price for this grid level
    const levelIdx = parseInt(decision.gridLevel.replace("L", ""), 10);
    let buyPrice: number | null = null;
    if (!isNaN(levelIdx) && this.gridLevels[levelIdx]) {
      buyPrice = this.gridLevels[levelIdx].buyPrice;
    }

    const trade = this.paperTrader.sell(
      currentPrice,
      decision.amount,
      decision.gridLevel,
      buyPrice
    );

    if (!trade) {
      await this.logTick({
        ...decision,
        decision: "HOLD",
        reason: `${decision.reason} — SKIPPED: insufficient asset balance (${this.paperTrader.portfolio.baseBalance.toFixed(6)})`,
      });
      return;
    }

    // Clear grid level position
    if (!isNaN(levelIdx) && this.gridLevels[levelIdx]) {
      this.gridLevels[levelIdx].hasPosition = false;
      this.gridLevels[levelIdx].buyPrice = null;
    }

    const position = this.paperTrader.positionSummary(currentPrice);
    const pnlStr = trade.pnl >= 0 ? `+${trade.pnl.toFixed(4)}` : trade.pnl.toFixed(4);

    // Log the TICK
    await prisma.runLog.create({
      data: {
        runId: this.config.runId,
        action: "TICK",
        message: decision.reason,
        metadata: {
          price: currentPrice,
          decision: "SELL",
          reason: decision.reason,
          position,
          gridLevel: decision.gridLevel,
          confidence: decision.confidence,
        },
      },
    });

    // Log the TRADE_SELL
    await prisma.runLog.create({
      data: {
        runId: this.config.runId,
        action: "TRADE_SELL",
        message: `SELL ${trade.amount.toFixed(4)} @ ${trade.price.toFixed(6)} (proceeds: ${trade.cost.toFixed(2)} USDT, fee: ${trade.fee.toFixed(4)} USDT, PnL: ${pnlStr} USDT)`,
        metadata: {
          price: trade.price,
          amount: trade.amount,
          cost: trade.cost,
          fee: trade.fee,
          pnl: trade.pnl,
          gridLevel: trade.gridLevel,
          quoteBalance: this.paperTrader.portfolio.quoteBalance,
          baseBalance: this.paperTrader.portfolio.baseBalance,
        },
      },
    });

    // Also log to bot logs
    await prisma.botLog.create({
      data: {
        botId: this.config.botId,
        action: "TRADE_SELL",
        message: `[${this.config.marketPair}] SELL ${trade.amount.toFixed(4)} @ ${trade.price.toFixed(6)} (PnL: ${pnlStr})`,
        metadata: { runId: this.config.runId, ...trade },
      },
    });

    await this.updateRunStats();
  }

  private async logTick(decision: GridDecision): Promise<void> {
    const position = this.paperTrader.positionSummary(decision.price);
    await prisma.runLog.create({
      data: {
        runId: this.config.runId,
        action: "TICK",
        message: decision.reason,
        metadata: {
          price: decision.price,
          decision: decision.decision,
          reason: decision.reason,
          position,
          gridLevel: decision.gridLevel,
          confidence: decision.confidence,
        },
      },
    });
  }

  private async updateRunStats(): Promise<void> {
    const p = this.paperTrader.portfolio;
    try {
      await prisma.botRun.update({
        where: { id: this.config.runId },
        data: {
          totalProfit: p.totalProfit,
          totalLoss: p.totalLoss,
          netPnl: p.netPnl,
          totalBuys: p.totalBuys,
          totalSells: p.totalSells,
          totalTrades: p.totalTrades,
          winCount: p.winCount,
          lossCount: p.lossCount,
          roi: p.roi,
        },
      });

      // Also update bot-level stats
      await prisma.botStats.upsert({
        where: { botId: this.config.botId },
        update: {
          totalProfit: p.totalProfit,
          totalLoss: p.totalLoss,
          netPnl: p.netPnl,
          totalBuys: p.totalBuys,
          totalSells: p.totalSells,
          totalTrades: p.totalTrades,
          winCount: p.winCount,
          lossCount: p.lossCount,
          successRate: p.totalTrades > 0 ? (p.winCount / p.totalTrades) * 100 : 0,
          roi: p.roi,
          lastUpdatedAt: new Date(),
        },
        create: {
          botId: this.config.botId,
          totalProfit: p.totalProfit,
          totalLoss: p.totalLoss,
          netPnl: p.netPnl,
          totalBuys: p.totalBuys,
          totalSells: p.totalSells,
          totalTrades: p.totalTrades,
          winCount: p.winCount,
          lossCount: p.lossCount,
          successRate: p.totalTrades > 0 ? (p.winCount / p.totalTrades) * 100 : 0,
          roi: p.roi,
        },
      });
    } catch (err) {
      // Non-critical: stats update failed
      this.log("warn", `Stats update failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async autoComplete(): Promise<void> {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    await this.updateRunStats();

    try {
      await prisma.botRun.update({
        where: { id: this.config.runId },
        data: { status: "COMPLETED", stoppedAt: new Date() },
      });

      await prisma.runLog.create({
        data: {
          runId: this.config.runId,
          action: "RUN_COMPLETE",
          message: `Run completed after ${this.tickCount} ticks. Final PnL: ${this.paperTrader.portfolio.netPnl.toFixed(4)} USDT (${this.paperTrader.portfolio.roi}% ROI)`,
          metadata: JSON.parse(JSON.stringify(this.paperTrader.portfolio)),
        },
      });

      await prisma.botLog.create({
        data: {
          botId: this.config.botId,
          action: "BOT_STOP",
          message: `Run completed. ${this.paperTrader.portfolio.totalTrades} trades, PnL: ${this.paperTrader.portfolio.netPnl.toFixed(4)} USDT`,
          metadata: { runId: this.config.runId },
        },
      });

      // Check if bot has other active runs
      const activeRuns = await prisma.botRun.count({
        where: {
          botId: this.config.botId,
          status: { in: ["RUNNING", "PAUSED"] },
        },
      });
      if (activeRuns === 0) {
        await prisma.bot.update({
          where: { id: this.config.botId },
          data: { status: "IDLE" },
        });
      }
    } catch (err) {
      this.log("error", `autoComplete error: ${err instanceof Error ? err.message : err}`);
    }
  }

  private log(level: string, msg: string): void {
    const prefix = `[Runner:${this.config.runId.slice(0, 8)}]`;
    if (level === "error") {
      console.error(prefix, msg);
    } else {
      console.log(prefix, msg);
    }
  }
}
