/**
 * Average True Range indicator.
 */
export class ATR {
  private period: number;
  private prevClose: number | null = null;
  private trueRanges: number[] = [];
  private value: number | null = null;

  constructor(period = 14) {
    this.period = period;
  }

  update(high: number, low: number, close: number): number | null {
    if (this.prevClose === null) {
      this.prevClose = close;
      this.trueRanges.push(high - low);
      return null;
    }

    const tr = Math.max(
      high - low,
      Math.abs(high - this.prevClose),
      Math.abs(low - this.prevClose)
    );
    this.prevClose = close;

    if (this.value === null) {
      this.trueRanges.push(tr);
      if (this.trueRanges.length >= this.period) {
        this.value = this.trueRanges.reduce((s, v) => s + v, 0) / this.period;
        this.trueRanges = [];
      }
      return this.value;
    }

    // Wilder's smoothing
    this.value = (this.value * (this.period - 1) + tr) / this.period;
    return this.value;
  }

  get current(): number | null {
    return this.value;
  }

  get ready(): boolean {
    return this.value !== null;
  }

  reset(): void {
    this.prevClose = null;
    this.trueRanges = [];
    this.value = null;
  }
}
