/**
 * AI/ML Signal Provider interface.
 *
 * This is NOT a fake "AI bot". It provides a clean interface for plugging in
 * external ML models, sentiment scores, or classifier predictions.
 *
 * Signal sources:
 *   - HTTP endpoint polling (GET returns signal JSON)
 *   - Static config for testing
 *
 * The strategy simply wraps external signals into the IStrategy interface.
 * You supply the ML model / prediction pipeline separately.
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
// External signal format — what your ML model should return
// ---------------------------------------------------------------------------

export const externalSignalSchema = z.object({
  /** "BUY" | "SELL" | "HOLD" */
  action: z.enum(["BUY", "SELL", "HOLD"]),
  /** Confidence / probability 0-1 */
  confidence: z.number().min(0).max(1),
  /** Optional reason or model name */
  reason: z.string().optional(),
  /** Suggested position size in base currency */
  amount: z.number().positive().optional(),
  /** Suggested stop loss price */
  stopLoss: z.number().positive().optional(),
  /** Suggested take profit price */
  takeProfit: z.number().positive().optional(),
  /** Sentiment score -1 to 1 */
  sentiment: z.number().min(-1).max(1).optional(),
  /** Probability of upward move 0-1 */
  upProbability: z.number().min(0).max(1).optional(),
});

export type ExternalSignal = z.infer<typeof externalSignalSchema>;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const aiSignalConfigSchema = z.object({
  totalInvestment: z.number().positive(),
  positionSizePercent: z.number().min(0.01).max(1).default(0.1),
  /** Signal source type */
  signalSource: z.enum(["HTTP", "STATIC"]).default("STATIC"),
  /** HTTP endpoint URL that returns ExternalSignal JSON (GET) */
  httpEndpoint: z.string().url().optional(),
  /** HTTP auth header value (e.g. "Bearer xxx") */
  httpAuthHeader: z.string().optional(),
  /** Poll interval in ticks (only fetches new signal every N ticks) */
  pollIntervalTicks: z.number().int().min(1).default(5),
  /** Minimum confidence to act on signal */
  minConfidence: z.number().min(0).max(1).default(0.6),
  /** Static signal for testing — ignored when source is HTTP */
  staticSignal: externalSignalSchema.optional(),
  /** Map model output to action: if upProbability > threshold → BUY */
  upProbabilityBuyThreshold: z.number().min(0).max(1).default(0.65),
  /** Map model output: if upProbability < threshold → SELL */
  upProbabilitySellThreshold: z.number().min(0).max(1).default(0.35),
  /** Sentiment threshold for buy/sell mapping */
  sentimentBuyThreshold: z.number().min(-1).max(1).default(0.3),
  sentimentSellThreshold: z.number().min(-1).max(1).default(-0.3),
  stopLossPercent: z.number().positive().default(2),
  takeProfitPercent: z.number().positive().default(3),
  cooldownTicks: z.number().int().min(0).default(5),
});

type AIConfig = z.infer<typeof aiSignalConfigSchema>;

export class AISignalStrategy extends BaseStrategy {
  readonly metadata: StrategyMetadata = {
    name: "AI/ML Signal",
    slug: "AI_SIGNAL",
    description: "Pluggable interface for external AI/ML signals: sentiment, classifiers, probability models.",
    requiredDataFeeds: ["TICKER"],
    supportsLong: true,
    supportsShort: true,
    supportsSpot: true,
    supportsFutures: true,
    configSchema: aiSignalConfigSchema,
    defaultConfig: { signalSource: "STATIC", minConfidence: 0.6 },
  };

  private config!: AIConfig;
  private currentPrice = 0;
  private lastSignal: ExternalSignal | null = null;
  private ticksSinceLastPoll = 0;
  private cooldown = 0;
  private inPosition = false;
  private entryPrice = 0;

  init(config: unknown): void {
    this.config = aiSignalConfigSchema.parse(config);
  }

  onMarketData(tick: MarketTick): void {
    this.currentPrice = tick.price;
    this.ticksSinceLastPoll++;

    // Poll for new signal at configured interval
    if (this.ticksSinceLastPoll >= this.config.pollIntervalTicks) {
      this.ticksSinceLastPoll = 0;
      this.fetchSignal();
    }
  }

