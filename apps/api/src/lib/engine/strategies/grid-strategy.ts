/**
 * GridStrategy — adapter that wraps the existing grid.ts pure functions
 * behind the IStrategy interface. grid.ts is NOT modified.
 */

import { z } from "zod";
import {
  generateGridLevels,
  evaluateGrid,
  type GridConfig,
  type GridLevel,
} from "../grid.js";
import {
  BaseStrategy,
  type StrategyMetadata,
  type Signal,
  type MarketTick,
  type StrategyState,
} from "./types.js";
import type { Trade } from "../paper-trader.js";
import { strategyRegistry } from "./registry.js";

// Re-use the existing config shape — keeps 1:1 compat with the DB model
export const gridStrategyConfigSchema = z.object({
  upperPrice: z.number().positive(),
  lowerPrice: z.number().positive(),
  gridCount: z.number().int().min(2).max(500),
  gridType: z.enum(["ARITHMETIC", "GEOMETRIC"]).default("ARITHMETIC"),
  gridMode: z.enum(["LONG", "SHORT", "NEUTRAL"]).default("NEUTRAL"),
  amountPerGrid: z.number().positive(),
  totalInvestment: z.number().positive(),
  minProfitPerGrid: z.number().positive().optional(),
  maxOpenOrders: z.number().int().min(1).optional(),
});

type GridStrategyConfig = z.infer<typeof gridStrategyConfigSchema>;

export class GridStrategy extends BaseStrategy {
  readonly metadata: StrategyMetadata = {
    name: "Grid Trading",
    slug: "GRID",
    description: "Places buy and sell orders at predefined price levels within a range.",
    requiredDataFeeds: ["TICKER"],
    supportsLong: true,
    supportsShort: true,
    supportsSpot: true,
    supportsFutures: false,
    configSchema: gridStrategyConfigSchema,
    defaultConfig: {
      gridType: "ARITHMETIC",
      gridMode: "NEUTRAL",
      gridCount: 10,
    },
  };

  private config!: GridConfig;
  private gridLevels: GridLevel[] = [];
  private currentPrice = 0;
  private previousPrice: number | null = null;

  init(config: unknown, state?: StrategyState): void {
    const parsed = gridStrategyConfigSchema.parse(config);
    this.config = parsed;
    this.gridLevels = generateGridLevels(parsed);

    // Restore state if provided
    if (state?.gridLevels) {
      const restored = state.gridLevels as GridLevel[];
      for (const level of restored) {
        const match = this.gridLevels.find((l) => l.index === level.index);
        if (match) {
          match.hasPosition = level.hasPosition;
          match.buyPrice = level.buyPrice;
        }
      }
    }
    if (state?.previousPrice != null) {
      this.previousPrice = state.previousPrice as number;
    }
  }

  onMarketData(tick: MarketTick): void {
    this.previousPrice = this.currentPrice || null;
    this.currentPrice = tick.price;
  }

  generateSignal(): Signal {
    if (this.currentPrice === 0) {
      return this.hold(0, "Waiting for first market data");
    }

    const decision = evaluateGrid(
      this.currentPrice,
      this.gridLevels,
      this.config,
      this.previousPrice,
    );

    return {
      action: decision.decision,
      amount: decision.amount,
      price: decision.price,
      label: decision.gridLevel,
      confidence: decision.confidence,
      reason: decision.reason,
    };
  }

  onOrderFill(signal: Signal, _trade: Trade): void {
    const levelIdx = parseInt(signal.label.replace("L", ""), 10);
    if (isNaN(levelIdx) || !this.gridLevels[levelIdx]) return;

    if (signal.action === "BUY") {
      this.gridLevels[levelIdx].hasPosition = true;
      this.gridLevels[levelIdx].buyPrice = signal.price;
    } else if (signal.action === "SELL") {
      this.gridLevels[levelIdx].hasPosition = false;
      this.gridLevels[levelIdx].buyPrice = null;
    }
  }

  getState(): StrategyState {
    return {
      gridLevels: this.gridLevels,
      previousPrice: this.previousPrice,
    };
  }

  /** Expose grid levels for the runner's sell-side buyPrice lookup. */
  getGridLevels(): GridLevel[] {
    return this.gridLevels;
  }
}

// Self-register
strategyRegistry.register("GRID", (config) => {
  const s = new GridStrategy();
  s.init(config);
  return s;
}, new GridStrategy().metadata);
