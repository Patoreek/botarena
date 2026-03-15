/**
 * Exponential Moving Average indicator.
 */
export class EMA {
  private period: number;
  private multiplier: number;
  private value: number | null = null;
  private count = 0;
  private sum = 0;

  constructor(period: number) {
    this.period = period;
    this.multiplier = 2 / (period + 1);
  }

  update(price: number): number | null {
    this.count++;
    if (this.value === null) {
      this.sum += price;
      if (this.count >= this.period) {
        this.value = this.sum / this.period;
      }
      return this.value;
    }
    this.value = (price - this.value) * this.multiplier + this.value;
    return this.value;
  }

  get current(): number | null {
    return this.value;
  }

  get ready(): boolean {
    return this.value !== null;
  }

  reset(): void {
    this.value = null;
    this.count = 0;
    this.sum = 0;
  }
}
