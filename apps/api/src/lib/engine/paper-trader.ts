/**
 * Paper trading engine. Simulates order execution without placing real orders.
 * Tracks virtual balances, positions, and computes PnL.
 */

export interface Trade {
  side: "BUY" | "SELL";
  price: number;
  amount: number;     // quantity of the asset
  cost: number;       // total USDT cost/proceeds
  fee: number;        // simulated fee (0.1% Binance spot)
  pnl: number;        // realized PnL for sells
  timestamp: Date;
  gridLevel: string;
}

export interface PaperPortfolio {
  quoteBalance: number;   // USDT balance
  baseBalance: number;    // Asset balance (e.g. DOGE)
  initialInvestment: number;
  totalProfit: number;
  totalLoss: number;
  netPnl: number;
  totalBuys: number;
  totalSells: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  roi: number;
}

const FEE_RATE = 0.001; // 0.1% Binance spot fee

export class PaperTrader {
  private quoteBalance: number;
  private baseBalance: number;
  private initialInvestment: number;
  private totalProfit = 0;
  private totalLoss = 0;
  private totalBuys = 0;
  private totalSells = 0;
  private winCount = 0;
  private lossCount = 0;
  private trades: Trade[] = [];

  constructor(initialQuoteBalance: number) {
    this.quoteBalance = initialQuoteBalance;
    this.baseBalance = 0;
    this.initialInvestment = initialQuoteBalance;
  }

  get portfolio(): PaperPortfolio {
    const netPnl = this.totalProfit - this.totalLoss;
    return {
      quoteBalance: this.quoteBalance,
      baseBalance: this.baseBalance,
      initialInvestment: this.initialInvestment,
      totalProfit: parseFloat(this.totalProfit.toFixed(6)),
      totalLoss: parseFloat(this.totalLoss.toFixed(6)),
      netPnl: parseFloat(netPnl.toFixed(6)),
      totalBuys: this.totalBuys,
      totalSells: this.totalSells,
      totalTrades: this.totalBuys + this.totalSells,
      winCount: this.winCount,
      lossCount: this.lossCount,
      roi: this.initialInvestment > 0
        ? parseFloat(((netPnl / this.initialInvestment) * 100).toFixed(4))
        : 0,
    };
  }

  get recentTrades(): Trade[] {
    return this.trades.slice(-50);
  }

  /**
   * Execute a simulated BUY order.
   * Returns the trade or null if insufficient balance.
   */
  buy(price: number, amount: number, gridLevel: string): Trade | null {
    const cost = price * amount;
    const fee = cost * FEE_RATE;
    const totalCost = cost + fee;

    if (totalCost > this.quoteBalance) {
      // Reduce amount to fit balance
      const maxCost = this.quoteBalance;
      const maxAmount = (maxCost / (1 + FEE_RATE)) / price;
      if (maxAmount < amount * 0.1) return null; // not enough for even 10%
      amount = parseFloat(maxAmount.toFixed(8));
      const adjustedCost = price * amount;
      const adjustedFee = adjustedCost * FEE_RATE;

      this.quoteBalance -= adjustedCost + adjustedFee;
      this.baseBalance += amount;
      this.totalBuys++;

      const trade: Trade = {
        side: "BUY",
        price,
        amount,
        cost: adjustedCost,
        fee: adjustedFee,
        pnl: 0,
        timestamp: new Date(),
        gridLevel,
      };
      this.trades.push(trade);
      return trade;
    }

    this.quoteBalance -= totalCost;
    this.baseBalance += amount;
    this.totalBuys++;

    const trade: Trade = {
      side: "BUY",
      price,
      amount,
      cost,
      fee,
      pnl: 0,
      timestamp: new Date(),
      gridLevel,
    };
    this.trades.push(trade);
    return trade;
  }

  /**
   * Execute a simulated SELL order.
   * Returns the trade or null if insufficient asset balance.
   */
  sell(price: number, amount: number, gridLevel: string, buyPrice: number | null): Trade | null {
    if (this.baseBalance < amount * 0.1) return null;
    amount = Math.min(amount, this.baseBalance);
    amount = parseFloat(amount.toFixed(8));

    const proceeds = price * amount;
    const fee = proceeds * FEE_RATE;
    const netProceeds = proceeds - fee;

    // Calculate PnL based on buy price
    let pnl = 0;
    if (buyPrice !== null) {
      const buyCost = buyPrice * amount;
      pnl = netProceeds - buyCost;
    }

    this.quoteBalance += netProceeds;
    this.baseBalance -= amount;
    this.totalSells++;

    if (pnl > 0) {
      this.totalProfit += pnl;
      this.winCount++;
    } else {
      this.totalLoss += Math.abs(pnl);
      this.lossCount++;
    }

    const trade: Trade = {
      side: "SELL",
      price,
      amount,
      cost: proceeds,
      fee,
      pnl: parseFloat(pnl.toFixed(6)),
      timestamp: new Date(),
      gridLevel,
    };
    this.trades.push(trade);
    return trade;
  }

  /**
   * Get the current portfolio value at a given market price.
   */
  totalValue(currentPrice: number): number {
    return this.quoteBalance + this.baseBalance * currentPrice;
  }

  /**
   * Get position summary string for logging.
   */
  positionSummary(currentPrice: number): string {
    const value = this.totalValue(currentPrice);
    return `${this.baseBalance.toFixed(4)} base + ${this.quoteBalance.toFixed(2)} USDT = ${value.toFixed(2)} USDT total (${this.portfolio.roi}% ROI)`;
  }
}
