/**
 * Mean Reversion strategy.
 *
 * Buys when price is statistically cheap (RSI oversold + below Bollinger lower band)
 * and sells when price reverts to mean or hits overbought levels.
 * Includes trend filter to avoid fading strong trends.
 */

import { z } from "zod";
import { RSI } from "../indicators/rsi.js";
import { BollingerBands } from "../indicators/bollinger.js";
import { EMA } from "../indicators/ema.js";
import { ZScore } from "../indicators/zscore.js";
import { VWAP } from "../indicators/vwap.js";
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

export const meanReversionConfigSchema = z.object({
  totalInvestment: z.number().positive(),
  positionSizePercent: z.number().min(0.01).max(1).default(0.1),
  rsiPeriod: z.number().int().min(2).default(14),
  rsiOversold: z.number().min(0).max(100).default(30),
  rsiOverbought: z.number().min(0).max(100).default(70),
  bbPeriod: z.number().int().min(5).default(20),
  bbStdDev: z.number().positive().default(2),
  zScorePeriod: z.number().int().min(5).default(20),
  zScoreEntryThreshold: z.number().positive().default(2),
  zScoreExitThreshold: z.number().min(0).default(0.5),
  useVwapDeviation: z.boolean().default(false),
  vwapDeviationThreshold: z.number().positive().default(1.5),
  trendFilterPeriod: z.number().int().min(10).default(50),
  trendFilterEnabled: z.boolean().default(true),
  exitMode: z.enum(["MEAN_REVERSION", "FIXED_TARGET", "BOTH"]).default("MEAN_REVERSION"),
  fixedTargetPercent: z.number().positive().default(1),
  maxPositions: z.number().int().min(1).default(3),
  cooldownTicks: z.number().int().min(0).default(3),
  stopLossPercent: z.number().positive().default(3),
  enableLong: z.boolean().default(true),
  enableShort: z.boolean().default(false),
});

type MRConfig = z.infer<typeof meanReversionConfigSchema>;

export class MeanReversionStrategy extends BaseStrategy {
  readonly metadata: StrategyMetadata = {
    name: "Mean Reversion",
    slug: "MEAN_REVERSION",
    description: "Buys oversold conditions (RSI + Bollinger) and sells on mean reversion. Trend filter prevents fading strong moves.",
    requiredDataFeeds: ["TICKER", "KLINE"],
    supportsLong: true,
    supportsShort: true,
    supportsSpot: true,
    supportsFutures: true,
    configSchema: meanReversionConfigSchema,
    defaultConfig: { rsiOversold: 30, rsiOverbought: 70, bbStdDev: 2 },
  };

  private config!: MRConfig;
  private rsi!: RSI;
  private bb!: BollingerBands;
  private zScore!: ZScore;
  private vwap!: VWAP;
  private trendEMA!: EMA;
  private currentPrice = 0;
  private openPositionCount = 0;
  private avgEntryPrice = 0;
  private cooldown = 0;

  init(config: unknown): void {
    this.config = meanReversionConfigSchema.parse(config);
    this.rsi = new RSI(this.config.rsiPeriod);
    this.bb = new BollingerBands(this.config.bbPeriod, this.config.bbStdDev);
    this.zScore = new ZScore(this.config.zScorePeriod);
    this.vwap = new VWAP();
    this.trendEMA = new EMA(this.config.trendFilterPeriod);
  }

  onMarketData(tick: MarketTick): void {
    this.currentPrice = tick.price;
  }

  onCandle(candle: CandleData): void {
    this.rsi.update(candle.close);
    this.bb.update(candle.close);
    this.zScore.update(candle.close);
    this.vwap.update(candle.high, candle.low, candle.close, candle.volume);
    this.trendEMA.update(candle.close);
  }

