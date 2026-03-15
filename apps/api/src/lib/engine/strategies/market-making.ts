/**
 * Market Making strategy.
 *
 * Quotes both sides around a fair price estimate, earns the bid-ask spread.
 * Uses VWAP for fair value, inventory-aware skewing, and pauses during
 * high-volatility events.
 */

import { z } from "zod";
import { EMA } from "../indicators/ema.js";
import { ATR } from "../indicators/atr.js";
import { VWAP } from "../indicators/vwap.js";
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

export const marketMakingConfigSchema = z.object({
  totalInvestment: z.number().positive(),
  orderSizePercent: z.number().min(0.01).max(1).default(0.05),
  spreadPercent: z.number().positive().default(0.3),
  dynamicSpreadEnabled: z.boolean().default(true),
  dynamicSpreadAtrMultiplier: z.number().positive().default(1),
  maxInventory: z.number().positive().default(10),
  inventorySkewFactor: z.number().min(0).max(1).default(0.5),
  refreshIntervalTicks: z.number().int().min(1).default(1),
  maxVolatilityPause: z.number().positive().default(5),
  atrPeriod: z.number().int().default(14),
  fairPriceSource: z.enum(["VWAP", "EMA", "MID"]).default("EMA"),
  emaPeriod: z.number().int().default(20),
  adverseSelectionLookback: z.number().int().min(1).default(5),
  adverseSelectionThreshold: z.number().positive().default(1),
});

type MMConfig = z.infer<typeof marketMakingConfigSchema>;

export class MarketMakingStrategy extends BaseStrategy {
  readonly metadata: StrategyMetadata = {
    name: "Market Making",
    slug: "MARKET_MAKING",
    description: "Quotes both sides around fair price, earns spread. Inventory-aware skewing with volatility pause.",
    requiredDataFeeds: ["TICKER", "KLINE"],
    supportsLong: true,
    supportsShort: true,
    supportsSpot: true,
    supportsFutures: true,
    configSchema: marketMakingConfigSchema,
    defaultConfig: { spreadPercent: 0.3, maxInventory: 10 },
  };

  private config!: MMConfig;
  private ema!: EMA;
  private atr!: ATR;
  private vwap!: VWAP;
  private currentPrice = 0;
  private inventory = 0; // positive = long, negative = short
  private ticksSinceRefresh = 0;
  private recentPrices: number[] = [];
  private lastSide: "BUY" | "SELL" | null = null;
  private paused = false;

  init(config: unknown): void {
    this.config = marketMakingConfigSchema.parse(config);
    this.ema = new EMA(this.config.emaPeriod);
    this.atr = new ATR(this.config.atrPeriod);
    this.vwap = new VWAP();
  }

  onMarketData(tick: MarketTick): void {
    this.currentPrice = tick.price;
    this.recentPrices.push(tick.price);
    if (this.recentPrices.length > this.config.adverseSelectionLookback) {
      this.recentPrices.shift();
    }
  }

  onCandle(candle: CandleData): void {
    this.ema.update(candle.close);
    this.atr.update(candle.high, candle.low, candle.close);
    this.vwap.update(candle.high, candle.low, candle.close, candle.volume);
  }

