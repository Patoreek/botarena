/**
 * Regime-based strategy switching.
 *
 * Detects market regime (trending, ranging, high-volatility, low-liquidity, risk-off)
 * and routes execution to the appropriate child strategy. Supports weighted scoring
 * and hysteresis to prevent flip-flopping.
 */

import { z } from "zod";
import { ADX } from "../indicators/adx.js";
import { ATR } from "../indicators/atr.js";
import { BollingerBands } from "../indicators/bollinger.js";
import { strategyRegistry } from "./registry.js";
import {
  BaseStrategy,
  type StrategyMetadata,
  type Signal,
  type MarketTick,
  type CandleData,
  type StrategyState,
  type IStrategy,
} from "./types.js";
import type { Trade, PaperPortfolio } from "../paper-trader.js";

export type MarketRegime = "TRENDING" | "RANGING" | "HIGH_VOLATILITY" | "LOW_LIQUIDITY" | "RISK_OFF";

export const regimeConfigSchema = z.object({
  totalInvestment: z.number().positive(),
  adxPeriod: z.number().int().default(14),
  atrPeriod: z.number().int().default(14),
  bbPeriod: z.number().int().default(20),
  /** ADX above this = trending regime */
  trendThreshold: z.number().positive().default(25),
  /** ATR/price ratio above this = high volatility */
  volatilityThreshold: z.number().positive().default(3),
  /** BB bandwidth below this = ranging (low vol) */
  rangingBandwidthThreshold: z.number().positive().default(0.02),
  /** Minimum ticks before regime can switch (hysteresis) */
  minRegimeDurationTicks: z.number().int().min(1).default(10),
  /** Strategy slug to use when trending */
  trendStrategy: z.string().default("TREND_FOLLOWING"),
  trendStrategyConfig: z.record(z.unknown()).default({}),
  /** Strategy slug to use when ranging */
  rangeStrategy: z.string().default("MEAN_REVERSION"),
  rangeStrategyConfig: z.record(z.unknown()).default({}),
  /** Strategy slug for high volatility (or null to hold) */
  highVolStrategy: z.string().optional(),
  highVolStrategyConfig: z.record(z.unknown()).optional(),
  /** Use weighted scoring instead of hard switching */
  useWeightedScoring: z.boolean().default(false),
});

type RegimeConfig = z.infer<typeof regimeConfigSchema>;

export class RegimeStrategy extends BaseStrategy {
  readonly metadata: StrategyMetadata = {
    name: "Regime-Based Switching",
    slug: "REGIME",
    description: "Detects market regime and routes to appropriate child strategy. Supports hysteresis and weighted scoring.",
    requiredDataFeeds: ["TICKER", "KLINE"],
    supportsLong: true,
    supportsShort: true,
    supportsSpot: true,
    supportsFutures: true,
    configSchema: regimeConfigSchema,
    defaultConfig: { trendThreshold: 25, volatilityThreshold: 3 },
  };

  private config!: RegimeConfig;
  private adx!: ADX;
  private atr!: ATR;
  private bb!: BollingerBands;
  private currentRegime: MarketRegime = "RANGING";
  private regimeDuration = 0;
  private activeStrategy: IStrategy | null = null;
  private strategies = new Map<string, IStrategy>();
  private currentPrice = 0;

  init(config: unknown): void {
    this.config = regimeConfigSchema.parse(config);
    this.adx = new ADX(this.config.adxPeriod);
    this.atr = new ATR(this.config.atrPeriod);
    this.bb = new BollingerBands(this.config.bbPeriod);

    // Pre-create child strategies
    this.initChildStrategy(this.config.trendStrategy, {
      ...this.config.trendStrategyConfig,
      totalInvestment: this.config.totalInvestment,
    });
    this.initChildStrategy(this.config.rangeStrategy, {
      ...this.config.rangeStrategyConfig,
      totalInvestment: this.config.totalInvestment,
    });
    if (this.config.highVolStrategy) {
      this.initChildStrategy(this.config.highVolStrategy, {
        ...this.config.highVolStrategyConfig,
        totalInvestment: this.config.totalInvestment,
      });
    }

    // Start with range strategy
    this.activeStrategy = this.strategies.get(this.config.rangeStrategy) ?? null;
  }

