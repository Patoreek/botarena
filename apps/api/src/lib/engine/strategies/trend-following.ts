/**
 * Trend Following strategy.
 *
 * Uses EMA crossover (fast/slow) with optional ADX trend-strength filter
 * and MACD confirmation. Supports pullback entries, pyramiding, and
 * higher-timeframe confirmation via candle data.
 */

import { z } from "zod";
import { EMA } from "../indicators/ema.js";
import { ADX } from "../indicators/adx.js";
import { MACD } from "../indicators/macd.js";
import { ATR } from "../indicators/atr.js";
import {
  BaseStrategy,
  type StrategyMetadata,
  type Signal,
  type MarketTick,
  type CandleData,
  type StrategyState,
} from "./types.js";
import type { Trade, PaperPortfolio } from "../paper-trader.js";
import { strategyRegistry } from "./registry.js";

export const trendFollowingConfigSchema = z.object({
  totalInvestment: z.number().positive(),
  positionSizePercent: z.number().min(0.01).max(1).default(0.1),
  fastPeriod: z.number().int().min(2).default(9),
  slowPeriod: z.number().int().min(5).default(21),
  adxPeriod: z.number().int().min(5).default(14),
  adxThreshold: z.number().min(0).default(25),
  useMacdConfirmation: z.boolean().default(false),
  macdFast: z.number().int().default(12),
  macdSlow: z.number().int().default(26),
  macdSignal: z.number().int().default(9),
  atrPeriod: z.number().int().default(14),
  stopLossAtrMultiplier: z.number().positive().default(2),
  takeProfitAtrMultiplier: z.number().positive().default(3),
  cooldownTicks: z.number().int().min(0).default(5),
  maxPositions: z.number().int().min(1).default(3),
  enablePyramiding: z.boolean().default(false),
  pyramidMaxEntries: z.number().int().min(1).default(3),
  pullbackEntryEnabled: z.boolean().default(false),
  pullbackThresholdPercent: z.number().min(0).default(0.5),
  enableLong: z.boolean().default(true),
  enableShort: z.boolean().default(false),
});

type TrendConfig = z.infer<typeof trendFollowingConfigSchema>;

export class TrendFollowingStrategy extends BaseStrategy {
  readonly metadata: StrategyMetadata = {
    name: "Trend Following",
    slug: "TREND_FOLLOWING",
    description: "EMA crossover with ADX filter and optional MACD confirmation. Rides trends with ATR-based stops.",
    requiredDataFeeds: ["TICKER", "KLINE"],
    supportsLong: true,
    supportsShort: true,
    supportsSpot: true,
    supportsFutures: true,
    configSchema: trendFollowingConfigSchema,
    defaultConfig: { fastPeriod: 9, slowPeriod: 21, adxThreshold: 25 },
  };

  private config!: TrendConfig;
  private fastEMA!: EMA;
  private slowEMA!: EMA;
  private adx!: ADX;
  private macd!: MACD;
  private atr!: ATR;
  private currentPrice = 0;
  private prevFastAboveSlow = false;
  private cooldown = 0;
  private openPositionCount = 0;
  private pyramidEntries = 0;
  private avgEntryPrice = 0;
  private lastHigh = 0;
  private lastLow = Infinity;

  init(config: unknown, _state?: StrategyState): void {
    this.config = trendFollowingConfigSchema.parse(config);
    this.fastEMA = new EMA(this.config.fastPeriod);
    this.slowEMA = new EMA(this.config.slowPeriod);
    this.adx = new ADX(this.config.adxPeriod);
    this.macd = new MACD(this.config.macdFast, this.config.macdSlow, this.config.macdSignal);
    this.atr = new ATR(this.config.atrPeriod);
  }

  onMarketData(tick: MarketTick): void {
    this.currentPrice = tick.price;
  }

  onCandle(candle: CandleData): void {
    this.fastEMA.update(candle.close);
    this.slowEMA.update(candle.close);
    this.adx.update(candle.high, candle.low, candle.close);
    this.macd.update(candle.close);
    this.atr.update(candle.high, candle.low, candle.close);
    this.lastHigh = candle.high;
    this.lastLow = candle.low;
  }

