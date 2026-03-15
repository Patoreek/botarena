/**
 * Arbitrage strategy.
 *
 * Scaffolds cross-exchange and triangular arbitrage with clean interfaces.
 * Since the current repo only supports Binance, this strategy simulates
 * spread detection using configurable synthetic spreads and demonstrates
 * the execution pattern. Mark integration points for real multi-exchange support.
 */

import { z } from "zod";
import {
  BaseStrategy,
  type StrategyMetadata,
  type Signal,
  type MarketTick,
  type StrategyState,
} from "./types.js";
import type { Trade } from "../paper-trader.js";
import { strategyRegistry } from "./registry.js";

// ---------------------------------------------------------------------------
// Exchange capability abstraction — extend when multi-exchange is added
// ---------------------------------------------------------------------------

export interface ExchangeQuote {
  exchange: string;
  bid: number;
  ask: number;
  timestamp: number;
}

export interface ArbOpportunity {
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  grossSpread: number;
  netSpread: number;
  isViable: boolean;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const arbitrageConfigSchema = z.object({
  totalInvestment: z.number().positive(),
  positionSizePercent: z.number().min(0.01).max(1).default(0.1),
  /** Minimum net spread (after fees + slippage) to trigger a trade, in percent */
  minNetSpreadPercent: z.number().positive().default(0.15),
  /** Assumed fee rate per exchange (one-way) */
  feeRateA: z.number().min(0).default(0.001),
  feeRateB: z.number().min(0).default(0.001),
  /** Assumed slippage per side in percent */
  slippagePercent: z.number().min(0).default(0.05),
  /** Transfer latency buffer — reject if quotes are older than this (ms) */
  maxQuoteAgeMs: z.number().positive().default(5000),
  /** Cooldown ticks between arb executions */
  cooldownTicks: z.number().int().min(0).default(3),
  /** Max concurrent arb positions */
  maxPositions: z.number().int().min(1).default(1),
  /**
   * Simulated spread mode: in single-exchange mode, we synthetically create
   * a spread by comparing the current price to a lagged EMA.
   */
  syntheticSpreadEmaPeriod: z.number().int().min(2).default(20),
});

type ArbConfig = z.infer<typeof arbitrageConfigSchema>;

export class ArbitrageStrategy extends BaseStrategy {
  readonly metadata: StrategyMetadata = {
    name: "Arbitrage",
    slug: "ARBITRAGE",
    description: "Cross-exchange or synthetic spread arbitrage. Fee and slippage-aware profitability calculation.",
    requiredDataFeeds: ["TICKER"],
    supportsLong: true,
    supportsShort: false,
    supportsSpot: true,
    supportsFutures: true,
    configSchema: arbitrageConfigSchema,
    defaultConfig: { minNetSpreadPercent: 0.15 },
  };

  private config!: ArbConfig;
  private currentPrice = 0;
  private priceHistory: number[] = [];
  private openPositionCount = 0;
  private cooldown = 0;
  private avgEntryPrice = 0;

  init(config: unknown): void {
    this.config = arbitrageConfigSchema.parse(config);
  }

  onMarketData(tick: MarketTick): void {
    this.currentPrice = tick.price;
    this.priceHistory.push(tick.price);
    if (this.priceHistory.length > this.config.syntheticSpreadEmaPeriod * 2) {
      this.priceHistory.shift();
    }
  }

  generateSignal(): Signal {
    if (this.currentPrice === 0 || this.priceHistory.length < this.config.syntheticSpreadEmaPeriod) {
      return this.hold(this.currentPrice, "Building price history for synthetic spread");
    }

    if (this.cooldown > 0) {
      this.cooldown--;
      return this.hold(this.currentPrice, `Arb cooldown (${this.cooldown} ticks)`);
    }

    // Synthetic spread: compare current price to lagged average (simulates quote from slower exchange)
    const laggedSlice = this.priceHistory.slice(-this.config.syntheticSpreadEmaPeriod);
    const laggedAvg = laggedSlice.reduce((s, v) => s + v, 0) / laggedSlice.length;

    const opp = this.evaluateOpportunity(this.currentPrice, laggedAvg);

    // Exit: if we have a position and spread has collapsed or reversed
    if (this.openPositionCount > 0) {
      if (this.currentPrice >= this.avgEntryPrice * (1 + this.config.minNetSpreadPercent / 100)) {
        return {
          action: "SELL",
          amount: (this.config.totalInvestment * this.config.positionSizePercent) / this.currentPrice,
          price: this.currentPrice,
          label: "ARB_CLOSE",
          confidence: 0.7,
          reason: `Closing arb: price ${this.currentPrice.toFixed(4)} above entry ${this.avgEntryPrice.toFixed(4)}`,
          metadata: { buyPrice: this.avgEntryPrice },
        };
      }
      return this.hold(this.currentPrice, `Arb open, waiting for convergence (entry=${this.avgEntryPrice.toFixed(4)})`);
    }

    // Entry
    if (opp.isViable && this.openPositionCount < this.config.maxPositions) {
      const positionSize = (this.config.totalInvestment * this.config.positionSizePercent) / this.currentPrice;
      return {
        action: "BUY",
        amount: positionSize,
        price: this.currentPrice,
        label: "ARB_ENTRY",
        confidence: Math.min(opp.netSpread / this.config.minNetSpreadPercent, 1),
        reason: `Arb opportunity: gross=${opp.grossSpread.toFixed(3)}%, net=${opp.netSpread.toFixed(3)}% (buy@${opp.buyPrice.toFixed(4)} → sell@${opp.sellPrice.toFixed(4)})`,
      };
    }

    return this.hold(this.currentPrice, `No arb: gross=${opp.grossSpread.toFixed(3)}%, net=${opp.netSpread.toFixed(3)}%`);
  }

  private evaluateOpportunity(currentPrice: number, laggedPrice: number): ArbOpportunity {
    const buyPrice = Math.min(currentPrice, laggedPrice);
    const sellPrice = Math.max(currentPrice, laggedPrice);
    const grossSpread = ((sellPrice - buyPrice) / buyPrice) * 100;
    const totalFees = (this.config.feeRateA + this.config.feeRateB) * 100;
    const totalSlippage = this.config.slippagePercent * 2;
    const netSpread = grossSpread - totalFees - totalSlippage;

    return {
      buyExchange: "exchange_a",
      sellExchange: "exchange_b",
      buyPrice,
      sellPrice,
      grossSpread,
      netSpread,
      isViable: netSpread >= this.config.minNetSpreadPercent,
    };
  }

  onOrderFill(signal: Signal, trade: Trade): void {
    if (signal.action === "BUY") {
      this.openPositionCount++;
      this.avgEntryPrice = trade.price;
    } else {
      this.openPositionCount = 0;
      this.avgEntryPrice = 0;
      this.cooldown = this.config.cooldownTicks;
    }
  }

  getState(): StrategyState {
    return {
      openPositionCount: this.openPositionCount,
      avgEntryPrice: this.avgEntryPrice,
      cooldown: this.cooldown,
    };
  }
}

strategyRegistry.register("ARBITRAGE", (config) => {
  const s = new ArbitrageStrategy();
  s.init(config);
  return s;
}, new ArbitrageStrategy().metadata);