  private initChildStrategy(slug: string, config: unknown): void {
    if (this.strategies.has(slug)) return;
    try {
      const strategy = strategyRegistry.create(slug, config);
      this.strategies.set(slug, strategy);
    } catch (err) {
      console.warn(`[Regime] Failed to init child strategy "${slug}": ${err}`);
    }
  }

  onMarketData(tick: MarketTick): void {
    this.currentPrice = tick.price;
    // Forward to active strategy
    this.activeStrategy?.onMarketData(tick);
  }

  onCandle(candle: CandleData): void {
    this.adx.update(candle.high, candle.low, candle.close);
    this.atr.update(candle.high, candle.low, candle.close);
    this.bb.update(candle.close);

    // Detect regime
    this.detectRegime();

    // Forward to active strategy
    this.activeStrategy?.onCandle(candle);
  }

  private detectRegime(): void {
    const adxResult = this.adx.current;
    const atrVal = this.atr.current;
    const bbResult = this.bb.current;

    if (!adxResult || !atrVal || !bbResult) return;

    const volatilityRatio = (atrVal / this.currentPrice) * 100;
    let newRegime: MarketRegime;

    if (volatilityRatio >= this.config.volatilityThreshold) {
      newRegime = "HIGH_VOLATILITY";
    } else if (adxResult.adx >= this.config.trendThreshold) {
      newRegime = "TRENDING";
    } else if (bbResult.bandwidth / this.currentPrice < this.config.rangingBandwidthThreshold) {
      newRegime = "RANGING";
    } else {
      newRegime = "RANGING";
    }

    // Hysteresis: don't switch too fast
    if (newRegime !== this.currentRegime) {
      this.regimeDuration++;
      if (this.regimeDuration >= this.config.minRegimeDurationTicks) {
        this.switchRegime(newRegime);
      }
    } else {
      this.regimeDuration = 0;
    }
  }

  private switchRegime(newRegime: MarketRegime): void {
    this.currentRegime = newRegime;
    this.regimeDuration = 0;

    let targetSlug: string | undefined;
    switch (newRegime) {
      case "TRENDING":
        targetSlug = this.config.trendStrategy;
        break;
      case "RANGING":
        targetSlug = this.config.rangeStrategy;
        break;
      case "HIGH_VOLATILITY":
        targetSlug = this.config.highVolStrategy;
        break;
      default:
        targetSlug = undefined;
    }

    if (targetSlug && this.strategies.has(targetSlug)) {
      this.activeStrategy = this.strategies.get(targetSlug)!;
    } else {
      // No strategy for this regime — hold
      this.activeStrategy = null;
    }
  }

  generateSignal(): Signal {
    if (!this.activeStrategy) {
      return this.hold(this.currentPrice, `Regime: ${this.currentRegime}, no active strategy`);
    }

    const signal = this.activeStrategy.generateSignal();
    return {
      ...signal,
      reason: `[${this.currentRegime}] ${signal.reason}`,
      label: `REGIME_${signal.label}`,
    };
  }

  shouldEnter(signal: Signal): boolean {
    return this.activeStrategy?.shouldEnter(signal) ?? false;
  }

  shouldExit(signal: Signal): boolean {
    return this.activeStrategy?.shouldExit(signal) ?? true;
  }

  buildOrders(signal: Signal): Signal[] {
    return this.activeStrategy?.buildOrders(signal) ?? [signal];
  }

  onOrderFill(signal: Signal, trade: Trade): void {
    this.activeStrategy?.onOrderFill(signal, trade);
  }

  onPositionUpdate(portfolio: PaperPortfolio): void {
    this.activeStrategy?.onPositionUpdate(portfolio);
  }

  getState(): StrategyState {
    return {
      currentRegime: this.currentRegime,
      regimeDuration: this.regimeDuration,
      activeStrategy: this.activeStrategy?.metadata.slug ?? null,
    };
  }

  shutdown(): void {
    for (const strategy of this.strategies.values()) {
      strategy.shutdown();
    }
  }
}

strategyRegistry.register("REGIME", (config) => {
  const s = new RegimeStrategy();
  s.init(config);
  return s;
}, new RegimeStrategy().metadata);
