/**
 * DCA / Value Averaging strategy.
 *
 * Fixed interval purchases with optional dip-buying, value averaging,
 * safety order ladders, and dynamic sizing based on drawdown.
 */

import { z } from "zod";
import { EMA } from "../indicators/ema.js";
import { ATR } from "../indicators/atr.js";
import {
  BaseStrategy,
  type StrategyMetadata,
  type Signal,
  type MarketTick,
  type CandleData,
  type StrategyState,
} from "./types.js";
import type { Trade } from "../paper-trader.js";
import { strategyRegistry } from "./registry.js";

export const dcaConfigSchema = z.object({
  totalInvestment: z.number().positive(),
  /** Base buy amount in quote currency per interval */
  buyAmountQuote: z.number().positive().default(100),
  /** How many ticks between regular buys */
  buyIntervalTicks: z.number().int().min(1).default(60),
  /** Enable value averaging: adjust buy size to hit target growth */
  valueAveragingEnabled: z.boolean().default(false),
  /** Target portfolio growth per interval (quote currency) */
  valueAveragingTarget: z.number().positive().default(100),
  /** Enable dip-buying: buy extra when price drops from recent high */
  dipBuyEnabled: z.boolean().default(true),
  /** Dip threshold as percent drop from local high */
  dipThresholdPercent: z.number().positive().default(5),
  /** Multiplier for dip buy amount */
  dipMultiplier: z.number().min(1).default(2),
  /** Max total budget (stop buying after this) */
  maxBudget: z.number().positive().default(Infinity),
  /** Take profit: sell when ROI exceeds this percent */
  takeProfitPercent: z.number().positive().optional(),
  /** Safety order ladder: price drops below entry by this percent triggers additional buy */
  safetyOrderEnabled: z.boolean().default(false),
  safetyOrderStepPercent: z.number().positive().default(2),
  safetyOrderMaxCount: z.number().int().min(0).default(5),
  safetyOrderMultiplier: z.number().min(1).default(1.5),
  /** Dynamic sizing: increase buy size when drawdown from ATH is high */
  dynamicSizingEnabled: z.boolean().default(false),
  dynamicSizingMaxMultiplier: z.number().min(1).default(3),
  /** Pause buying if total spent exceeds this */
  pauseAfterSpent: z.number().positive().default(Infinity),
});

type DCAConfig = z.infer<typeof dcaConfigSchema>;

export class DCAStrategy extends BaseStrategy {
  readonly metadata: StrategyMetadata = {
    name: "DCA / Value Averaging",
    slug: "DCA",
    description: "Systematic buying at fixed intervals with optional dip-buying, safety orders, and value averaging.",
    requiredDataFeeds: ["TICKER"],
    supportsLong: true,
    supportsShort: false,
    supportsSpot: true,
    supportsFutures: false,
    configSchema: dcaConfigSchema,
    defaultConfig: { buyAmountQuote: 100, buyIntervalTicks: 60 },
  };

  private config!: DCAConfig;
  private currentPrice = 0;
  private ticksSinceLastBuy = 0;
  private totalSpent = 0;
  private totalBaseAcquired = 0;
  private avgEntryPrice = 0;
  private localHigh = 0;
  private safetyOrdersFilled = 0;
  private lastSafetyOrderPrice = 0;
  private ema = new EMA(20);

  init(config: unknown): void {
    this.config = dcaConfigSchema.parse(config);
  }

  onMarketData(tick: MarketTick): void {
    this.currentPrice = tick.price;
    if (tick.price > this.localHigh) {
      this.localHigh = tick.price;
    }
    this.ema.update(tick.price);
  }

  onCandle(candle: CandleData): void {
    this.ema.update(candle.close);
  }

