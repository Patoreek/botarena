/**
 * Bot runner — strategy-agnostic execution loop that drives a single bot run.
 *
 * On each tick:
 *   1. Fetch current market price from exchange
 *   2. Feed data to the active strategy
 *   3. Get signal from strategy
 *   4. Pass signal through risk engine
 *   5. Execute paper trades if signal is actionable
 *   6. Log the decision and any trades to the database
 *   7. Update run stats
 */

import { prisma } from "../db.js";
import { fetchTicker, fetchKlines, toSymbol } from "../binance.js";
import { PaperTrader } from "./paper-trader.js";
import { strategyRegistry } from "./strategies/registry.js";
import type { IStrategy, Signal, MarketTick, CandleData } from "./strategies/types.js";
import type { RiskEngine } from "./risk/risk-engine.js";
import { INTERVAL_MS, type RunInterval } from "@repo/shared";

// Ensure all strategies are registered
import "./strategies/index.js";

export interface RunnerConfig {
  runId: string;
  botId: string;
  marketPair: string;
  interval: RunInterval;
  strategySlug: string;
  strategyConfig: unknown;
  durationMs: number;
  riskEngine?: RiskEngine;
}

export class BotRunner {
  private config: RunnerConfig;
  private timer: ReturnType<typeof setInterval> | null = null;
  private strategy: IStrategy;
  private paperTrader: PaperTrader;
  private previousPrice: number | null = null;
  private startTime: number;
  private tickCount = 0;
  private _paused = false;
  private _stopped = false;
  private lastKlineFetch = 0;
  private klineIntervalMs: number;

  constructor(config: RunnerConfig) {
    this.config = config;
    this.strategy = strategyRegistry.create(config.strategySlug, config.strategyConfig);
    const totalInvestment = (config.strategyConfig as any)?.totalInvestment ?? 1000;
    this.paperTrader = new PaperTrader(totalInvestment);
    this.startTime = Date.now();
    // Fetch klines at most every 60s to avoid rate limits
    this.klineIntervalMs = Math.max(INTERVAL_MS[config.interval] * 5, 60_000);
  }

  start(): void {
    if (this._stopped) return;
    const intervalMs = INTERVAL_MS[this.config.interval];
    this.log("info", `Runner started. Strategy: ${this.config.strategySlug}, Interval: ${intervalMs}ms, Duration: ${this.config.durationMs}ms`);

    this.tick();
    this.timer = setInterval(() => {
      if (!this._paused && !this._stopped) {
        this.tick();
      }
    }, intervalMs);
  }

  pause(): void {
    this._paused = true;
    this.log("info", "Runner paused");
  }

  resume(): void {
    this._paused = false;
    this.log("info", "Runner resumed");
  }

  async stop(): Promise<void> {
    this._stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.strategy.shutdown();
    await this.updateRunStats();
    this.log("info", "Runner stopped");
  }

  get isRunning(): boolean {
    return !this._stopped && !this._paused;
  }

  get isPaused(): boolean {
    return this._paused;
  }

  get isStopped(): boolean {
    return this._stopped;
  }

