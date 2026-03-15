/**
 * Average Directional Index indicator.
 * Measures trend strength (0-100). Values > 25 suggest a strong trend.
 */
export interface ADXResult {
  adx: number;
  plusDI: number;
  minusDI: number;
}

export class ADX {
  private period: number;
  private prevHigh: number | null = null;
  private prevLow: number | null = null;
  private prevClose: number | null = null;
  private smoothedPlusDM: number | null = null;
  private smoothedMinusDM: number | null = null;
  private smoothedTR: number | null = null;
  private dxValues: number[] = [];
  private adxValue: number | null = null;
  private result: ADXResult | null = null;
  private count = 0;

  constructor(period = 14) {
    this.period = period;
  }

  update(high: number, low: number, close: number): ADXResult | null {
    if (this.prevHigh === null) {
      this.prevHigh = high;
      this.prevLow = low;
      this.prevClose = close;
      return null;
    }

    this.count++;
    const plusDM = Math.max(high - this.prevHigh, 0);
    const minusDM = Math.max(this.prevLow! - low, 0);
    const tr = Math.max(
      high - low,
      Math.abs(high - this.prevClose!),
      Math.abs(low - this.prevClose!)
    );

    // Neutralize if both are positive - keep only the larger
    const finalPlusDM = plusDM > minusDM ? plusDM : 0;
    const finalMinusDM = minusDM > plusDM ? minusDM : 0;

    this.prevHigh = high;
    this.prevLow = low;
    this.prevClose = close;

    if (this.smoothedTR === null) {
      if (this.count === 1) {
        this.smoothedPlusDM = finalPlusDM;
        this.smoothedMinusDM = finalMinusDM;
        this.smoothedTR = tr;
      } else if (this.count < this.period) {
        this.smoothedPlusDM! += finalPlusDM;
        this.smoothedMinusDM! += finalMinusDM;
        this.smoothedTR! += tr;
        return null;
      } else {
        this.smoothedPlusDM! += finalPlusDM;
        this.smoothedMinusDM! += finalMinusDM;
        this.smoothedTR! += tr;
        // First smoothed values are simple sums
      }
      if (this.count < this.period) return null;
    } else {
      // Wilder's smoothing
      this.smoothedPlusDM = this.smoothedPlusDM! - this.smoothedPlusDM! / this.period + finalPlusDM;
      this.smoothedMinusDM = this.smoothedMinusDM! - this.smoothedMinusDM! / this.period + finalMinusDM;
      this.smoothedTR = this.smoothedTR - this.smoothedTR / this.period + tr;
    }

    if (this.smoothedTR === 0) return null;

    const plusDI = (this.smoothedPlusDM! / this.smoothedTR!) * 100;
    const minusDI = (this.smoothedMinusDM! / this.smoothedTR!) * 100;
    const diSum = plusDI + minusDI;
    const dx = diSum === 0 ? 0 : (Math.abs(plusDI - minusDI) / diSum) * 100;

    if (this.adxValue === null) {
      this.dxValues.push(dx);
      if (this.dxValues.length >= this.period) {
        this.adxValue = this.dxValues.reduce((s, v) => s + v, 0) / this.period;
        this.dxValues = [];
      } else {
        return null;
      }
    } else {
      this.adxValue = (this.adxValue * (this.period - 1) + dx) / this.period;
    }

    this.result = { adx: this.adxValue, plusDI, minusDI };
    return this.result;
  }

  get current(): ADXResult | null {
    return this.result;
  }

  get ready(): boolean {
    return this.result !== null;
  }

  reset(): void {
    this.prevHigh = null;
    this.prevLow = null;
    this.prevClose = null;
    this.smoothedPlusDM = null;
    this.smoothedMinusDM = null;
    this.smoothedTR = null;
    this.dxValues = [];
    this.adxValue = null;
    this.result = null;
    this.count = 0;
  }
}
