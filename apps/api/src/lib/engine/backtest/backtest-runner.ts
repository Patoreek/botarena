/**
 * Backtesting harness.
 *
 * Replays historical candle data through a strategy and paper trader,
 * then computes performance metrics. No database or network dependencies
 * during the simulation loop itself.
 */

import { fetchKlines, toSymbol } from "../../binance.js";
import { PaperTrader, type Trade } from "../paper-trader.js";
import { strategyRegistry } from "../strategies/registry.js";
import type { IStrategy, MarketTick, CandleData } from "../strategies/types.js";
import { RiskEngine, type RiskConfig } from "../risk/risk-engine.js";
import { computeMetrics, type BacktestMetrics } from "./metrics.js";
import type { RunInterval } from "@repo/shared";

// Import strategies to ensure registration
import "../strategies/index.js";

export interface BacktestConfig {
  strategySlug: string;
  strategyConfig: unknown;
  marketPair: string;
  interval: RunInterval;
  /** Number of historical candles to fetch (max ~1000 from Binance) */
  candleCount: number;
  initialBalance: number;
  feeRate?: number;         // override default 0.1%
  slippageBps?: number;     // basis points of slippage per trade
  riskConfig?: Partial<RiskConfig>;
}

export interface BacktestResult {
  trades: Trade[];
  metrics: BacktestMetrics;
  finalBalance: number;
  candlesProcessed: number;
}

export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  // Fetch historical data
  const symbol = toSymbol(config.marketPair);
  const klines = await fetchKlines(symbol, config.interval, config.candleCount);

  if (klines.length === 0) {
    throw new Error(`No historical data for ${config.marketPair}`);
  }

  // Create strategy and paper trader
  const strategy = strategyRegistry.create(config.strategySlug, config.strategyConfig);
  const paperTrader = new PaperTrader(config.initialBalance);
  const riskEngine = config.riskConfig ? new RiskEngine(config.riskConfig) : undefined;
  const slippageFactor = (config.slippageBps ?? 0) / 10000;

  const allTrades: Trade[] = [];

  for (const k of klines) {
    const close = parseFloat(k.close);
    const high = parseFloat(k.high);
    const low = parseFloat(k.low);
    const open = parseFloat(k.open);
    const volume = parseFloat(k.volume);

    // Feed candle to strategy
    const candle: CandleData = { open, high, low, close, volume, timestamp: k.openTime };
    strategy.onCandle(candle);

    // Feed tick (using close price)
    const tick: MarketTick = {
      price: close,
      volume,
      high24h: high,
      low24h: low,
      timestamp: new Date(k.closeTime),
    };
    strategy.onMarketData(tick);

    // Generate signal
    const signal = strategy.generateSignal();

    // Risk check
    if (riskEngine && signal.action !== "HOLD") {
      const check = riskEngine.check(signal, paperTrader.portfolio, paperTrader.recentTrades);
      if (!check.allowed) continue;
    }

    // Execute with slippage
    if (signal.action === "BUY" && strategy.shouldEnter(signal)) {
      const fillPrice = close * (1 + slippageFactor);
      const trade = paperTrader.buy(fillPrice, signal.amount, signal.label);
      if (trade) {
        strategy.onOrderFill(signal, trade);
        allTrades.push(trade);
      }
    } else if (signal.action === "SELL" && strategy.shouldExit(signal)) {
      const fillPrice = close * (1 - slippageFactor);
      const buyPrice = (signal.metadata?.buyPrice as number) ?? null;
      const trade = paperTrader.sell(fillPrice, signal.amount, signal.label, buyPrice);
      if (trade) {
        strategy.onOrderFill(signal, trade);
        allTrades.push(trade);
        if (riskEngine) riskEngine.onTradeExecuted(trade);
      }
    }

    strategy.onPositionUpdate(paperTrader.portfolio);
  }

  strategy.shutdown();

  const lastPrice = parseFloat(klines[klines.length - 1].close);
  const metrics = computeMetrics(allTrades, config.initialBalance, klines.length);

  return {
    trades: allTrades,
    metrics,
    finalBalance: paperTrader.totalValue(lastPrice),
    candlesProcessed: klines.length,
  };
}

/**
 * Compare multiple strategy configs against the same market data.
 */
export async function compareStrategies(
  configs: BacktestConfig[],
): Promise<{ name: string; result: BacktestResult }[]> {
  const results: { name: string; result: BacktestResult }[] = [];
  for (const config of configs) {
    const result = await runBacktest(config);
    results.push({ name: config.strategySlug, result });
  }
  // Sort by net PnL descending
  results.sort((a, b) => b.result.metrics.netPnl - a.result.metrics.netPnl);
  return results;
}