  generateSignal(): Signal {
    if (this.currentPrice === 0 || !this.fastEMA.ready || !this.slowEMA.ready) {
      return this.hold(this.currentPrice, "Warming up indicators");
    }

    if (this.cooldown > 0) {
      this.cooldown--;
      return this.hold(this.currentPrice, `Cooldown (${this.cooldown} ticks remaining)`);
    }

    const fast = this.fastEMA.current!;
    const slow = this.slowEMA.current!;
    const fastAboveSlow = fast > slow;
    const crossedUp = fastAboveSlow && !this.prevFastAboveSlow;
    const crossedDown = !fastAboveSlow && this.prevFastAboveSlow;
    this.prevFastAboveSlow = fastAboveSlow;

    // ADX filter
    const adxResult = this.adx.current;
    if (adxResult && adxResult.adx < this.config.adxThreshold) {
      return this.hold(this.currentPrice, `ADX ${adxResult.adx.toFixed(1)} below threshold ${this.config.adxThreshold}`);
    }

    // MACD confirmation
    if (this.config.useMacdConfirmation && this.macd.ready) {
      const macdResult = this.macd.current!;
      if (crossedUp && macdResult.histogram < 0) {
        return this.hold(this.currentPrice, "EMA crossover up but MACD histogram negative");
      }
      if (crossedDown && macdResult.histogram > 0) {
        return this.hold(this.currentPrice, "EMA crossover down but MACD histogram positive");
      }
    }

    const atrValue = this.atr.current ?? this.currentPrice * 0.02;
    const positionSize = (this.config.totalInvestment * this.config.positionSizePercent) / this.currentPrice;

    // Entry signals
    if (crossedUp && this.config.enableLong) {
      if (this.openPositionCount >= this.config.maxPositions) {
        return this.hold(this.currentPrice, "Max positions reached");
      }
      return {
        action: "BUY",
        amount: positionSize,
        price: this.currentPrice,
        label: "TREND_LONG",
        confidence: adxResult ? Math.min(adxResult.adx / 50, 1) : 0.6,
        reason: `EMA crossover UP (fast ${fast.toFixed(4)} > slow ${slow.toFixed(4)})`,
        stopLoss: this.currentPrice - atrValue * this.config.stopLossAtrMultiplier,
        takeProfit: this.currentPrice + atrValue * this.config.takeProfitAtrMultiplier,
      };
    }

    // Pyramiding: add to winning position
    if (this.config.enablePyramiding && fastAboveSlow && this.openPositionCount > 0 && this.pyramidEntries < this.config.pyramidMaxEntries) {
      if (this.currentPrice > this.avgEntryPrice * 1.01) {
        return {
          action: "BUY",
          amount: positionSize * 0.5,
          price: this.currentPrice,
          label: "TREND_PYRAMID",
          confidence: 0.5,
          reason: `Pyramiding: price ${this.currentPrice.toFixed(4)} above avg entry ${this.avgEntryPrice.toFixed(4)}`,
          stopLoss: this.currentPrice - atrValue * this.config.stopLossAtrMultiplier,
        };
      }
    }

    // Exit on crossover down
    if (crossedDown && this.openPositionCount > 0) {
      return {
        action: "SELL",
        amount: positionSize * this.openPositionCount,
        price: this.currentPrice,
        label: "TREND_EXIT",
        confidence: 0.7,
        reason: `EMA crossover DOWN (fast ${fast.toFixed(4)} < slow ${slow.toFixed(4)})`,
        metadata: { buyPrice: this.avgEntryPrice },
      };
    }

    // ATR stop-loss check
    if (this.openPositionCount > 0 && this.avgEntryPrice > 0) {
      const stopPrice = this.avgEntryPrice - atrValue * this.config.stopLossAtrMultiplier;
      if (this.currentPrice <= stopPrice) {
        return {
          action: "SELL",
          amount: positionSize * this.openPositionCount,
          price: this.currentPrice,
          label: "TREND_STOP",
          confidence: 0.9,
          reason: `ATR stop hit (price ${this.currentPrice.toFixed(4)} <= stop ${stopPrice.toFixed(4)})`,
          metadata: { buyPrice: this.avgEntryPrice },
        };
      }
    }

    return this.hold(this.currentPrice, `Trend ${fastAboveSlow ? "UP" : "DOWN"}, no signal`);
  }

  onOrderFill(signal: Signal, trade: Trade): void {
    if (signal.action === "BUY") {
      const totalCost = this.avgEntryPrice * this.openPositionCount + trade.price;
      this.openPositionCount++;
      this.pyramidEntries++;
      this.avgEntryPrice = totalCost / this.openPositionCount;
    } else if (signal.action === "SELL") {
      this.openPositionCount = 0;
      this.pyramidEntries = 0;
      this.avgEntryPrice = 0;
      this.cooldown = this.config.cooldownTicks;
    }
  }

  getState(): StrategyState {
    return {
      openPositionCount: this.openPositionCount,
      pyramidEntries: this.pyramidEntries,
      avgEntryPrice: this.avgEntryPrice,
      cooldown: this.cooldown,
    };
  }
}

strategyRegistry.register("TREND_FOLLOWING", (config) => {
  const s = new TrendFollowingStrategy();
  s.init(config);
  return s;
}, new TrendFollowingStrategy().metadata);
