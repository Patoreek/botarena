/**
 * Volume Weighted Average Price indicator.
 */
export interface VWAPResult {
  vwap: number;
  deviation: number; // current price deviation from VWAP as percentage
}

export class VWAP {
  private cumulativeTPV = 0; // sum of (typical_price * volume)
  private cumulativeVolume = 0;
  private result: VWAPResult | null = null;

  update(high: number, low: number, close: number, volume: number): VWAPResult | null {
    if (volume <= 0) return this.result;

    const typicalPrice = (high + low + close) / 3;
    this.cumulativeTPV += typicalPrice * volume;
    this.cumulativeVolume += volume;

    const vwap = this.cumulativeTPV / this.cumulativeVolume;
    const deviation = vwap !== 0 ? ((close - vwap) / vwap) * 100 : 0;

    this.result = { vwap, deviation };
    return this.result;
  }

  get current(): VWAPResult | null {
    return this.result;
  }

  get ready(): boolean {
    return this.result !== null;
  }

  /** Call at the start of each session/day to reset cumulative values. */
  reset(): void {
    this.cumulativeTPV = 0;
    this.cumulativeVolume = 0;
    this.result = null;
  }
}