  generateSignal(): Signal {
    if (this.currentPrice === 0 || !this.rsi.ready || !this.bb.ready) {
      return this.hold(this.currentPrice, "Warming up indicators");
    }

    if (this.cooldown > 0) {
      this.cooldown--;
      return this.hold(this.currentPrice, `Cooldown (${this.cooldown} ticks remaining)`);
    }

    const rsiVal = this.rsi.current!;
    const bbVal = this.bb.current!;
    const zVal = this.zScore.current;
    const positionSize = (this.config.totalInvestment * this.config.positionSizePercent) / this.currentPrice;

    // Trend filter: don't buy in a downtrend, don't short in uptrend
    if (this.config.trendFilterEnabled && this.trendEMA.ready) {
      const trend = this.trendEMA.current!;
      const trendDown = this.currentPrice < trend * 0.98;
      if (trendDown && this.config.enableLong) {
        return this.hold(this.currentPrice, `Trend filter: price below EMA${this.config.trendFilterPeriod}, avoiding long`);
      }
    }

    // EXIT: check if we should close existing positions
    if (this.openPositionCount > 0) {
      let shouldExit = false;
      let exitReason = "";

      // Mean reversion exit: price back to middle band
      if (this.config.exitMode !== "FIXED_TARGET" && this.currentPrice >= bbVal.middle) {
        shouldExit = true;
        exitReason = `Price reverted to BB middle (${bbVal.middle.toFixed(4)})`;
      }

      // Fixed target exit
      if (this.config.exitMode !== "MEAN_REVERSION" && this.avgEntryPrice > 0) {
        const targetPrice = this.avgEntryPrice * (1 + this.config.fixedTargetPercent / 100);
        if (this.currentPrice >= targetPrice) {
          shouldExit = true;
          exitReason = `Fixed target hit (${targetPrice.toFixed(4)})`;
        }
      }

      // RSI overbought exit
      if (rsiVal >= this.config.rsiOverbought) {
        shouldExit = true;
        exitReason = `RSI overbought (${rsiVal.toFixed(1)})`;
      }

      // Stop loss
      if (this.avgEntryPrice > 0) {
        const stopPrice = this.avgEntryPrice * (1 - this.config.stopLossPercent / 100);
        if (this.currentPrice <= stopPrice) {
          shouldExit = true;
          exitReason = `Stop loss hit (${stopPrice.toFixed(4)})`;
        }
      }

      if (shouldExit) {
        return {
          action: "SELL",
          amount: positionSize * this.openPositionCount,
          price: this.currentPrice,
          label: "MR_EXIT",
          confidence: 0.7,
          reason: exitReason,
          metadata: { buyPrice: this.avgEntryPrice },
        };
      }
    }

    // ENTRY: look for oversold conditions
    if (this.openPositionCount >= this.config.maxPositions) {
      return this.hold(this.currentPrice, "Max positions reached");
    }

    const isOversold = rsiVal <= this.config.rsiOversold;
    const isBelowLowerBand = this.currentPrice <= bbVal.lower;
    const zScoreOversold = zVal !== null && zVal <= -this.config.zScoreEntryThreshold;

    // Require at least RSI oversold + one more confirmation
    if (isOversold && (isBelowLowerBand || zScoreOversold)) {
      const confidence = Math.min(
        (this.config.rsiOversold - rsiVal) / this.config.rsiOversold +
        (isBelowLowerBand ? 0.3 : 0) +
        (zScoreOversold ? 0.2 : 0),
        1,
      );

      return {
        action: "BUY",
        amount: positionSize,
        price: this.currentPrice,
        label: "MR_ENTRY",
        confidence,
        reason: `Oversold: RSI=${rsiVal.toFixed(1)}, BB%B=${bbVal.percentB.toFixed(2)}${zVal ? `, Z=${zVal.toFixed(2)}` : ""}`,
        stopLoss: this.currentPrice * (1 - this.config.stopLossPercent / 100),
        takeProfit: bbVal.middle,
      };
    }

    return this.hold(this.currentPrice, `RSI=${rsiVal.toFixed(1)}, BB%B=${bbVal.percentB.toFixed(2)}, no signal`);
  }

  onOrderFill(signal: Signal, trade: Trade): void {
    if (signal.action === "BUY") {
      const totalCost = this.avgEntryPrice * this.openPositionCount + trade.price;
      this.openPositionCount++;
      this.avgEntryPrice = totalCost / this.openPositionCount;
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

strategyRegistry.register("MEAN_REVERSION", (config) => {
  const s = new MeanReversionStrategy();
  s.init(config);
  return s;
}, new MeanReversionStrategy().metadata);
