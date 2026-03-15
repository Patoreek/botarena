/**
 * MACD (Moving Average Convergence Divergence) indicator.
 */
import { EMA } from "./ema.js";

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
}

export class MACD {
  private fastEMA: EMA;
  private slowEMA: EMA;
  private signalEMA: EMA;
  private result: MACDResult | null = null;

  constructor(fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    this.fastEMA = new EMA(fastPeriod);
    this.slowEMA = new EMA(slowPeriod);
    this.signalEMA = new EMA(signalPeriod);
  }

  update(price: number): MACDResult | null {
    const fast = this.fastEMA.update(price);
    const slow = this.slowEMA.update(price);

    if (fast === null || slow === null) return null;

    const macdLine = fast - slow;
    const signalLine = this.signalEMA.update(macdLine);

    if (signalLine === null) return null;

    this.result = {
      macd: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine,
    };
    return this.result;
  }

  get current(): MACDResult | null {
    return this.result;
  }

  get ready(): boolean {
    return this.result !== null;
  }

  reset(): void {
    this.fastEMA.reset();
    this.slowEMA.reset();
    this.signalEMA.reset();
    this.result = null;
  }
}