  private async tick(): Promise<void> {
    if (this._stopped) return;

    const elapsed = Date.now() - this.startTime;
    if (elapsed >= this.config.durationMs) {
      await this.autoComplete();
      return;
    }

    this.tickCount++;

    try {
      const symbol = toSymbol(this.config.marketPair);
      const ticker = await fetchTicker(symbol);
      const currentPrice = parseFloat(ticker.lastPrice);

      // Feed ticker data to strategy
      const tick: MarketTick = {
        price: currentPrice,
        volume: parseFloat(ticker.volume),
        high24h: parseFloat(ticker.highPrice),
        low24h: parseFloat(ticker.lowPrice),
        timestamp: new Date(),
      };
      this.strategy.onMarketData(tick);

      // Optionally feed candle data if strategy needs it and enough time passed
      const needsKlines = this.strategy.metadata.requiredDataFeeds.includes("KLINE");
      if (needsKlines && Date.now() - this.lastKlineFetch >= this.klineIntervalMs) {
        try {
          const klines = await fetchKlines(symbol, this.config.interval, 50);
          for (const k of klines) {
            const candle: CandleData = {
              open: parseFloat(k.open),
              high: parseFloat(k.high),
              low: parseFloat(k.low),
              close: parseFloat(k.close),
              volume: parseFloat(k.volume),
              timestamp: k.openTime,
            };
            this.strategy.onCandle(candle);
          }
          this.lastKlineFetch = Date.now();
        } catch {
          // Candle fetch failed, strategy degrades gracefully
        }
      }

      // Generate signal
      const signal = this.strategy.generateSignal();

      // Risk engine check
      if (this.config.riskEngine && signal.action !== "HOLD") {
        const check = this.config.riskEngine.check(
          signal,
          this.paperTrader.portfolio,
          this.paperTrader.recentTrades,
        );
        if (!check.allowed) {
          await this.logTick({
            ...signal,
            action: "HOLD",
            reason: `${signal.reason} — RISK BLOCKED: ${check.reason}`,
          });
          this.previousPrice = currentPrice;
          return;
        }
      }

      // Execute
      if (signal.action === "BUY" && this.strategy.shouldEnter(signal)) {
        const orders = this.strategy.buildOrders(signal);
        for (const order of orders) {
          await this.executeBuy(order, currentPrice);
        }
      } else if (signal.action === "SELL" && this.strategy.shouldExit(signal)) {
        const orders = this.strategy.buildOrders(signal);
        for (const order of orders) {
          await this.executeSell(order, currentPrice);
        }
      } else {
        await this.logTick(signal);
      }

      this.strategy.onPositionUpdate(this.paperTrader.portfolio);
      this.previousPrice = currentPrice;

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
        // DB logging failed, continue
      }
    }
  }

  private async executeBuy(signal: Signal, currentPrice: number): Promise<void> {
    const trade = this.paperTrader.buy(currentPrice, signal.amount, signal.label);
    if (!trade) {
      await this.logTick({
        ...signal,
        action: "HOLD",
        reason: `${signal.reason} — SKIPPED: insufficient USDT balance (${this.paperTrader.portfolio.quoteBalance.toFixed(2)} USDT)`,
      });
      return;
    }

    this.strategy.onOrderFill(signal, trade);
    const position = this.paperTrader.positionSummary(currentPrice);

    await prisma.runLog.create({
      data: {
        runId: this.config.runId,
        action: "TICK",
        message: signal.reason,
        metadata: {
          price: currentPrice,
          decision: "BUY",
          reason: signal.reason,
          position,
          gridLevel: signal.label,
          confidence: signal.confidence,
        },
      },
    });

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

  private async executeSell(signal: Signal, currentPrice: number): Promise<void> {
    // For grid strategy, look up the buy price from the adapter's grid levels
    let buyPrice: number | null = null;
    if ("getGridLevels" in this.strategy) {
      const levels = (this.strategy as any).getGridLevels();
      const levelIdx = parseInt(signal.label.replace("L", ""), 10);
      if (!isNaN(levelIdx) && levels[levelIdx]) {
        buyPrice = levels[levelIdx].buyPrice;
      }
    }
    // For non-grid strategies, use the average entry from metadata if available
    if (buyPrice === null && signal.metadata?.buyPrice != null) {
      buyPrice = signal.metadata.buyPrice as number;
    }

    const trade = this.paperTrader.sell(currentPrice, signal.amount, signal.label, buyPrice);
    if (!trade) {
      await this.logTick({
        ...signal,
        action: "HOLD",
        reason: `${signal.reason} — SKIPPED: insufficient asset balance (${this.paperTrader.portfolio.baseBalance.toFixed(6)})`,
      });
      return;
    }

    this.strategy.onOrderFill(signal, trade);
    const position = this.paperTrader.positionSummary(currentPrice);
    const pnlStr = trade.pnl >= 0 ? `+${trade.pnl.toFixed(4)}` : trade.pnl.toFixed(4);

    await prisma.runLog.create({
      data: {
        runId: this.config.runId,
        action: "TICK",
        message: signal.reason,
        metadata: {
          price: currentPrice,
          decision: "SELL",
          reason: signal.reason,
          position,
          gridLevel: signal.label,
          confidence: signal.confidence,
        },
      },
    });

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

  private async logTick(signal: Signal): Promise<void> {
    const position = this.paperTrader.positionSummary(signal.price);
    await prisma.runLog.create({
      data: {
        runId: this.config.runId,
        action: "TICK",
        message: signal.reason,
        metadata: {
          price: signal.price,
          decision: signal.action,
          reason: signal.reason,
          position,
          gridLevel: signal.label,
          confidence: signal.confidence,
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
      this.log("warn", `Stats update failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async autoComplete(): Promise<void> {
    this._stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.strategy.shutdown();
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