  generateSignal(): Signal {
    if (this.currentPrice === 0) {
      return this.hold(0, "Waiting for price data");
    }

    this.ticksSinceLastBuy++;

    // Take profit check
    if (this.config.takeProfitPercent && this.avgEntryPrice > 0 && this.totalBaseAcquired > 0) {
      const roi = ((this.currentPrice - this.avgEntryPrice) / this.avgEntryPrice) * 100;
      if (roi >= this.config.takeProfitPercent) {
        return {
          action: "SELL",
          amount: this.totalBaseAcquired,
          price: this.currentPrice,
          label: "DCA_TP",
          confidence: 0.8,
          reason: `Take profit: ROI ${roi.toFixed(2)}% >= ${this.config.takeProfitPercent}%`,
          metadata: { buyPrice: this.avgEntryPrice },
        };
      }
    }

    // Budget exhausted
    if (this.totalSpent >= this.config.maxBudget || this.totalSpent >= this.config.pauseAfterSpent) {
      return this.hold(this.currentPrice, `Budget exhausted (spent ${this.totalSpent.toFixed(2)} of ${this.config.maxBudget})`);
    }

    // Safety order ladder
    if (this.config.safetyOrderEnabled && this.avgEntryPrice > 0 && this.safetyOrdersFilled < this.config.safetyOrderMaxCount) {
      const nextSafetyDrop = this.config.safetyOrderStepPercent * (this.safetyOrdersFilled + 1);
      const safetyPrice = this.avgEntryPrice * (1 - nextSafetyDrop / 100);
      if (this.currentPrice <= safetyPrice) {
        const safetyAmount = this.config.buyAmountQuote * Math.pow(this.config.safetyOrderMultiplier, this.safetyOrdersFilled + 1);
        return {
          action: "BUY",
          amount: safetyAmount / this.currentPrice,
          price: this.currentPrice,
          label: `DCA_SAFETY_${this.safetyOrdersFilled + 1}`,
          confidence: 0.7,
          reason: `Safety order #${this.safetyOrdersFilled + 1}: price ${this.currentPrice.toFixed(4)} <= ${safetyPrice.toFixed(4)} (${nextSafetyDrop}% below avg entry)`,
        };
      }
    }

    // Dip buying
    if (this.config.dipBuyEnabled && this.localHigh > 0) {
      const dropPercent = ((this.localHigh - this.currentPrice) / this.localHigh) * 100;
      if (dropPercent >= this.config.dipThresholdPercent) {
        const dipAmount = this.config.buyAmountQuote * this.config.dipMultiplier;
        return {
          action: "BUY",
          amount: dipAmount / this.currentPrice,
          price: this.currentPrice,
          label: "DCA_DIP",
          confidence: 0.65,
          reason: `Dip buy: ${dropPercent.toFixed(1)}% drop from local high ${this.localHigh.toFixed(4)}`,
        };
      }
    }

    // Regular interval buy
    if (this.ticksSinceLastBuy >= this.config.buyIntervalTicks) {
      let buyAmount = this.config.buyAmountQuote;

      // Value averaging: adjust to meet target growth
      if (this.config.valueAveragingEnabled && this.totalBaseAcquired > 0) {
        const currentValue = this.totalBaseAcquired * this.currentPrice;
        const targetValue = this.totalSpent + this.config.valueAveragingTarget;
        const needed = targetValue - currentValue;
        buyAmount = Math.max(needed, this.config.buyAmountQuote * 0.1); // min 10% of base amount
      }

      // Dynamic sizing based on drawdown
      if (this.config.dynamicSizingEnabled && this.avgEntryPrice > 0) {
        const drawdown = Math.max(0, (this.avgEntryPrice - this.currentPrice) / this.avgEntryPrice);
        const multiplier = 1 + drawdown * (this.config.dynamicSizingMaxMultiplier - 1);
        buyAmount *= Math.min(multiplier, this.config.dynamicSizingMaxMultiplier);
      }

      return {
        action: "BUY",
        amount: buyAmount / this.currentPrice,
        price: this.currentPrice,
        label: "DCA_REGULAR",
        confidence: 0.5,
        reason: `Regular DCA buy (tick ${this.ticksSinceLastBuy}/${this.config.buyIntervalTicks})`,
      };
    }

    return this.hold(this.currentPrice, `Next DCA in ${this.config.buyIntervalTicks - this.ticksSinceLastBuy} ticks, avg entry: ${this.avgEntryPrice.toFixed(4)}`);
  }

  onOrderFill(signal: Signal, trade: Trade): void {
    if (signal.action === "BUY") {
      this.totalSpent += trade.cost + trade.fee;
      this.totalBaseAcquired += trade.amount;
      this.avgEntryPrice = this.totalSpent / this.totalBaseAcquired;
      this.ticksSinceLastBuy = 0;

      if (signal.label.startsWith("DCA_SAFETY_")) {
        this.safetyOrdersFilled++;
        this.lastSafetyOrderPrice = trade.price;
      }
    } else if (signal.action === "SELL") {
      // Full exit
      this.totalBaseAcquired = 0;
      this.avgEntryPrice = 0;
      this.safetyOrdersFilled = 0;
      this.totalSpent = 0;
      this.localHigh = this.currentPrice;
    }
  }

  getState(): StrategyState {
    return {
      totalSpent: this.totalSpent,
      totalBaseAcquired: this.totalBaseAcquired,
      avgEntryPrice: this.avgEntryPrice,
      safetyOrdersFilled: this.safetyOrdersFilled,
      ticksSinceLastBuy: this.ticksSinceLastBuy,
      localHigh: this.localHigh,
    };
  }
}

strategyRegistry.register("DCA", (config) => {
  const s = new DCAStrategy();
  s.init(config);
  return s;
}, new DCAStrategy().metadata);
