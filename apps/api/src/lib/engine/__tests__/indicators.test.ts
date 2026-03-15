/**
 * Indicator unit tests.
 * Run with: npx vitest run src/lib/engine/__tests__/indicators.test.ts
 */

import { describe, it, expect } from "vitest";
import { SMA } from "../indicators/sma.js";
import { EMA } from "../indicators/ema.js";
import { RSI } from "../indicators/rsi.js";
import { BollingerBands } from "../indicators/bollinger.js";
import { MACD } from "../indicators/macd.js";
import { ATR } from "../indicators/atr.js";
import { ZScore } from "../indicators/zscore.js";

describe("SMA", () => {
  it("computes correct simple moving average", () => {
    const sma = new SMA(3);
    expect(sma.update(10)).toBeNull();
    expect(sma.update(20)).toBeNull();
    expect(sma.update(30)).toBeCloseTo(20);
    expect(sma.update(40)).toBeCloseTo(30);
  });

  it("reports ready state correctly", () => {
    const sma = new SMA(2);
    expect(sma.ready).toBe(false);
    sma.update(5);
    expect(sma.ready).toBe(false);
    sma.update(10);
    expect(sma.ready).toBe(true);
  });
});

describe("EMA", () => {
  it("first value equals SMA of initial period", () => {
    const ema = new EMA(3);
    ema.update(10);
    ema.update(20);
    const firstEma = ema.update(30);
    expect(firstEma).toBeCloseTo(20); // SMA(10,20,30) = 20
  });

  it("subsequent values use exponential weighting", () => {
    const ema = new EMA(3);
    ema.update(10);
    ema.update(20);
    ema.update(30); // = 20
    const v = ema.update(40);
    // EMA = (40 - 20) * 0.5 + 20 = 30
    expect(v).toBeCloseTo(30);
  });
});

describe("RSI", () => {
  it("returns null during warmup", () => {
    const rsi = new RSI(3);
    expect(rsi.update(10)).toBeNull();
    expect(rsi.update(11)).toBeNull();
  });

  it("returns 100 when all moves are up", () => {
    const rsi = new RSI(3);
    rsi.update(10);
    rsi.update(11);
    rsi.update(12);
    const val = rsi.update(13);
    expect(val).toBe(100);
  });
});

describe("BollingerBands", () => {
  it("middle band equals SMA", () => {
    const bb = new BollingerBands(3, 2);
    bb.update(10);
    bb.update(20);
    const result = bb.update(30);
    expect(result).not.toBeNull();
    expect(result!.middle).toBeCloseTo(20);
  });

  it("bands widen with higher volatility", () => {
    const bb1 = new BollingerBands(3, 2);
    [10, 10, 10].forEach((v) => bb1.update(v));
    const narrow = bb1.current!;

    const bb2 = new BollingerBands(3, 2);
    [5, 15, 25].forEach((v) => bb2.update(v));
    const wide = bb2.current!;

    expect(wide.bandwidth).toBeGreaterThan(narrow.bandwidth);
  });
});

describe("MACD", () => {
  it("returns null during warmup", () => {
    const macd = new MACD(3, 5, 2);
    for (let i = 0; i < 4; i++) {
      expect(macd.update(10 + i)).toBeNull();
    }
  });

  it("produces a result after sufficient data", () => {
    const macd = new MACD(3, 5, 2);
    let result = null;
    for (let i = 0; i < 20; i++) {
      result = macd.update(100 + i);
    }
    expect(result).not.toBeNull();
    expect(result!.macd).toBeGreaterThan(0); // uptrend
  });
});

describe("ATR", () => {
  it("first value is null", () => {
    const atr = new ATR(3);
    expect(atr.update(11, 9, 10)).toBeNull();
  });

  it("computes average true range", () => {
    const atr = new ATR(3);
    atr.update(11, 9, 10);
    atr.update(12, 10, 11);
    atr.update(13, 11, 12);
    const val = atr.update(14, 12, 13);
    expect(val).not.toBeNull();
    expect(val!).toBeGreaterThan(0);
  });
});

describe("ZScore", () => {
  it("returns 0 for constant values", () => {
    const z = new ZScore(3);
    z.update(10);
    z.update(10);
    const val = z.update(10);
    expect(val).toBe(0);
  });

  it("returns positive z-score for value above mean", () => {
    const z = new ZScore(3);
    z.update(10);
    z.update(10);
    const val = z.update(20);
    expect(val).not.toBeNull();
    expect(val!).toBeGreaterThan(0);
  });
});