  generateSignal(): Signal {
    if (this.currentPrice === 0 || !this.ema.ready) {
      return this.hold(this.currentPrice, "Warming up fair price estimate");
    }

    this.ticksSinceRefresh++;

    // Volatility spike detection
    if (this.atr.ready) {
      const atrVal = this.atr.current!;
      const volatilityRatio = atrVal / this.currentPrice * 100;
      if (volatilityRatio > this.config.maxVolatilityPause) {
        this.paused = true;
        return this.hold(this.currentPrice, `Volatility spike (ATR/Price=${volatilityRatio.toFixed(2)}% > ${this.config.maxVolatilityPause}%), pausing`);
      }
      this.paused = false;
    }

    // Adverse selection check: if price moved strongly since last fill, skip
    if (this.recentPrices.length >= this.config.adverseSelectionLookback) {
      const oldest = this.recentPrices[0];
      const movePercent = Math.abs(this.currentPrice - oldest) / oldest * 100;
      if (movePercent > this.config.adverseSelectionThreshold) {
        return this.hold(this.currentPrice, `Adverse selection filter: ${movePercent.toFixed(2)}% move detected`);
      }
    }

    // Only refresh quotes at configured interval
    if (this.ticksSinceRefresh < this.config.refreshIntervalTicks) {
      return this.hold(this.currentPrice, `Quote refresh in ${this.config.refreshIntervalTicks - this.ticksSinceRefresh} ticks`);
    }
    this.ticksSinceRefresh = 0;

    // Compute fair price
    let fairPrice = this.currentPrice;
    if (this.config.fairPriceSource === "EMA") {
      fairPrice = this.ema.current!;
    } else if (this.config.fairPriceSource === "VWAP" && this.vwap.ready) {
      fairPrice = this.vwap.current!.vwap;
    }

    // Compute spread (optionally ATR-adjusted)
    let spreadBps = this.config.spreadPercent / 100;
    if (this.config.dynamicSpreadEnabled && this.atr.ready) {
      const atrSpread = (this.atr.current! / this.currentPrice) * this.config.dynamicSpreadAtrMultiplier;
      spreadBps = Math.max(spreadBps, atrSpread);
    }
    const halfSpread = fairPrice * spreadBps / 2;

    // Inventory skewing: shift quotes to reduce inventory
    const skew = this.inventory * this.config.inventorySkewFactor * halfSpread / this.config.maxInventory;
    const bidPrice = fairPrice - halfSpread - skew;
    const askPrice = fairPrice + halfSpread - skew;

    const orderSize = (this.config.totalInvestment * this.config.orderSizePercent) / this.currentPrice;

    // Determine which side to quote
    const shouldBuy = this.inventory < this.config.maxInventory && this.currentPrice <= bidPrice;
    const shouldSell = this.inventory > -this.config.maxInventory && this.currentPrice >= askPrice;

    // Alternate sides to avoid always filling one side
    if (shouldBuy && shouldSell) {
      // Price is somehow at both thresholds (shouldn't happen often), prefer reducing inventory
      if (this.inventory > 0) {
        return this.makeSellSignal(askPrice, orderSize);
      }
      return this.makeBuySignal(bidPrice, orderSize);
    }

    if (shouldBuy) {
      return this.makeBuySignal(bidPrice, orderSize);
    }

    if (shouldSell && this.inventory > 0) {
      return this.makeSellSignal(askPrice, orderSize);
    }

    return this.hold(this.currentPrice, `Quoting bid=${bidPrice.toFixed(4)} ask=${askPrice.toFixed(4)}, inv=${this.inventory.toFixed(2)}`);
  }

  private makeBuySignal(price: number, amount: number): Signal {
    return {
      action: "BUY",
      amount,
      price: this.currentPrice,
      label: "MM_BID",
      confidence: 0.6,
      reason: `Market making: filling bid near ${price.toFixed(4)}, inventory=${this.inventory.toFixed(2)}`,
    };
  }

  private makeSellSignal(price: number, amount: number): Signal {
    return {
      action: "SELL",
      amount,
      price: this.currentPrice,
      label: "MM_ASK",
      confidence: 0.6,
      reason: `Market making: filling ask near ${price.toFixed(4)}, inventory=${this.inventory.toFixed(2)}`,
      metadata: { buyPrice: this.currentPrice * 0.999 }, // approximate
    };
  }

  onOrderFill(signal: Signal, trade: Trade): void {
    if (signal.action === "BUY") {
      this.inventory += trade.amount;
    } else {
      this.inventory -= trade.amount;
    }
    this.lastSide = signal.action as "BUY" | "SELL";
  }

  getState(): StrategyState {
    return { inventory: this.inventory, paused: this.paused };
  }
}

strategyRegistry.register("MARKET_MAKING", (config) => {
  const s = new MarketMakingStrategy();
  s.init(config);
  return s;
}, new MarketMakingStrategy().metadata);
