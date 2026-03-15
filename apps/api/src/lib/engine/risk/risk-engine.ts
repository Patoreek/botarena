/**
 * Centralized risk engine.
 *
 * Every signal must pass through the risk engine before execution.
 * The engine enforces position limits, drawdown circuit breakers,
 * daily loss limits, and minimum edge requirements.
 */

import type { Signal } from "../strategies/types.js";
import type { PaperPortfolio, Trade } from "../paper-trader.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Config schema
// ---------------------------------------------------------------------------

export const riskConfigSchema = z.object({
  /** Max position size in quote currency per trade */
  maxPositionSize: z.number().positive().default(Infinity),
  /** Max total exposure in quote currency across all positions */
  maxPortfolioExposure: z.number().positive().default(Infinity),
  /** Max drawdown from peak equity (0-1). Pauses trading when hit. */
  maxDrawdownPercent: z.number().min(0).max(1).default(0.2),
  /** Max loss in quote currency per day */
  maxDailyLoss: z.number().positive().default(Infinity),
  /** Max open positions (buy signals blocked beyond this). 0 = no limit. */
  maxOpenPositions: z.number().min(0).default(Infinity),
  /** Number of ticks to wait after a losing trade before re-entering */
  cooldownAfterLossTicks: z.number().int().min(0).default(0),
  /** Minimum confidence score to allow a trade (0-1) */
  minConfidence: z.number().min(0).max(1).default(0),
  /** Minimum expected edge as percentage (signal must expect at least this return) */
  minEdgePercent: z.number().min(0).default(0),
  /** Max trades per day */
  maxTradesPerDay: z.number().positive().default(Infinity),
  /** Fee rate assumption for edge calculation */
  feeRate: z.number().min(0).default(0.001),
  /** Per-symbol exposure cap (quote currency) */
  maxSymbolExposure: z.number().positive().default(Infinity),
  /** Strategy-level drawdown limit (0-1) */
  strategyDrawdownLimit: z.number().min(0).max(1).default(1),
});

export type RiskConfig = z.infer<typeof riskConfigSchema>;

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  adjustedSignal?: Signal;
}

// ---------------------------------------------------------------------------
// Risk engine
// ---------------------------------------------------------------------------

export class RiskEngine {
  private config: RiskConfig;
  private peakEquity: number;
  private dailyLoss = 0;
  private dailyTrades = 0;
  private lastDayReset: string;
  private cooldownRemaining = 0;

  constructor(config: Partial<RiskConfig> = {}) {
    this.config = riskConfigSchema.parse(config);
    this.peakEquity = 0;
    this.lastDayReset = new Date().toDateString();
  }

  check(signal: Signal, portfolio: PaperPortfolio, recentTrades: Trade[]): RiskCheckResult {
    // Reset daily counters at day boundary
    const today = new Date().toDateString();
    if (today !== this.lastDayReset) {
      this.dailyLoss = 0;
      this.dailyTrades = 0;
      this.lastDayReset = today;
    }

    // Track peak equity for drawdown
    const equity = portfolio.quoteBalance + portfolio.initialInvestment * (portfolio.roi / 100);
    if (equity > this.peakEquity) {
      this.peakEquity = equity;
    }

    // 1. Cooldown after loss
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining--;
      return { allowed: false, reason: `Loss cooldown active (${this.cooldownRemaining} ticks remaining)` };
    }

    // 2. Max daily trades
    if (this.dailyTrades >= this.config.maxTradesPerDay) {
      return { allowed: false, reason: `Daily trade limit reached (${this.config.maxTradesPerDay})` };
    }

    // 3. Max daily loss
    if (this.dailyLoss >= this.config.maxDailyLoss) {
      return { allowed: false, reason: `Daily loss limit reached (${this.dailyLoss.toFixed(2)} >= ${this.config.maxDailyLoss})` };
    }

    // 4. Drawdown circuit breaker
    if (this.peakEquity > 0) {
      const drawdown = (this.peakEquity - equity) / this.peakEquity;
      if (drawdown >= this.config.maxDrawdownPercent) {
        return { allowed: false, reason: `Max drawdown breached (${(drawdown * 100).toFixed(1)}% >= ${(this.config.maxDrawdownPercent * 100).toFixed(1)}%)` };
      }
    }

    // 5. Minimum confidence
    if (signal.confidence < this.config.minConfidence) {
      return { allowed: false, reason: `Signal confidence too low (${signal.confidence} < ${this.config.minConfidence})` };
    }

    if (signal.action === "BUY") {
      // 6. Position size limit
      const tradeCost = signal.price * signal.amount;
      if (tradeCost > this.config.maxPositionSize) {
        return { allowed: false, reason: `Position size ${tradeCost.toFixed(2)} exceeds max ${this.config.maxPositionSize}` };
      }

      // 7. Portfolio exposure cap
      const currentExposure = portfolio.baseBalance * signal.price;
      if (currentExposure + tradeCost > this.config.maxPortfolioExposure) {
        return { allowed: false, reason: `Portfolio exposure would exceed cap (${this.config.maxPortfolioExposure})` };
      }

      // 8. Max open positions (approximate: count buys without matching sells). 0 = no limit.
      const openPositionCount = portfolio.totalBuys - portfolio.totalSells;
      if (this.config.maxOpenPositions > 0 && openPositionCount >= this.config.maxOpenPositions) {
        return { allowed: false, reason: `Max open positions reached (${openPositionCount} >= ${this.config.maxOpenPositions})` };
      }

      // 9. Minimum edge check (fee-aware)
      if (this.config.minEdgePercent > 0 && signal.takeProfit) {
        const expectedReturn = (signal.takeProfit - signal.price) / signal.price * 100;
        const feeCost = this.config.feeRate * 2 * 100; // round trip fees
        const netEdge = expectedReturn - feeCost;
        if (netEdge < this.config.minEdgePercent) {
          return { allowed: false, reason: `Expected edge ${netEdge.toFixed(2)}% below minimum ${this.config.minEdgePercent}%` };
        }
      }
    }

    return { allowed: true };
  }

  /** Call after a trade is executed to update daily counters. */
  onTradeExecuted(trade: Trade): void {
    this.dailyTrades++;
    if (trade.pnl < 0) {
      this.dailyLoss += Math.abs(trade.pnl);
      if (this.config.cooldownAfterLossTicks > 0) {
        this.cooldownRemaining = this.config.cooldownAfterLossTicks;
      }
    }
  }
}
