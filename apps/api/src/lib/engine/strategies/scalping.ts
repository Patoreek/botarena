/**
 * Scalping strategy.
 *
 * Captures micro-moves using short-period EMA momentum, ATR-based stops,
 * and volume spike detection. Tight risk controls to avoid overtrading.
 */

import { z } from "zod";
import { EMA } from "../indicators/ema.js";
import { ATR } from "../indicators/atr.js";
import { RSI } from "../indicators/rsi.js";
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

export const scalpingConfigSchema = z.object({
  totalInvestment: z.number().positive(),
  positionSizePercent: z.number().min(0.01).max(1).default(0.15),
  emaPeriod: z.number().int().min(2).default(5),
  atrPeriod: z.number().int().min(2).default(10),
  rsiPeriod: z.number().int().min(2).default(7),
  /** ATR multiplier for stop loss */
  stopAtrMultiplier: z.number().positive().default(1),
  /** ATR multiplier for take profit */
  tpAtrMultiplier: z.number().positive().default(1.5),
  /** Max ticks to hold a position before forced exit */
  maxHoldTicks: z.number().int().min(1).default(30),
  /** Cooldown ticks between trades */
  cooldownTicks: z.number().int().min(0).default(3),
  /** Max trades per session (prevent overtrading) */
  maxTradesPerSession: z.number().int().min(1).default(50),
  /** Volume spike multiplier over average to confirm entry */
  volumeSpikeThreshold: z.number().min(1).default(1.5),
  /** Min spread threshold (percent) — skip if spread too wide */
  minSpreadPercent: z.number().min(0).default(0),
  /** Momentum threshold: min EMA slope (percent change) to trigger */
  momentumThreshold: z.number().min(0).default(0.05),
  /** RSI filter: don't buy above this, don't sell below this */
  rsiMaxForBuy: z.number().min(0).max(100).default(70),
  rsiMinForSell: z.number().min(0).max(100).default(30),
  /** Fee assumption for edge calculation */
  feeRate: z.number().min(0).default(0.001),
  enableLong: z.boolean().default(true),
  enableShort: z.boolean().default(false),
});

type ScalpConfig = z.infer<typeof scalpingConfigSchema>;

export class ScalpingStrategy extends BaseStrategy {
  readonly metadata: StrategyMetadata = {
    name: "Scalping",
    slug: "SCALPING",
    description: "Micro-move capture with tight stops, volume confirmation, and overtrading controls.",
    requiredDataFeeds: ["TICKER", "KLINE"],
    supportsLong: true,
    supportsShort: true,
    supportsSpot: true,
    supportsFutures: true,
    configSchema: scalpingConfigSchema,
    defaultConfig: { emaPeriod: 5, stopAtrMultiplier: 1, tpAtrMultiplier: 1.5 },
  };

  private config!: ScalpConfig;
  private ema!: EMA;
  private atr!: ATR;
  private rsi!: RSI;
  private currentPrice = 0;
  private prevEma: number | null = null;
  private avgVolume = 0;
  private lastVolume = 0;
  private volumeCount = 0;
  private volumeSum = 0;
  private inPosition = false;
  private entryPrice = 0;
  private holdTicks = 0;
  private cooldown = 0;
  private sessionTradeCount = 0;

  init(config: unknown): void {
    this.config = scalpingConfigSchema.parse(config);
    this.ema = new EMA(this.config.emaPeriod);
    this.atr = new ATR(this.config.atrPeriod);
    this.rsi = new RSI(this.config.rsiPeriod);
  }

  onMarketData(tick: MarketTick): void {
    this.currentPrice = tick.price;
  }

  onCandle(candle: CandleData): void {
    this.prevEma = this.ema.current;
    this.ema.update(candle.close);
    this.atr.update(candle.high, candle.low, candle.close);
    this.rsi.update(candle.close);

    // Track average volume
    this.volumeSum += candle.volume;
    this.volumeCount++;
    this.avgVolume = this.volumeSum / this.volumeCount;
    this.lastVolume = candle.volume;
  }

