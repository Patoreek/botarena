/**
 * Bollinger Bands indicator.
 */
export interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
  percentB: number; // where price falls within the bands (0 = lower, 1 = upper)
}

export class BollingerBands {
  private period: number;
  private stdDevMultiplier: number;
  private values: number[] = [];
  private result: BollingerResult | null = null;

  constructor(period = 20, stdDevMultiplier = 2) {
    this.period = period;
    this.stdDevMultiplier = stdDevMultiplier;
  }

  update(price: number): BollingerResult | null {
    this.values.push(price);
    if (this.values.length > this.period) {
      this.values.shift();
    }
    if (this.values.length < this.period) return null;

    const mean = this.values.reduce((s, v) => s + v, 0) / this.period;
    const variance = this.values.reduce((s, v) => s + (v - mean) ** 2, 0) / this.period;
    const stdDev = Math.sqrt(variance);

    const upper = mean + this.stdDevMultiplier * stdDev;
    const lower = mean - this.stdDevMultiplier * stdDev;
    const bandwidth = upper - lower;

    this.result = {
      upper,
      middle: mean,
      lower,
      bandwidth,
      percentB: bandwidth > 0 ? (price - lower) / bandwidth : 0.5,
    };
    return this.result;
  }

  get current(): BollingerResult | null {
    return this.result;
  }

  get ready(): boolean {
    return this.result !== null;
  }

  reset(): void {
    this.values = [];
    this.result = null;
  }
}
