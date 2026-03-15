/**
 * Simple Moving Average indicator.
 */
export class SMA {
  private period: number;
  private values: number[] = [];

  constructor(period: number) {
    this.period = period;
  }

  update(value: number): number | null {
    this.values.push(value);
    if (this.values.length > this.period) {
      this.values.shift();
    }
    if (this.values.length < this.period) return null;
    return this.values.reduce((sum, v) => sum + v, 0) / this.period;
  }

  get current(): number | null {
    if (this.values.length < this.period) return null;
    return this.values.reduce((sum, v) => sum + v, 0) / this.period;
  }

  get ready(): boolean {
    return this.values.length >= this.period;
  }

  reset(): void {
    this.values = [];
  }
}
