/**
 * Strategy barrel — importing this file triggers self-registration of all strategies.
 */

// Core
export type {
  IStrategy,
  Signal,
  SignalAction,
  MarketTick,
  CandleData,
  StrategyMetadata,
  StrategyState,
  DataFeed,
} from "./types.js";
export { BaseStrategy } from "./types.js";
export { strategyRegistry } from "./registry.js";

// Strategy modules (import for side-effect: self-registration)
import "./grid-strategy.js";
import "./trend-following.js";
import "./mean-reversion.js";
import "./market-making.js";
import "./arbitrage.js";
import "./dca.js";
import "./scalping.js";
import "./regime.js";
import "./ai-signal.js";
