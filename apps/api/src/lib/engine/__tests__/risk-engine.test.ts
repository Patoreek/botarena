/**
 * Risk engine unit tests.
 * Run with: npx vitest run src/lib/engine/__tests__/risk-engine.test.ts
 */

import { describe, it, expect } from "vitest";
import { RiskEngine } from "../risk/risk-engine.js";
import type { Signal } from "../strategies/types.js";
import type { PaperPortfolio } from "../paper-trader.js";

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    action: "BUY",
    amount: 1,
    price: 100,
    label: "TEST",
    confidence: 0.8,
    reason: "test",
    ...overrides,
  };
}

function makePortfolio(overrides: Partial<PaperPortfolio> = {}): PaperPortfolio {
  return {
    quoteBalance: 10000,
    baseBalance: 0,
    initialInvestment: 10000,
    totalProfit: 0,
    totalLoss: 0,
    netPnl: 0,
    totalBuys: 0,
    totalSells: 0,
    totalTrades: 0,
    winCount: 0,
    lossCount: 0,
    roi: 0,
    ...overrides,
  };
}

describe("RiskEngine", () => {
  it("allows trades by default (no restrictions)", () => {
    const engine = new RiskEngine();
    const result = engine.check(makeSignal(), makePortfolio(), []);
    expect(result.allowed).toBe(true);
  });

  it("blocks when position size exceeds max", () => {
    const engine = new RiskEngine({ maxPositionSize: 50 });
    const result = engine.check(makeSignal({ price: 100, amount: 1 }), makePortfolio(), []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Position size");
  });

  it("blocks when max daily trades reached", () => {
    const engine = new RiskEngine({ maxTradesPerDay: 1 });
    engine.onTradeExecuted({ side: "BUY", price: 100, amount: 1, cost: 100, fee: 0.1, pnl: 0, timestamp: new Date(), gridLevel: "T" });
    const result = engine.check(makeSignal(), makePortfolio(), []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Daily trade limit");
  });

  it("blocks when confidence too low", () => {
    const engine = new RiskEngine({ minConfidence: 0.9 });
    const result = engine.check(makeSignal({ confidence: 0.5 }), makePortfolio(), []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("confidence too low");
  });

  it("blocks when max open positions reached", () => {
    const engine = new RiskEngine({ maxOpenPositions: 2 });
    const portfolio = makePortfolio({ totalBuys: 3, totalSells: 1 });
    const result = engine.check(makeSignal(), portfolio, []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Max open positions");
  });

  it("allows SELL signals without position limits", () => {
    const engine = new RiskEngine({ maxOpenPositions: 0 });
    const result = engine.check(makeSignal({ action: "SELL" }), makePortfolio(), []);
    expect(result.allowed).toBe(true);
  });
});