  generateSignal(): Signal {
    if (this.currentPrice === 0 || !this.ema.ready || !this.atr.ready) {
      return this.hold(this.currentPrice, "Warming up scalping indicators");
    }

    if (this.cooldown > 0) {
      this.cooldown--;
      return this.hold(this.currentPrice, `Scalp cooldown (${this.cooldown})`);
    }

    if (this.sessionTradeCount >= this.config.maxTradesPerSession) {
      return this.hold(this.currentPrice, `Max session trades reached (${this.config.maxTradesPerSession})`);
    }

    const atrVal = this.atr.current!;
    const emaVal = this.ema.current!;
    const rsiVal = this.rsi.current;
    const positionSize = (this.config.totalInvestment * this.config.positionSizePercent) / this.currentPrice;

    // If in position, manage exit
    if (this.inPosition) {
      this.holdTicks++;

      // Time stop
      if (this.holdTicks >= this.config.maxHoldTicks) {
        return {
          action: "SELL",
          amount: positionSize,
          price: this.currentPrice,
          label: "SCALP_TIME_EXIT",
          confidence: 0.6,
          reason: `Time stop: held for ${this.holdTicks} ticks`,
          metadata: { buyPrice: this.entryPrice },
        };
      }

      // ATR stop loss
      const stopPrice = this.entryPrice - atrVal * this.config.stopAtrMultiplier;
      if (this.currentPrice <= stopPrice) {
        return {
          action: "SELL",
          amount: positionSize,
          price: this.currentPrice,
          label: "SCALP_STOP",
          confidence: 0.9,
          reason: `Scalp stop hit (${this.currentPrice.toFixed(4)} <= ${stopPrice.toFixed(4)})`,
          metadata: { buyPrice: this.entryPrice },
        };
      }

      // ATR take profit
      const tpPrice = this.entryPrice + atrVal * this.config.tpAtrMultiplier;
      if (this.currentPrice >= tpPrice) {
        return {
          action: "SELL",
          amount: positionSize,
          price: this.currentPrice,
          label: "SCALP_TP",
          confidence: 0.8,
          reason: `Scalp TP hit (${this.currentPrice.toFixed(4)} >= ${tpPrice.toFixed(4)})`,
          metadata: { buyPrice: this.entryPrice },
        };
      }

      return this.hold(this.currentPrice, `Scalp open: entry=${this.entryPrice.toFixed(4)}, hold=${this.holdTicks}`);
    }

    // Entry: momentum + volume confirmation
    if (this.prevEma !== null) {
      const emaSlope = ((emaVal - this.prevEma) / this.prevEma) * 100;
      const hasVolume = this.avgVolume > 0 && this.lastVolume >= this.avgVolume * this.config.volumeSpikeThreshold;
      const rsiOk = rsiVal === null || rsiVal <= this.config.rsiMaxForBuy;

      if (emaSlope >= this.config.momentumThreshold && hasVolume && rsiOk && this.config.enableLong) {
        // Fee-aware edge check
        const expectedMove = atrVal * this.config.tpAtrMultiplier;
        const expectedEdge = (expectedMove / this.currentPrice) * 100;
        const roundTripFees = this.config.feeRate * 2 * 100;
        if (expectedEdge <= roundTripFees) {
          return this.hold(this.currentPrice, `Edge ${expectedEdge.toFixed(3)}% <= fees ${roundTripFees.toFixed(3)}%`);
        }

        return {
          action: "BUY",
          amount: positionSize,
          price: this.currentPrice,
          label: "SCALP_ENTRY",
          confidence: Math.min(emaSlope / (this.config.momentumThreshold * 3), 1),
          reason: `Scalp entry: EMA slope=${emaSlope.toFixed(3)}%, vol=${(this.lastVolume / this.avgVolume).toFixed(1)}x avg`,
          stopLoss: this.currentPrice - atrVal * this.config.stopAtrMultiplier,
          takeProfit: this.currentPrice + atrVal * this.config.tpAtrMultiplier,
        };
      }
    }

    return this.hold(this.currentPrice, "No scalp opportunity");
  }

  onOrderFill(signal: Signal, trade: Trade): void {
    this.sessionTradeCount++;
    if (signal.action === "BUY") {
      this.inPosition = true;
      this.entryPrice = trade.price;
      this.holdTicks = 0;
    } else {
      this.inPosition = false;
      this.entryPrice = 0;
      this.holdTicks = 0;
      this.cooldown = this.config.cooldownTicks;
    }
  }

  getState(): StrategyState {
    return {
      inPosition: this.inPosition,
      entryPrice: this.entryPrice,
      holdTicks: this.holdTicks,
      sessionTradeCount: this.sessionTradeCount,
    };
  }
}

strategyRegistry.register("SCALPING", (config) => {
  const s = new ScalpingStrategy();
  s.init(config);
  return s;
}, new ScalpingStrategy().metadata);
