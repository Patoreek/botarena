/**
 * Core strategy abstractions.
 *
 * Every strategy implements IStrategy. The runner calls lifecycle methods
 * in sequence: init → onMarketData/onCandle → generateSignal → shouldEnter/Exit
 * → buildOrders → onOrderFill → onPositionUpdate → shutdown.
 */

import type { z } from "zod";
import type { Trade, PaperPortfolio } from "../paper-trader.js";

// ---------------------------------------------------------------------------
// Market data types
// ---------------------------------------------------------------------------

export interface MarketTick {
  price: number;
  volume: number;
  high24h: number;
  low24h: number;
  timestamp: Date;
}

export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Signal — the standardised output every strategy produces
// ---------------------------------------------------------------------------

export type SignalAction = "BUY" | "SELL" | "HOLD";

export interface Signal {
  action: SignalAction;
  amount: number;
  price: number;
  label: string;        // generic tag (grid level, indicator name, etc.)
  confidence: number;   // 0-1
  reason: string;
  stopLoss?: number;
  takeProfit?: number;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Strategy metadata — describes capabilities and requirements
// ---------------------------------------------------------------------------

export type DataFeed = "TICKER" | "KLINE" | "ORDERBOOK" | "TRADES";

export interface StrategyMetadata {
  name: string;
  slug: string;          // matches BotStrategy enum value
  description: string;
  requiredDataFeeds: DataFeed[];
  supportsLong: boolean;
  supportsShort: boolean;
  supportsSpot: boolean;
  supportsFutures: boolean;
  configSchema: z.ZodType;
  defaultConfig: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Serializable state — for persistence / restoration across restarts
// ---------------------------------------------------------------------------

export type StrategyState = Record<string, unknown>;

// ---------------------------------------------------------------------------
// The strategy interface
// ---------------------------------------------------------------------------

export interface IStrategy {
  readonly metadata: StrategyMetadata;

  /** Initialise with validated config and optionally restore prior state. */
  init(config: unknown, state?: StrategyState): void;

  /** Called every tick with fresh ticker data. */
  onMarketData(tick: MarketTick): void;

  /** Called when new candle data is available. */
  onCandle(candle: CandleData): void;

  /** Produce the current signal based on accumulated data. */
  generateSignal(): Signal;

  /** Pre-execution gate: should this entry signal be acted on? */
  shouldEnter(signal: Signal): boolean;

  /** Pre-execution gate: should this exit signal be acted on? */
  shouldExit(signal: Signal): boolean;

  /**
   * Optionally split a signal into multiple orders
   * (e.g. partial take-profits, laddered entries).
   * Default: return the signal as-is wrapped in an array.
   */
  buildOrders(signal: Signal): Signal[];

  /** Called after a trade is executed. */
  onOrderFill(signal: Signal, trade: Trade): void;

  /** Called after portfolio state changes. */
  onPositionUpdate(portfolio: PaperPortfolio): void;

  /** Return serialisable state for persistence. */
  getState(): StrategyState;

  /** Clean up resources. */
  shutdown(): void;
}

// ---------------------------------------------------------------------------
// Base class with sensible defaults — strategies can extend this
// ---------------------------------------------------------------------------

export abstract class BaseStrategy implements IStrategy {
  abstract readonly metadata: StrategyMetadata;

  abstract init(config: unknown, state?: StrategyState): void;
  abstract onMarketData(tick: MarketTick): void;
  abstract generateSignal(): Signal;

  onCandle(_candle: CandleData): void { /* no-op by default */ }

  shouldEnter(_signal: Signal): boolean { return true; }
  shouldExit(_signal: Signal): boolean { return true; }

  buildOrders(signal: Signal): Signal[] { return [signal]; }

  onOrderFill(_signal: Signal, _trade: Trade): void { /* no-op */ }
  onPositionUpdate(_portfolio: PaperPortfolio): void { /* no-op */ }

  getState(): StrategyState { return {}; }

  shutdown(): void { /* no-op */ }

  /** Helper: create a HOLD signal. */
  protected hold(price: number, reason: string): Signal {
    return { action: "HOLD", amount: 0, price, label: "-", confidence: 0.5, reason };
  }
}