  private fetchSignal(): void {
    if (this.config.signalSource === "STATIC") {
      this.lastSignal = this.config.staticSignal ?? null;
      return;
    }

    if (this.config.signalSource === "HTTP" && this.config.httpEndpoint) {
      // Non-blocking fetch — result available on next tick
      const endpoint = this.config.httpEndpoint;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.config.httpAuthHeader) {
        headers["Authorization"] = this.config.httpAuthHeader;
      }

      fetch(endpoint, { headers, signal: AbortSignal.timeout(5000) })
        .then((res) => res.json())
        .then((data) => {
          const parsed = externalSignalSchema.safeParse(data);
          if (parsed.success) {
            this.lastSignal = parsed.data;
          }
        })
        .catch(() => {
          // Signal fetch failed, keep last known signal
        });
    }
  }

  generateSignal(): Signal {
    if (this.currentPrice === 0) {
      return this.hold(0, "Waiting for price data");
    }

    if (this.cooldown > 0) {
      this.cooldown--;
      return this.hold(this.currentPrice, `AI cooldown (${this.cooldown})`);
    }

    const positionSize = (this.config.totalInvestment * this.config.positionSizePercent) / this.currentPrice;

    // Exit logic
    if (this.inPosition) {
      const stopPrice = this.entryPrice * (1 - this.config.stopLossPercent / 100);
      const tpPrice = this.entryPrice * (1 + this.config.takeProfitPercent / 100);

      if (this.currentPrice <= stopPrice) {
        return {
          action: "SELL",
          amount: positionSize,
          price: this.currentPrice,
          label: "AI_STOP",
          confidence: 0.9,
          reason: `AI signal stop loss (${this.currentPrice.toFixed(4)} <= ${stopPrice.toFixed(4)})`,
          metadata: { buyPrice: this.entryPrice },
        };
      }

      if (this.currentPrice >= tpPrice) {
        return {
          action: "SELL",
          amount: positionSize,
          price: this.currentPrice,
          label: "AI_TP",
          confidence: 0.8,
          reason: `AI signal take profit (${this.currentPrice.toFixed(4)} >= ${tpPrice.toFixed(4)})`,
          metadata: { buyPrice: this.entryPrice },
        };
      }

      // Check if ML says sell
      if (this.lastSignal?.action === "SELL" && (this.lastSignal.confidence ?? 0) >= this.config.minConfidence) {
        return {
          action: "SELL",
          amount: positionSize,
          price: this.currentPrice,
          label: "AI_ML_EXIT",
          confidence: this.lastSignal.confidence,
          reason: `ML signal: SELL (confidence=${this.lastSignal.confidence.toFixed(2)}, ${this.lastSignal.reason ?? "no reason"})`,
          metadata: { buyPrice: this.entryPrice },
        };
      }
    }

    // Entry logic
    if (!this.inPosition && this.lastSignal) {
      let action = this.lastSignal.action;
      let confidence = this.lastSignal.confidence;
      const reason = this.lastSignal.reason ?? "external signal";

      // Map probability-based signals to action
      if (this.lastSignal.upProbability !== undefined) {
        if (this.lastSignal.upProbability >= this.config.upProbabilityBuyThreshold) {
          action = "BUY";
          confidence = this.lastSignal.upProbability;
        } else if (this.lastSignal.upProbability <= this.config.upProbabilitySellThreshold) {
          action = "SELL";
          confidence = 1 - this.lastSignal.upProbability;
        }
      }

      // Map sentiment-based signals
      if (this.lastSignal.sentiment !== undefined) {
        if (this.lastSignal.sentiment >= this.config.sentimentBuyThreshold) {
          action = "BUY";
          confidence = Math.max(confidence, this.lastSignal.sentiment);
        } else if (this.lastSignal.sentiment <= this.config.sentimentSellThreshold) {
          action = "SELL";
          confidence = Math.max(confidence, Math.abs(this.lastSignal.sentiment));
        }
      }

      if (action === "BUY" && confidence >= this.config.minConfidence) {
        return {
          action: "BUY",
          amount: this.lastSignal.amount ?? positionSize,
          price: this.currentPrice,
          label: "AI_ML_ENTRY",
          confidence,
          reason: `ML signal: BUY (confidence=${confidence.toFixed(2)}, ${reason})`,
          stopLoss: this.lastSignal.stopLoss ?? this.currentPrice * (1 - this.config.stopLossPercent / 100),
          takeProfit: this.lastSignal.takeProfit ?? this.currentPrice * (1 + this.config.takeProfitPercent / 100),
        };
      }
    }

    return this.hold(this.currentPrice, `AI: ${this.lastSignal ? `last signal=${this.lastSignal.action}, conf=${this.lastSignal.confidence.toFixed(2)}` : "no signal"}`);
  }

  onOrderFill(signal: Signal, trade: Trade): void {
    if (signal.action === "BUY") {
      this.inPosition = true;
      this.entryPrice = trade.price;
    } else {
      this.inPosition = false;
      this.entryPrice = 0;
      this.cooldown = this.config.cooldownTicks;
    }
  }

  getState(): StrategyState {
    return {
      inPosition: this.inPosition,
      entryPrice: this.entryPrice,
      lastSignal: this.lastSignal,
    };
  }
}

strategyRegistry.register("AI_SIGNAL", (config) => {
  const s = new AISignalStrategy();
  s.init(config);
  return s;
}, new AISignalStrategy().metadata);
