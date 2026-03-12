/**
 * Grid trading strategy engine.
 *
 * Generates grid price levels and evaluates whether to BUY, SELL, or HOLD
 * based on the current market price and the state of the grid.
 */

export type GridType = "ARITHMETIC" | "GEOMETRIC";
export type GridMode = "LONG" | "SHORT" | "NEUTRAL";
export type Decision = "BUY" | "SELL" | "HOLD";

export interface GridConfig {
  upperPrice: number;
  lowerPrice: number;
  gridCount: number;
  gridType: GridType;
  gridMode: GridMode;
  amountPerGrid: number;
  totalInvestment: number;
  minProfitPerGrid?: number; // percentage, e.g. 0.1 = 0.1%
  maxOpenOrders?: number;
}

export interface GridLevel {
  index: number;
  price: number;
  /** Whether we currently hold a position bought at this level */
  hasPosition: boolean;
  /** Price at which we bought (for PnL calculation) */
  buyPrice: number | null;
}

export interface GridDecision {
  decision: Decision;
  reason: string;
  gridLevel: string;
  price: number;
  amount: number;
  confidence: number;
}

/**
 * Generate evenly-spaced (arithmetic) or geometrically-spaced grid levels
 * between lowerPrice and upperPrice.
 */
export function generateGridLevels(config: GridConfig): GridLevel[] {
  const { upperPrice, lowerPrice, gridCount, gridType } = config;
  const levels: GridLevel[] = [];

  for (let i = 0; i <= gridCount; i++) {
    let price: number;
    if (gridType === "ARITHMETIC") {
      price = lowerPrice + (upperPrice - lowerPrice) * (i / gridCount);
    } else {
      // Geometric: each level is a constant ratio apart
      const ratio = Math.pow(upperPrice / lowerPrice, 1 / gridCount);
      price = lowerPrice * Math.pow(ratio, i);
    }
    levels.push({
      index: i,
      price: parseFloat(price.toFixed(8)),
      hasPosition: false,
      buyPrice: null,
    });
  }

  return levels;
}

/**
 * Find the two grid levels that bracket the current price.
 */
function findBracketingLevels(
  price: number,
  levels: GridLevel[]
): { below: GridLevel | null; above: GridLevel | null } {
  let below: GridLevel | null = null;
  let above: GridLevel | null = null;

  for (const level of levels) {
    if (level.price <= price) {
      if (!below || level.price > below.price) below = level;
    }
    if (level.price > price) {
      if (!above || level.price < above.price) above = level;
    }
  }

  return { below, above };
}

/**
 * Count how many grid levels currently have open positions.
 */
function countOpenPositions(levels: GridLevel[]): number {
  return levels.filter((l) => l.hasPosition).length;
}

/**
 * Core decision engine. Evaluates current price against the grid and
 * decides whether to BUY, SELL, or HOLD.
 */
