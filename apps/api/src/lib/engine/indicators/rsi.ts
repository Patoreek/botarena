/**
 * Relative Strength Index indicator.
 */
export class RSI {
  private period: number;
  private prevPrice: number | null = null;
  private avgGain: number | null = null;
  private avgLoss: number | null = null;
  private gains: number[] = [];
  private losses: number[] = [];
  private value: number | null = null;

  constructor(period = 14) {
    this.period = period;
  }

  update(price: number): number | null {
    if (this.prevPrice === null) {
      this.prevPrice = price;
      return null;
    }

    const change = price - this.prevPrice;
    this.prevPrice = price;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (this.avgGain === null) {
      this.gains.push(gain);
      this.losses.push(loss);
      if (this.gains.length >= this.period) {
        this.avgGain = this.gains.reduce((s, v) => s + v, 0) / this.period;
        this.avgLoss = this.losses.reduce((s, v) => s + v, 0) / this.period;
        this.gains = [];
        this.losses = [];
      } else {
        return null;
      }
    } else {
      this.avgGain = (this.avgGain * (this.period - 1) + gain) / this.period;
      this.avgLoss = (this.avgLoss! * (this.period - 1) + loss) / this.period;
    }

    if (this.avgLoss === 0) {
      this.value = 100;
    } else {
      const rs = this.avgGain / this.avgLoss!;
      this.value = 100 - 100 / (1 + rs);
    }
    return this.value;
  }

  get current(): number | null {
    return this.value;
  }

  get ready(): boolean {
    return this.value !== null;
  }

  reset(): void {
    this.prevPrice = null;
    this.avgGain = null;
    this.avgLoss = null;
    this.gains = [];
    this.losses = [];
    this.value = null;
  }
}
