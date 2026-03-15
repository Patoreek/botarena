# Multi-Strategy Trading Framework

## Architecture Overview

```
engine/
├── strategies/           # Strategy modules
│   ├── types.ts          # IStrategy interface, Signal, BaseStrategy
│   ├── registry.ts       # StrategyRegistry singleton
│   ├── index.ts          # Barrel (triggers registration)
│   ├── grid-strategy.ts  # Wraps existing grid.ts
│   ├── trend-following.ts
│   ├── mean-reversion.ts
│   ├── market-making.ts
│   ├── arbitrage.ts
│   ├── dca.ts
│   ├── scalping.ts
│   ├── regime.ts         # Meta-strategy: regime detection + switching
│   ├── ai-signal.ts      # External ML signal adapter
│   └── examples/         # JSON config examples
├── indicators/           # Technical analysis indicators
│   ├── sma.ts, ema.ts, rsi.ts, bollinger.ts
│   ├── macd.ts, atr.ts, adx.ts, vwap.ts, zscore.ts
│   └── index.ts
├── risk/                 # Centralized risk engine
│   ├── risk-engine.ts
│   └── index.ts
├── backtest/             # Backtesting harness
│   ├── backtest-runner.ts
│   ├── metrics.ts
│   └── index.ts
├── runner.ts             # Strategy-agnostic execution loop
├── manager.ts            # RunManager singleton
├── paper-trader.ts       # Paper trading simulation
└── grid.ts               # Original grid engine (untouched)
```

## How to Enable a Strategy

### 1. Create a bot via API

```bash
# Grid bot (existing pattern)
POST /bots
{
  "name": "My Grid Bot",
  "strategy": "GRID",
  "gridConfig": { ... }
}

# Non-grid bot (new pattern)
POST /bots
{
  "name": "My Trend Bot",
  "strategy": "TREND_FOLLOWING",
  "strategyConfig": {
    "totalInvestment": 10000,
    "fastPeriod": 9,
    "slowPeriod": 21,
    "adxThreshold": 25,
    "positionSizePercent": 0.1
  }
}
```

### 2. Start a run

```bash
POST /bots/:botId/runs
{
  "exchange": "BINANCE",
  "marketPair": "BTCUSDT",
  "interval": "ONE_MINUTE",
  "durationHours": 4
}
```

The runner automatically loads the strategy and config from the bot.

## Available Strategies

| Strategy | Slug | Data Feeds | Description |
|----------|------|-----------|-------------|
| Grid Trading | `GRID` | TICKER | Price level grid with buy/sell zones |
| Trend Following | `TREND_FOLLOWING` | TICKER, KLINE | EMA crossover + ADX filter + MACD confirmation |
| Mean Reversion | `MEAN_REVERSION` | TICKER, KLINE | RSI + Bollinger Bands + Z-score oversold detection |
| Market Making | `MARKET_MAKING` | TICKER, KLINE | Spread capture with inventory skewing |
| Arbitrage | `ARBITRAGE` | TICKER | Cross-exchange spread detection (scaffolded) |
| DCA | `DCA` | TICKER | Dollar cost averaging with dip-buying and safety orders |
| Scalping | `SCALPING` | TICKER, KLINE | Micro-move capture with ATR stops |
| Regime Switching | `REGIME` | TICKER, KLINE | Auto-switches child strategies by market regime |
| AI/ML Signal | `AI_SIGNAL` | TICKER | Pluggable external signal interface |

## Regime-Based Strategy Switching

The `REGIME` strategy detects market conditions using ADX, ATR, and Bollinger Bandwidth:

- **TRENDING**: ADX > threshold → routes to trend strategy
- **RANGING**: Low bandwidth → routes to mean reversion strategy
- **HIGH_VOLATILITY**: ATR/price > threshold → optionally pauses or uses volatility strategy

Hysteresis prevents flip-flopping: regime must persist for `minRegimeDurationTicks` before switching.

```json
{
  "trendThreshold": 25,
  "volatilityThreshold": 3,
  "minRegimeDurationTicks": 10,
  "trendStrategy": "TREND_FOLLOWING",
  "rangeStrategy": "MEAN_REVERSION"
}
```

## Risk Engine

All strategies pass through the centralized risk engine before execution.

Controls:
- `maxPositionSize` — per-trade cap
- `maxPortfolioExposure` — total exposure cap
- `maxDrawdownPercent` — circuit breaker
- `maxDailyLoss` — daily loss limit
- `maxOpenPositions` — position count limit
- `maxTradesPerDay` — trade count limit
- `cooldownAfterLossTicks` — pause after loss
- `minConfidence` — signal quality filter
- `minEdgePercent` — minimum expected return after fees

## Backtesting

```typescript
import { runBacktest } from "./backtest/index.js";

const result = await runBacktest({
  strategySlug: "TREND_FOLLOWING",
  strategyConfig: { totalInvestment: 10000, fastPeriod: 9, slowPeriod: 21 },
  marketPair: "BTCUSDT",
  interval: "ONE_HOUR",
  candleCount: 500,
  initialBalance: 10000,
  slippageBps: 5,
});

console.log(result.metrics);
// { netPnl, totalReturn, sharpeRatio, sortinoRatio, maxDrawdown,
//   winRate, profitFactor, expectancy, avgHoldTicks, tradeCount }
```

Compare multiple strategies:

```typescript
import { compareStrategies } from "./backtest/index.js";

const results = await compareStrategies([
  { strategySlug: "TREND_FOLLOWING", strategyConfig: {...}, ... },
  { strategySlug: "MEAN_REVERSION", strategyConfig: {...}, ... },
]);
// Sorted by netPnl descending
```

## Running Tests

```bash
cd apps/api
npx vitest run src/lib/engine/__tests__/
```

## Adding a New Strategy

1. Create `apps/api/src/lib/engine/strategies/my-strategy.ts`
2. Implement `IStrategy` (extend `BaseStrategy` for sensible defaults)
3. Export a Zod config schema
4. Self-register at the bottom of the file:
   ```typescript
   strategyRegistry.register("MY_STRATEGY", (config) => {
     const s = new MyStrategy();
     s.init(config);
     return s;
   }, new MyStrategy().metadata);
   ```
5. Import in `strategies/index.ts`
6. Add the enum value to Prisma schema and Zod `botStrategy`

## Known Caveats

- **Arbitrage**: Only scaffolded for single-exchange. Real cross-exchange arb needs multi-exchange connectors.
- **AI/ML Signal**: HTTP polling is fire-and-forget. For production, consider WebSocket or message queue.
- **Market Making**: In paper mode, both sides always fill immediately. Real execution has partial fills and queue priority.
- **Candle data**: Binance public API is rate-limited. Strategies that need KLINE data fetch at throttled intervals.
- **Regime switching**: Child strategy state is not preserved across regime transitions.
