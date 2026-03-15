/**
 * Backtest performance metrics calculation.
 */

import type { Trade } from "../paper-trader.js";

export interface BacktestMetrics {
  netPnl: number;
  totalReturn: number;       // percentage
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  maxDrawdown: number;       // percentage
  maxDrawdownValue: number;  // absolute
  winRate: number;           // percentage
  profitFactor: number;
  expectancy: number;
  avgHoldTicks: number;
  exposurePercent: number;
  tradeCount: number;
  totalBuys: number;
  totalSells: number;
}

export function computeMetrics(
  trades: Trade[],
  initialBalance: number,
  totalTicks: number,
): BacktestMetrics {
  const sells = trades.filter((t) => t.side === "SELL");
  const buys = trades.filter((t) => t.side === "BUY");
  const wins = sells.filter((t) => t.pnl > 0);
  const losses = sells.filter((t) => t.pnl <= 0);

  const totalProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const totalLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const netPnl = totalProfit - totalLoss;
  const totalReturn = initialBalance > 0 ? (netPnl / initialBalance) * 100 : 0;

  // Win rate
  const winRate = sells.length > 0 ? (wins.length / sells.length) * 100 : 0;

  // Profit factor
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

  // Expectancy (average PnL per trade)
  const expectancy = sells.length > 0 ? netPnl / sells.length : 0;

  // Max drawdown — track equity curve
  let peakEquity = initialBalance;
  let maxDd = 0;
  let maxDdValue = 0;
  let equity = initialBalance;

  for (const trade of trades) {
    if (trade.side === "SELL") {
      equity += trade.pnl;
    }
    if (equity > peakEquity) peakEquity = equity;
    const dd = peakEquity > 0 ? (peakEquity - equity) / peakEquity : 0;
    if (dd > maxDd) {
      maxDd = dd;
      maxDdValue = peakEquity - equity;
    }
  }

  // Sharpe ratio (annualized, assuming daily returns from trade PnLs)
  let sharpeRatio: number | null = null;
  let sortinoRatio: number | null = null;
  if (sells.length > 1) {
    const returns = sells.map((t) => t.pnl / initialBalance);
    const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);
    if (stdDev > 0) {
      sharpeRatio = (avgReturn / stdDev) * Math.sqrt(252); // annualize
    }

    // Sortino: only downside deviation
    const downsideReturns = returns.filter((r) => r < 0);
    if (downsideReturns.length > 0) {
      const downsideVariance = downsideReturns.reduce((s, r) => s + r ** 2, 0) / downsideReturns.length;
      const downsideDev = Math.sqrt(downsideVariance);
      if (downsideDev > 0) {
        sortinoRatio = (avgReturn / downsideDev) * Math.sqrt(252);
      }
    }
  }

  // Average hold time (ticks between buy and sell)
  let totalHoldTicks = 0;
  let holdCount = 0;
  const buyTimes = new Map<string, number>();
  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    if (t.side === "BUY") {
      buyTimes.set(t.gridLevel, i);
    } else if (t.side === "SELL") {
      const buyIdx = buyTimes.get(t.gridLevel);
      if (buyIdx !== undefined) {
        totalHoldTicks += i - buyIdx;
        holdCount++;
        buyTimes.delete(t.gridLevel);
      }
    }
  }
  const avgHoldTicks = holdCount > 0 ? totalHoldTicks / holdCount : 0;

  // Exposure: fraction of time with open positions
  const exposurePercent = totalTicks > 0 ? (buys.length / totalTicks) * 100 : 0;

  return {
    netPnl: parseFloat(netPnl.toFixed(6)),
    totalReturn: parseFloat(totalReturn.toFixed(4)),
    sharpeRatio: sharpeRatio !== null ? parseFloat(sharpeRatio.toFixed(4)) : null,
    sortinoRatio: sortinoRatio !== null ? parseFloat(sortinoRatio.toFixed(4)) : null,
    maxDrawdown: parseFloat((maxDd * 100).toFixed(4)),
    maxDrawdownValue: parseFloat(maxDdValue.toFixed(6)),
    winRate: parseFloat(winRate.toFixed(2)),
    profitFactor: profitFactor === Infinity ? 999 : parseFloat(profitFactor.toFixed(4)),
    expectancy: parseFloat(expectancy.toFixed(6)),
    avgHoldTicks: parseFloat(avgHoldTicks.toFixed(1)),
    exposurePercent: parseFloat(exposurePercent.toFixed(2)),
    tradeCount: trades.length,
    totalBuys: buys.length,
    totalSells: sells.length,
  };
}
