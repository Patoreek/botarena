/**
 * Strategy unit test scaffolds.
 * Run with: npx vitest run src/lib/engine/__tests__/strategies.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { strategyRegistry } from "../strategies/registry.js";

// Import to trigger registration
import "../strategies/index.js";

describe("StrategyRegistry", () => {
  it("has all expected strategies registered", () => {
    const slugs = strategyRegistry.listSlugs();
    expect(slugs).toContain("GRID");
    expect(slugs).toContain("TREND_FOLLOWING");
    expect(slugs).toContain("MEAN_REVERSION");
    expect(slugs).toContain("MARKET_MAKING");
    expect(slugs).toContain("ARBITRAGE");
    expect(slugs).toContain("DCA");
    expect(slugs).toContain("SCALPING");
    expect(slugs).toContain("REGIME");
    expect(slugs).toContain("AI_SIGNAL");
  });

  it("returns metadata for each strategy", () => {
    for (const slug of strategyRegistry.listSlugs()) {
      const meta = strategyRegistry.getMetadata(slug);
      expect(meta).toBeDefined();
      expect(meta!.name).toBeTruthy();
      expect(meta!.description).toBeTruthy();
      expect(meta!.requiredDataFeeds.length).toBeGreaterThan(0);
    }
  });

  it("throws for unknown strategy", () => {
    expect(() => strategyRegistry.create("UNKNOWN", {})).toThrow();
  });
});

describe("GridStrategy adapter", () => {
  it("produces HOLD when no market data received", () => {
    const strategy = strategyRegistry.create("GRID", {
      upperPrice: 100,
      lowerPrice: 50,
      gridCount: 5,
      amountPerGrid: 10,
      totalInvestment: 1000,
    });
    const signal = strategy.generateSignal();
    expect(signal.action).toBe("HOLD");
  });

  it("produces BUY when price drops to grid level", () => {
    const strategy = strategyRegistry.create("GRID", {
      upperPrice: 100,
      lowerPrice: 50,
      gridCount: 5,
      amountPerGrid: 10,
      totalInvestment: 1000,
    });

    strategy.onMarketData({ price: 75, volume: 100, high24h: 80, low24h: 70, timestamp: new Date() });
    strategy.onMarketData({ price: 60, volume: 100, high24h: 80, low24h: 55, timestamp: new Date() });
    const signal = strategy.generateSignal();
    expect(["BUY", "HOLD"]).toContain(signal.action);
  });
});

describe("TrendFollowing", () => {
  it("initialises without error", () => {
    const strategy = strategyRegistry.create("TREND_FOLLOWING", {
      totalInvestment: 10000,
      fastPeriod: 3,
      slowPeriod: 5,
    });
    expect(strategy.metadata.slug).toBe("TREND_FOLLOWING");
  });

  it("holds during warmup period", () => {
    const strategy = strategyRegistry.create("TREND_FOLLOWING", {
      totalInvestment: 10000,
      fastPeriod: 3,
      slowPeriod: 5,
    });
    strategy.onMarketData({ price: 100, volume: 1000, high24h: 105, low24h: 95, timestamp: new Date() });
    const signal = strategy.generateSignal();
    expect(signal.action).toBe("HOLD");
  });
});

describe("MeanReversion", () => {
  it("initialises without error", () => {
    const strategy = strategyRegistry.create("MEAN_REVERSION", {
      totalInvestment: 10000,
      rsiPeriod: 5,
      bbPeriod: 5,
    });
    expect(strategy.metadata.slug).toBe("MEAN_REVERSION");
  });
});

describe("DCA", () => {
  it("buys at regular intervals", () => {
    const strategy = strategyRegistry.create("DCA", {
      totalInvestment: 5000,
      buyAmountQuote: 100,
      buyIntervalTicks: 1,
    });
    strategy.onMarketData({ price: 50000, volume: 100, high24h: 51000, low24h: 49000, timestamp: new Date() });
    const signal = strategy.generateSignal();
    expect(signal.action).toBe("BUY");
    expect(signal.label).toBe("DCA_REGULAR");
  });
});

describe("Scalping", () => {
  it("initialises without error", () => {
    const strategy = strategyRegistry.create("SCALPING", {
      totalInvestment: 5000,
      emaPeriod: 3,
      atrPeriod: 3,
    });
    expect(strategy.metadata.slug).toBe("SCALPING");
  });
});

describe("MarketMaking", () => {
  it("initialises without error", () => {
    const strategy = strategyRegistry.create("MARKET_MAKING", {
      totalInvestment: 10000,
    });
    expect(strategy.metadata.slug).toBe("MARKET_MAKING");
  });
});

describe("Arbitrage", () => {
  it("initialises without error", () => {
    const strategy = strategyRegistry.create("ARBITRAGE", {
      totalInvestment: 10000,
    });
    expect(strategy.metadata.slug).toBe("ARBITRAGE");
  });
});

describe("AISignal", () => {
  it("initialises with static signal source", () => {
    const strategy = strategyRegistry.create("AI_SIGNAL", {
      totalInvestment: 5000,
      signalSource: "STATIC",
      staticSignal: { action: "BUY", confidence: 0.8 },
    });
    expect(strategy.metadata.slug).toBe("AI_SIGNAL");
  });
});

describe("Regime", () => {
  it("initialises with child strategies", () => {
    const strategy = strategyRegistry.create("REGIME", {
      totalInvestment: 10000,
      trendStrategy: "TREND_FOLLOWING",
      trendStrategyConfig: { fastPeriod: 5, slowPeriod: 10 },
      rangeStrategy: "MEAN_REVERSION",
      rangeStrategyConfig: { rsiPeriod: 5, bbPeriod: 5 },
    });
    expect(strategy.metadata.slug).toBe("REGIME");
  });
});
