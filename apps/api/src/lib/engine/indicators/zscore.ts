/**
 * Z-Score indicator — measures how many standard deviations
 * the current value is from the rolling mean.
 */
export class ZScore {
  private period: number;
  private values: number[] = [];
  private value: number | null = null;

  constructor(period = 20) {
    this.period = period;
  }

  update(price: number): number | null {
    this.values.push(price);
    if (this.values.length > this.period) {
      this.values.shift();
    }
    if (this.values.length < this.period) return null;

    const mean = this.values.reduce((s, v) => s + v, 0) / this.period;
    const variance = this.values.reduce((s, v) => s + (v - mean) ** 2, 0) / this.period;
    const stdDev = Math.sqrt(variance);

    this.value = stdDev === 0 ? 0 : (price - mean) / stdDev;
    return this.value;
  }

  get current(): number | null {
    return this.value;
  }

  get ready(): boolean {
    return this.value !== null;
  }

  reset(): void {
    this.values = [];
    this.value = null;
  }
}