export function evaluateGrid(
  currentPrice: number,
  levels: GridLevel[],
  config: GridConfig,
  previousPrice: number | null
): GridDecision {
  // Price out of range
  if (currentPrice > config.upperPrice) {
    // Check if we can sell any positions above current price
    const sellable = levels.filter((l) => l.hasPosition);
    if (sellable.length > 0) {
      const best = sellable.reduce((a, b) => (a.buyPrice! < b.buyPrice! ? a : b));
      return {
        decision: "SELL",
        reason: `Price ${currentPrice.toFixed(6)} above upper grid (${config.upperPrice}). Closing position from level ${best.index} bought at ${best.buyPrice?.toFixed(6)}`,
        gridLevel: `L${best.index}`,
        price: currentPrice,
        amount: config.amountPerGrid,
        confidence: 0.9,
      };
    }
    return {
      decision: "HOLD",
      reason: `Price ${currentPrice.toFixed(6)} above upper grid (${config.upperPrice}). No positions to close.`,
      gridLevel: "OOB",
      price: currentPrice,
      amount: 0,
      confidence: 0.5,
    };
  }

  if (currentPrice < config.lowerPrice) {
    if (config.gridMode !== "SHORT") {
      const openCount = countOpenPositions(levels);
      if (!config.maxOpenOrders || openCount < config.maxOpenOrders) {
        return {
          decision: "BUY",
          reason: `Price ${currentPrice.toFixed(6)} below lower grid (${config.lowerPrice}). Buying the dip at bottom of range.`,
          gridLevel: "L0",
          price: currentPrice,
          amount: config.amountPerGrid,
          confidence: 0.85,
        };
      }
    }
    return {
      decision: "HOLD",
      reason: `Price ${currentPrice.toFixed(6)} below lower grid (${config.lowerPrice}). Max orders reached or SHORT mode.`,
      gridLevel: "OOB",
      price: currentPrice,
      amount: 0,
      confidence: 0.4,
    };
  }

  const { below, above } = findBracketingLevels(currentPrice, levels);
  if (!below || !above) {
    return {
      decision: "HOLD",
      reason: `Cannot find bracketing grid levels for price ${currentPrice.toFixed(6)}`,
      gridLevel: "?",
      price: currentPrice,
      amount: 0,
      confidence: 0.3,
    };
  }

  const priceMovedDown = previousPrice !== null && currentPrice < previousPrice;
  const priceMovedUp = previousPrice !== null && currentPrice > previousPrice;

  // Check for SELL: price crossed up through a level where we hold a position
  if (priceMovedUp || previousPrice === null) {
    // Find levels with positions that are at or below current price where we can profit
    const sellCandidates = levels.filter((l) => {
      if (!l.hasPosition || l.buyPrice === null) return false;
      // Check if price is at or above the next grid level from where we bought
      const profitPct = ((currentPrice - l.buyPrice) / l.buyPrice) * 100;
      if (config.minProfitPerGrid && profitPct < config.minProfitPerGrid) return false;
      return currentPrice >= l.price && l.price <= above.price;
    });

    if (sellCandidates.length > 0 && (config.gridMode === "NEUTRAL" || config.gridMode === "SHORT")) {
      // Sell the position with the best profit (or worst, to rotate)
      const best = sellCandidates[0];
      const pnl = best.buyPrice ? ((currentPrice - best.buyPrice) / best.buyPrice * 100).toFixed(2) : "?";
      return {
        decision: "SELL",
        reason: `Price rose to ${currentPrice.toFixed(6)}, crossing grid L${best.index} (${best.price.toFixed(6)}). Selling position bought at ${best.buyPrice?.toFixed(6)} for ${pnl}% PnL.`,
        gridLevel: `L${best.index}`,
        price: currentPrice,
        amount: config.amountPerGrid,
        confidence: 0.8,
      };
    }
  }

  // Check for BUY: price crossed down through a level where we don't hold
  if (priceMovedDown || previousPrice === null) {
    const buyCandidates = levels.filter((l) => {
      if (l.hasPosition) return false;
      // Level is at or above current price (we're crossing down through it)
      return l.price >= currentPrice && l.price <= above.price;
    });

    if (buyCandidates.length > 0 && (config.gridMode === "NEUTRAL" || config.gridMode === "LONG")) {
      const openCount = countOpenPositions(levels);
      if (!config.maxOpenOrders || openCount < config.maxOpenOrders) {
        const target = buyCandidates[buyCandidates.length - 1]; // lowest unfilled level
        return {
          decision: "BUY",
          reason: `Price dropped to ${currentPrice.toFixed(6)}, crossing grid L${target.index} (${target.price.toFixed(6)}). Opening position at this level.`,
          gridLevel: `L${target.index}`,
          price: currentPrice,
          amount: config.amountPerGrid,
          confidence: 0.75,
        };
      }
    }
  }

  // Aggressive mode: if no clear cross, look for any unfilled buy level near price
  const nearbyBuyLevel = levels.find((l) => {
    if (l.hasPosition) return false;
    const dist = Math.abs(currentPrice - l.price) / currentPrice;
    return dist < 0.003; // within 0.3% of a grid level
  });

  if (nearbyBuyLevel && (config.gridMode === "NEUTRAL" || config.gridMode === "LONG")) {
    const openCount = countOpenPositions(levels);
    if (!config.maxOpenOrders || openCount < config.maxOpenOrders) {
      return {
        decision: "BUY",
        reason: `Price ${currentPrice.toFixed(6)} within 0.3% of unfilled grid L${nearbyBuyLevel.index} (${nearbyBuyLevel.price.toFixed(6)}). Filling grid level.`,
        gridLevel: `L${nearbyBuyLevel.index}`,
        price: currentPrice,
        amount: config.amountPerGrid,
        confidence: 0.6,
      };
    }
  }

  // Check if we can sell any position at a profit near current price
  const nearbySellLevel = levels.find((l) => {
    if (!l.hasPosition || l.buyPrice === null) return false;
    const pnl = (currentPrice - l.buyPrice) / l.buyPrice;
    return pnl > 0.001; // at least 0.1% profit
  });

  if (nearbySellLevel && (config.gridMode === "NEUTRAL" || config.gridMode === "SHORT")) {
    const pnl = nearbySellLevel.buyPrice
      ? ((currentPrice - nearbySellLevel.buyPrice) / nearbySellLevel.buyPrice * 100).toFixed(2)
      : "?";
    return {
      decision: "SELL",
      reason: `Profitable position at L${nearbySellLevel.index} (bought ${nearbySellLevel.buyPrice?.toFixed(6)}, now ${currentPrice.toFixed(6)}, ${pnl}% gain). Taking profit.`,
      gridLevel: `L${nearbySellLevel.index}`,
      price: currentPrice,
      amount: config.amountPerGrid,
      confidence: 0.65,
    };
  }

  return {
    decision: "HOLD",
    reason: `Price ${currentPrice.toFixed(6)} between L${below.index} (${below.price.toFixed(6)}) and L${above.index} (${above.price.toFixed(6)}). No grid level crossing detected.`,
    gridLevel: `L${below.index}-L${above.index}`,
    price: currentPrice,
    amount: 0,
    confidence: 0.5,
  };
}
