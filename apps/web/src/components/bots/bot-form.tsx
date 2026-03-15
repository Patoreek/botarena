"use client";

import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

// ---------------------------------------------------------------------------
// Strategy types & labels
// ---------------------------------------------------------------------------

const ALL_STRATEGIES = [
  "GRID", "TREND_FOLLOWING", "MEAN_REVERSION", "MARKET_MAKING",
  "DCA", "SCALPING", "ARBITRAGE", "REGIME", "AI_SIGNAL",
] as const;
type Strategy = (typeof ALL_STRATEGIES)[number];

const STRATEGY_LABELS: Record<Strategy, string> = {
  GRID: "Grid Trading",
  TREND_FOLLOWING: "Trend Following",
  MEAN_REVERSION: "Mean Reversion",
  MARKET_MAKING: "Market Making",
  DCA: "DCA (Dollar Cost Averaging)",
  SCALPING: "Scalping",
  ARBITRAGE: "Arbitrage",
  REGIME: "Regime Switching",
  AI_SIGNAL: "AI/ML Signal",
};

const STRATEGY_DESCRIPTIONS: Record<Strategy, string> = {
  GRID: "Place buy and sell orders at predefined price levels within a range",
  TREND_FOLLOWING: "EMA crossover with ADX filter and optional MACD confirmation",
  MEAN_REVERSION: "RSI + Bollinger Bands + Z-Score oversold/overbought detection",
  MARKET_MAKING: "Spread capture with inventory-aware skewing and dynamic spreads",
  DCA: "Dollar cost averaging with dip-buying and safety orders",
  SCALPING: "Micro-move capture with ATR-based stops and take profits",
  ARBITRAGE: "Cross-exchange spread detection (scaffolded for single exchange)",
  REGIME: "Auto-switches child strategies based on detected market regime",
  AI_SIGNAL: "Pluggable external ML signal interface (HTTP or static)",
};

// ---------------------------------------------------------------------------
// Form schema — loose: all strategy fields optional, validated on submit
// ---------------------------------------------------------------------------

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  strategy: z.enum(ALL_STRATEGIES),

  // --- Grid fields (kept flat for backward compat) ---
  upperPrice: z.coerce.number().positive("Must be positive").optional().or(z.literal("")),
  lowerPrice: z.coerce.number().positive("Must be positive").optional().or(z.literal("")),
  gridCount: z.coerce.number().int().min(2).max(500).optional().or(z.literal("")),
  gridType: z.enum(["ARITHMETIC", "GEOMETRIC"]).optional(),
  totalInvestment: z.coerce.number().positive("Must be positive").optional().or(z.literal("")),
  amountPerGrid: z.coerce.number().positive("Must be positive").optional().or(z.literal("")),
  takeProfitPrice: z.coerce.number().positive().optional().or(z.literal("")),
  stopLossPrice: z.coerce.number().positive().optional().or(z.literal("")),
  triggerPrice: z.coerce.number().positive().optional().or(z.literal("")),
  gridMode: z.enum(["LONG", "SHORT", "NEUTRAL"]).optional(),
  orderType: z.enum(["LIMIT", "MARKET"]).optional(),
  trailingUp: z.boolean().optional(),
  trailingDown: z.boolean().optional(),
  stopLossAction: z.enum(["CLOSE_ALL", "STOP_ONLY"]).optional(),
  takeProfitAction: z.enum(["CLOSE_ALL", "STOP_ONLY"]).optional(),
  minProfitPerGrid: z.coerce.number().positive().optional().or(z.literal("")),
  maxOpenOrders: z.coerce.number().int().min(1).optional().or(z.literal("")),

  // --- Shared strategy fields ---
  s_totalInvestment: z.coerce.number().positive().optional().or(z.literal("")),
  s_positionSizePercent: z.coerce.number().min(0.01).max(1).optional().or(z.literal("")),

  // --- Trend Following ---
  s_fastPeriod: z.coerce.number().int().min(2).optional().or(z.literal("")),
  s_slowPeriod: z.coerce.number().int().min(5).optional().or(z.literal("")),
  s_adxThreshold: z.coerce.number().min(0).optional().or(z.literal("")),
  s_stopLossAtrMultiplier: z.coerce.number().positive().optional().or(z.literal("")),
  s_takeProfitAtrMultiplier: z.coerce.number().positive().optional().or(z.literal("")),
  s_useMacdConfirmation: z.boolean().optional(),
  s_maxPositions: z.coerce.number().int().min(1).optional().or(z.literal("")),
  s_enableLong: z.boolean().optional(),
  s_enableShort: z.boolean().optional(),

  // --- Mean Reversion ---
  s_rsiPeriod: z.coerce.number().int().min(2).optional().or(z.literal("")),
  s_rsiOversold: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  s_rsiOverbought: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  s_bbPeriod: z.coerce.number().int().min(5).optional().or(z.literal("")),
  s_bbStdDev: z.coerce.number().positive().optional().or(z.literal("")),
  s_stopLossPercent: z.coerce.number().positive().optional().or(z.literal("")),
  s_exitMode: z.enum(["MEAN_REVERSION", "FIXED_TARGET", "BOTH"]).optional(),
  s_trendFilterEnabled: z.boolean().optional(),

  // --- Market Making ---
  s_spreadPercent: z.coerce.number().positive().optional().or(z.literal("")),
  s_dynamicSpreadEnabled: z.boolean().optional(),
  s_maxInventory: z.coerce.number().positive().optional().or(z.literal("")),
  s_inventorySkewFactor: z.coerce.number().min(0).max(1).optional().or(z.literal("")),
  s_fairPriceSource: z.enum(["VWAP", "EMA", "MID"]).optional(),
  s_maxVolatilityPause: z.coerce.number().positive().optional().or(z.literal("")),

  // --- DCA ---
  s_buyAmountQuote: z.coerce.number().positive().optional().or(z.literal("")),
  s_buyIntervalTicks: z.coerce.number().int().min(1).optional().or(z.literal("")),
  s_dipBuyEnabled: z.boolean().optional(),
  s_dipThresholdPercent: z.coerce.number().positive().optional().or(z.literal("")),
  s_dipMultiplier: z.coerce.number().min(1).optional().or(z.literal("")),
  s_takeProfitPercent: z.coerce.number().positive().optional().or(z.literal("")),
  s_safetyOrderEnabled: z.boolean().optional(),
  s_safetyOrderStepPercent: z.coerce.number().positive().optional().or(z.literal("")),
  s_safetyOrderMaxCount: z.coerce.number().int().min(0).optional().or(z.literal("")),

  // --- Scalping ---
  s_emaPeriod: z.coerce.number().int().min(2).optional().or(z.literal("")),
  s_atrPeriod: z.coerce.number().int().min(2).optional().or(z.literal("")),
  s_stopAtrMultiplier: z.coerce.number().positive().optional().or(z.literal("")),
  s_tpAtrMultiplier: z.coerce.number().positive().optional().or(z.literal("")),
  s_maxHoldTicks: z.coerce.number().int().min(1).optional().or(z.literal("")),
  s_maxTradesPerSession: z.coerce.number().int().min(1).optional().or(z.literal("")),
  s_volumeSpikeThreshold: z.coerce.number().min(1).optional().or(z.literal("")),

  // --- Arbitrage ---
  s_minNetSpreadPercent: z.coerce.number().positive().optional().or(z.literal("")),
  s_cooldownTicks: z.coerce.number().int().min(0).optional().or(z.literal("")),

  // --- Regime ---
  s_trendThreshold: z.coerce.number().positive().optional().or(z.literal("")),
  s_volatilityThreshold: z.coerce.number().positive().optional().or(z.literal("")),
  s_minRegimeDurationTicks: z.coerce.number().int().min(1).optional().or(z.literal("")),
  s_trendStrategy: z.string().optional(),
  s_rangeStrategy: z.string().optional(),

  // --- AI Signal ---
  s_signalSource: z.enum(["HTTP", "STATIC"]).optional(),
  s_httpEndpoint: z.string().optional(),
  s_minConfidence: z.coerce.number().min(0).max(1).optional().or(z.literal("")),
  s_upProbabilityBuyThreshold: z.coerce.number().min(0).max(1).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

// ---------------------------------------------------------------------------
// Default values per strategy
// ---------------------------------------------------------------------------

const STRATEGY_DEFAULTS: Record<Strategy, Partial<FormValues>> = {
  GRID: {
    gridType: "ARITHMETIC",
    gridMode: "NEUTRAL",
    orderType: "LIMIT",
    trailingUp: false,
    trailingDown: false,
    stopLossAction: "STOP_ONLY",
    takeProfitAction: "STOP_ONLY",
  },
  TREND_FOLLOWING: {
    s_totalInvestment: 10000 as any,
    s_positionSizePercent: 0.1 as any,
    s_fastPeriod: 9 as any,
    s_slowPeriod: 21 as any,
    s_adxThreshold: 25 as any,
    s_stopLossAtrMultiplier: 2 as any,
    s_takeProfitAtrMultiplier: 3 as any,
    s_useMacdConfirmation: false,
    s_maxPositions: 3 as any,
    s_enableLong: true,
    s_enableShort: false,
  },
  MEAN_REVERSION: {
    s_totalInvestment: 10000 as any,
    s_positionSizePercent: 0.1 as any,
    s_rsiPeriod: 14 as any,
    s_rsiOversold: 30 as any,
    s_rsiOverbought: 70 as any,
    s_bbPeriod: 20 as any,
    s_bbStdDev: 2 as any,
    s_stopLossPercent: 3 as any,
    s_exitMode: "MEAN_REVERSION",
    s_trendFilterEnabled: true,
    s_enableLong: true,
    s_enableShort: false,
  },
  MARKET_MAKING: {
    s_totalInvestment: 10000 as any,
    s_spreadPercent: 0.3 as any,
    s_dynamicSpreadEnabled: true,
    s_maxInventory: 10 as any,
    s_inventorySkewFactor: 0.5 as any,
    s_fairPriceSource: "EMA",
    s_maxVolatilityPause: 5 as any,
  },
  DCA: {
    s_totalInvestment: 5000 as any,
    s_buyAmountQuote: 100 as any,
    s_buyIntervalTicks: 60 as any,
    s_dipBuyEnabled: true,
    s_dipThresholdPercent: 5 as any,
    s_dipMultiplier: 2 as any,
    s_safetyOrderEnabled: false,
    s_safetyOrderStepPercent: 2 as any,
    s_safetyOrderMaxCount: 5 as any,
  },
  SCALPING: {
    s_totalInvestment: 5000 as any,
    s_positionSizePercent: 0.15 as any,
    s_emaPeriod: 5 as any,
    s_atrPeriod: 10 as any,
    s_stopAtrMultiplier: 1 as any,
    s_tpAtrMultiplier: 1.5 as any,
    s_maxHoldTicks: 30 as any,
    s_maxTradesPerSession: 50 as any,
    s_volumeSpikeThreshold: 1.5 as any,
    s_enableLong: true,
    s_enableShort: false,
  },
  ARBITRAGE: {
    s_totalInvestment: 10000 as any,
    s_positionSizePercent: 0.1 as any,
    s_minNetSpreadPercent: 0.15 as any,
    s_cooldownTicks: 3 as any,
    s_maxPositions: 1 as any,
  },
  REGIME: {
    s_totalInvestment: 10000 as any,
    s_trendThreshold: 25 as any,
    s_volatilityThreshold: 3 as any,
    s_minRegimeDurationTicks: 10 as any,
    s_trendStrategy: "TREND_FOLLOWING",
    s_rangeStrategy: "MEAN_REVERSION",
  },
  AI_SIGNAL: {
    s_totalInvestment: 5000 as any,
    s_positionSizePercent: 0.1 as any,
    s_signalSource: "STATIC",
    s_minConfidence: 0.6 as any,
    s_upProbabilityBuyThreshold: 0.65 as any,
  },
};

// ---------------------------------------------------------------------------
// Extract strategy config from form values for non-grid strategies
// ---------------------------------------------------------------------------

type FieldMapping = Record<string, string>;

const STRATEGY_FIELD_MAP: Record<Exclude<Strategy, "GRID">, FieldMapping> = {
  TREND_FOLLOWING: {
    s_totalInvestment: "totalInvestment",
    s_positionSizePercent: "positionSizePercent",
    s_fastPeriod: "fastPeriod",
    s_slowPeriod: "slowPeriod",
    s_adxThreshold: "adxThreshold",
    s_stopLossAtrMultiplier: "stopLossAtrMultiplier",
    s_takeProfitAtrMultiplier: "takeProfitAtrMultiplier",
    s_useMacdConfirmation: "useMacdConfirmation",
    s_maxPositions: "maxPositions",
    s_enableLong: "enableLong",
    s_enableShort: "enableShort",
  },
  MEAN_REVERSION: {
    s_totalInvestment: "totalInvestment",
    s_positionSizePercent: "positionSizePercent",
    s_rsiPeriod: "rsiPeriod",
    s_rsiOversold: "rsiOversold",
    s_rsiOverbought: "rsiOverbought",
    s_bbPeriod: "bbPeriod",
    s_bbStdDev: "bbStdDev",
    s_stopLossPercent: "stopLossPercent",
    s_exitMode: "exitMode",
    s_trendFilterEnabled: "trendFilterEnabled",
    s_enableLong: "enableLong",
    s_enableShort: "enableShort",
  },
  MARKET_MAKING: {
    s_totalInvestment: "totalInvestment",
    s_spreadPercent: "spreadPercent",
    s_dynamicSpreadEnabled: "dynamicSpreadEnabled",
    s_maxInventory: "maxInventory",
    s_inventorySkewFactor: "inventorySkewFactor",
    s_fairPriceSource: "fairPriceSource",
    s_maxVolatilityPause: "maxVolatilityPause",
  },
  DCA: {
    s_totalInvestment: "totalInvestment",
    s_buyAmountQuote: "buyAmountQuote",
    s_buyIntervalTicks: "buyIntervalTicks",
    s_dipBuyEnabled: "dipBuyEnabled",
    s_dipThresholdPercent: "dipThresholdPercent",
    s_dipMultiplier: "dipMultiplier",
    s_takeProfitPercent: "takeProfitPercent",
    s_safetyOrderEnabled: "safetyOrderEnabled",
    s_safetyOrderStepPercent: "safetyOrderStepPercent",
    s_safetyOrderMaxCount: "safetyOrderMaxCount",
  },
  SCALPING: {
    s_totalInvestment: "totalInvestment",
    s_positionSizePercent: "positionSizePercent",
    s_emaPeriod: "emaPeriod",
    s_atrPeriod: "atrPeriod",
    s_stopAtrMultiplier: "stopAtrMultiplier",
    s_tpAtrMultiplier: "tpAtrMultiplier",
    s_maxHoldTicks: "maxHoldTicks",
    s_maxTradesPerSession: "maxTradesPerSession",
    s_volumeSpikeThreshold: "volumeSpikeThreshold",
    s_enableLong: "enableLong",
    s_enableShort: "enableShort",
  },
  ARBITRAGE: {
    s_totalInvestment: "totalInvestment",
    s_positionSizePercent: "positionSizePercent",
    s_minNetSpreadPercent: "minNetSpreadPercent",
    s_cooldownTicks: "cooldownTicks",
    s_maxPositions: "maxPositions",
  },
  REGIME: {
    s_totalInvestment: "totalInvestment",
    s_trendThreshold: "trendThreshold",
    s_volatilityThreshold: "volatilityThreshold",
    s_minRegimeDurationTicks: "minRegimeDurationTicks",
    s_trendStrategy: "trendStrategy",
    s_rangeStrategy: "rangeStrategy",
  },
  AI_SIGNAL: {
    s_totalInvestment: "totalInvestment",
    s_positionSizePercent: "positionSizePercent",
    s_signalSource: "signalSource",
    s_httpEndpoint: "httpEndpoint",
    s_minConfidence: "minConfidence",
    s_upProbabilityBuyThreshold: "upProbabilityBuyThreshold",
  },
};

function extractStrategyConfig(strategy: Exclude<Strategy, "GRID">, values: FormValues): Record<string, unknown> {
  const fieldMap = STRATEGY_FIELD_MAP[strategy];
  const config: Record<string, unknown> = {};
  for (const [formKey, configKey] of Object.entries(fieldMap)) {
    const val = (values as any)[formKey];
    if (val !== undefined && val !== "" && val !== null) {
      config[configKey] = val;
    }
  }
  return config;
}

// ---------------------------------------------------------------------------
// Reverse: load strategyConfig back into form fields
// ---------------------------------------------------------------------------

function strategyConfigToFormValues(strategy: Exclude<Strategy, "GRID">, config: Record<string, unknown>): Partial<FormValues> {
  const fieldMap = STRATEGY_FIELD_MAP[strategy];
  const values: Record<string, unknown> = {};
  for (const [formKey, configKey] of Object.entries(fieldMap)) {
    if (config[configKey] !== undefined) {
      values[formKey] = config[configKey];
    }
  }
  return values as Partial<FormValues>;
}

// ---------------------------------------------------------------------------
// BotFormData (exported for pages)
// ---------------------------------------------------------------------------

export type BotFormData =
  | {
      name: string;
      strategy: "GRID";
      gridConfig: {
        upperPrice: number;
        lowerPrice: number;
        gridCount: number;
        gridType: "ARITHMETIC" | "GEOMETRIC";
        totalInvestment: number;
        amountPerGrid: number;
        takeProfitPrice?: number;
        stopLossPrice?: number;
        triggerPrice?: number;
        gridMode: "LONG" | "SHORT" | "NEUTRAL";
        orderType: "LIMIT" | "MARKET";
        trailingUp: boolean;
        trailingDown: boolean;
        stopLossAction: "CLOSE_ALL" | "STOP_ONLY";
        takeProfitAction: "CLOSE_ALL" | "STOP_ONLY";
        minProfitPerGrid?: number;
        maxOpenOrders?: number;
      };
    }
  | {
      name: string;
      strategy: Exclude<Strategy, "GRID">;
      strategyConfig: Record<string, unknown>;
    };

interface BotFormProps {
  defaultValues?: Partial<BotFormData & { strategyConfig?: Record<string, unknown> }>;
  onSubmit: (data: BotFormData) => Promise<void>;
  submitLabel: string;
}

// ---------------------------------------------------------------------------
// Helper components for each strategy section
// ---------------------------------------------------------------------------

type SectionProps = {
  form: UseFormReturn<FormValues>;
  fieldError: (name: keyof FormValues) => React.ReactNode;
};

function num(name: keyof FormValues, label: string, placeholder: string, props: SectionProps, step = "any") {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} type="number" step={step} placeholder={placeholder} {...props.form.register(name as any)} />
      {props.fieldError(name)}
    </div>
  );
}

function toggle(name: keyof FormValues, label: string, description: string, props: SectionProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="space-y-0.5">
        <Label htmlFor={name}>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={name}
        checked={props.form.watch(name as any) ?? false}
        onCheckedChange={(v) => props.form.setValue(name as any, v)}
      />
    </div>
  );
}

// --- Grid Section (unchanged from original) ---
function GridConfigSection(props: SectionProps) {
  const { form, fieldError } = props;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Grid Configuration</CardTitle>
          <CardDescription>Define the price range and grid parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {num("upperPrice", "Upper Price", "50000", props)}
            {num("lowerPrice", "Lower Price", "40000", props)}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {num("gridCount", "Number of Grids", "10", props, "1")}
            <div className="space-y-2">
              <Label htmlFor="gridType">Grid Type</Label>
              <Select value={form.watch("gridType")} onValueChange={(v) => form.setValue("gridType", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARITHMETIC">Arithmetic</SelectItem>
                  <SelectItem value="GEOMETRIC">Geometric</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gridMode">Grid Mode</Label>
              <Select value={form.watch("gridMode")} onValueChange={(v) => form.setValue("gridMode", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEUTRAL">Neutral</SelectItem>
                  <SelectItem value="LONG">Long</SelectItem>
                  <SelectItem value="SHORT">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {num("totalInvestment", "Total Investment", "1000", props)}
            {num("amountPerGrid", "Amount Per Grid", "100", props)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk Management</CardTitle>
          <CardDescription>Configure take profit, stop loss, and exit behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {num("takeProfitPrice", "Take Profit Price (optional)", "55000", props)}
            <div className="space-y-2">
              <Label>On Take Profit</Label>
              <Select value={form.watch("takeProfitAction")} onValueChange={(v) => form.setValue("takeProfitAction", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STOP_ONLY">Stop Bot Only</SelectItem>
                  <SelectItem value="CLOSE_ALL">Close All Positions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {num("stopLossPrice", "Stop Loss Price (optional)", "38000", props)}
            <div className="space-y-2">
              <Label>On Stop Loss</Label>
              <Select value={form.watch("stopLossAction")} onValueChange={(v) => form.setValue("stopLossAction", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STOP_ONLY">Stop Bot Only</SelectItem>
                  <SelectItem value="CLOSE_ALL">Close All Positions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advanced Settings</CardTitle>
          <CardDescription>Fine-tune execution behavior and trailing options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Order Type</Label>
              <Select value={form.watch("orderType")} onValueChange={(v) => form.setValue("orderType", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LIMIT">Limit</SelectItem>
                  <SelectItem value="MARKET">Market</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {num("triggerPrice", "Trigger Price (optional)", "45000", props)}
            {num("minProfitPerGrid", "Min Profit Per Grid % (optional)", "0.5", props)}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {num("maxOpenOrders", "Max Open Orders (optional)", "20", props, "1")}
          </div>
          <Separator />
          <div className="space-y-4">
            {toggle("trailingUp", "Trailing Up", "Automatically extend the grid upward when price breaks above the upper bound", props)}
            {toggle("trailingDown", "Trailing Down", "Automatically extend the grid downward when price breaks below the lower bound", props)}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// --- Trend Following ---
function TrendFollowingSection(props: SectionProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Trend Following Configuration</CardTitle>
          <CardDescription>EMA crossover with ADX trend filter and ATR-based stops</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {num("s_totalInvestment", "Total Investment", "10000", props)}
            {num("s_positionSizePercent", "Position Size (0-1)", "0.1", props)}
          </div>
          <Separator />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {num("s_fastPeriod", "Fast EMA Period", "9", props, "1")}
            {num("s_slowPeriod", "Slow EMA Period", "21", props, "1")}
            {num("s_adxThreshold", "ADX Threshold", "25", props)}
          </div>
          <Separator />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {num("s_stopLossAtrMultiplier", "Stop Loss (ATR x)", "2", props)}
            {num("s_takeProfitAtrMultiplier", "Take Profit (ATR x)", "3", props)}
            {num("s_maxPositions", "Max Positions", "3", props, "1")}
          </div>
          <Separator />
          <div className="space-y-4">
            {toggle("s_useMacdConfirmation", "MACD Confirmation", "Require MACD histogram confirmation before entry", props)}
            {toggle("s_enableLong", "Enable Long", "Allow long (buy) entries", props)}
            {toggle("s_enableShort", "Enable Short", "Allow short (sell) entries", props)}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// --- Mean Reversion ---
function MeanReversionSection(props: SectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mean Reversion Configuration</CardTitle>
        <CardDescription>RSI + Bollinger Bands for oversold/overbought detection</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {num("s_totalInvestment", "Total Investment", "10000", props)}
          {num("s_positionSizePercent", "Position Size (0-1)", "0.1", props)}
        </div>
        <Separator />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {num("s_rsiPeriod", "RSI Period", "14", props, "1")}
          {num("s_rsiOversold", "RSI Oversold", "30", props)}
          {num("s_rsiOverbought", "RSI Overbought", "70", props)}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {num("s_bbPeriod", "Bollinger Period", "20", props, "1")}
          {num("s_bbStdDev", "Bollinger Std Dev", "2", props)}
          {num("s_stopLossPercent", "Stop Loss %", "3", props)}
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>Exit Mode</Label>
          <Select value={props.form.watch("s_exitMode")} onValueChange={(v) => props.form.setValue("s_exitMode", v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MEAN_REVERSION">Mean Reversion (back to mean)</SelectItem>
              <SelectItem value="FIXED_TARGET">Fixed Target %</SelectItem>
              <SelectItem value="BOTH">Both (whichever first)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-4">
          {toggle("s_trendFilterEnabled", "Trend Filter", "Only enter when price is aligned with the longer-term EMA trend", props)}
          {toggle("s_enableLong", "Enable Long", "Allow long (buy) entries", props)}
          {toggle("s_enableShort", "Enable Short", "Allow short (sell) entries", props)}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Market Making ---
function MarketMakingSection(props: SectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Making Configuration</CardTitle>
        <CardDescription>Spread capture with inventory-aware skewing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {num("s_totalInvestment", "Total Investment", "10000", props)}
          {num("s_spreadPercent", "Spread %", "0.3", props)}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {num("s_maxInventory", "Max Inventory", "10", props)}
          {num("s_inventorySkewFactor", "Inventory Skew (0-1)", "0.5", props)}
          {num("s_maxVolatilityPause", "Volatility Pause ATR x", "5", props)}
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>Fair Price Source</Label>
          <Select value={props.form.watch("s_fairPriceSource")} onValueChange={(v) => props.form.setValue("s_fairPriceSource", v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EMA">EMA</SelectItem>
              <SelectItem value="VWAP">VWAP</SelectItem>
              <SelectItem value="MID">Mid Price</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {toggle("s_dynamicSpreadEnabled", "Dynamic Spread", "Automatically widen spread based on ATR volatility", props)}
      </CardContent>
    </Card>
  );
}

// --- DCA ---
function DCASection(props: SectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>DCA Configuration</CardTitle>
        <CardDescription>Dollar cost averaging with dip-buying and safety orders</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {num("s_totalInvestment", "Total Budget", "5000", props)}
          {num("s_buyAmountQuote", "Buy Amount (USDT)", "100", props)}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {num("s_buyIntervalTicks", "Buy Interval (ticks)", "60", props, "1")}
          {num("s_takeProfitPercent", "Take Profit % (optional)", "20", props)}
        </div>
        <Separator />
        <div className="space-y-4">
          {toggle("s_dipBuyEnabled", "Dip Buying", "Buy extra when price drops significantly", props)}
        </div>
        {props.form.watch("s_dipBuyEnabled") && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {num("s_dipThresholdPercent", "Dip Threshold %", "5", props)}
            {num("s_dipMultiplier", "Dip Buy Multiplier", "2", props)}
          </div>
        )}
        <Separator />
        <div className="space-y-4">
          {toggle("s_safetyOrderEnabled", "Safety Orders", "Place additional buy orders when price drops after entry", props)}
        </div>
        {props.form.watch("s_safetyOrderEnabled") && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {num("s_safetyOrderStepPercent", "Step Down %", "2", props)}
            {num("s_safetyOrderMaxCount", "Max Safety Orders", "5", props, "1")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Scalping ---
function ScalpingSection(props: SectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scalping Configuration</CardTitle>
        <CardDescription>Micro-move capture with ATR-based stops and take profits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {num("s_totalInvestment", "Total Investment", "5000", props)}
          {num("s_positionSizePercent", "Position Size (0-1)", "0.15", props)}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {num("s_emaPeriod", "EMA Period", "5", props, "1")}
          {num("s_atrPeriod", "ATR Period", "10", props, "1")}
          {num("s_volumeSpikeThreshold", "Volume Spike x", "1.5", props)}
        </div>
        <Separator />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {num("s_stopAtrMultiplier", "Stop Loss (ATR x)", "1", props)}
          {num("s_tpAtrMultiplier", "Take Profit (ATR x)", "1.5", props)}
          {num("s_maxHoldTicks", "Max Hold (ticks)", "30", props, "1")}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {num("s_maxTradesPerSession", "Max Trades/Session", "50", props, "1")}
        </div>
        <Separator />
        <div className="space-y-4">
          {toggle("s_enableLong", "Enable Long", "Allow long (buy) entries", props)}
          {toggle("s_enableShort", "Enable Short", "Allow short (sell) entries", props)}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Arbitrage ---
function ArbitrageSection(props: SectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Arbitrage Configuration</CardTitle>
        <CardDescription>Cross-exchange spread detection (single-exchange scaffolded)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {num("s_totalInvestment", "Total Investment", "10000", props)}
          {num("s_positionSizePercent", "Position Size (0-1)", "0.1", props)}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {num("s_minNetSpreadPercent", "Min Net Spread %", "0.15", props)}
          {num("s_cooldownTicks", "Cooldown (ticks)", "3", props, "1")}
          {num("s_maxPositions", "Max Positions", "1", props, "1")}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Regime Switching ---
function RegimeSection(props: SectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Regime Switching Configuration</CardTitle>
        <CardDescription>Auto-switches between trend and mean-reversion strategies based on market regime</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {num("s_totalInvestment", "Total Investment", "10000", props)}
        <Separator />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {num("s_trendThreshold", "Trend ADX Threshold", "25", props)}
          {num("s_volatilityThreshold", "Volatility ATR Threshold", "3", props)}
          {num("s_minRegimeDurationTicks", "Min Regime Duration (ticks)", "10", props, "1")}
        </div>
        <Separator />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Trend Strategy</Label>
            <Select value={props.form.watch("s_trendStrategy")} onValueChange={(v) => props.form.setValue("s_trendStrategy", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TREND_FOLLOWING">Trend Following</SelectItem>
                <SelectItem value="SCALPING">Scalping</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Range Strategy</Label>
            <Select value={props.form.watch("s_rangeStrategy")} onValueChange={(v) => props.form.setValue("s_rangeStrategy", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MEAN_REVERSION">Mean Reversion</SelectItem>
                <SelectItem value="MARKET_MAKING">Market Making</SelectItem>
                <SelectItem value="DCA">DCA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- AI/ML Signal ---
function AISignalSection(props: SectionProps) {
  const signalSource = props.form.watch("s_signalSource");
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI/ML Signal Configuration</CardTitle>
        <CardDescription>Pluggable external signal interface</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {num("s_totalInvestment", "Total Investment", "5000", props)}
          {num("s_positionSizePercent", "Position Size (0-1)", "0.1", props)}
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>Signal Source</Label>
          <Select value={signalSource} onValueChange={(v) => props.form.setValue("s_signalSource", v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="STATIC">Static (for testing)</SelectItem>
              <SelectItem value="HTTP">HTTP Endpoint</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {signalSource === "HTTP" && (
          <div className="space-y-2">
            <Label htmlFor="s_httpEndpoint">HTTP Endpoint URL</Label>
            <Input id="s_httpEndpoint" placeholder="https://api.example.com/signal" {...props.form.register("s_httpEndpoint")} />
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {num("s_minConfidence", "Min Confidence (0-1)", "0.6", props)}
          {num("s_upProbabilityBuyThreshold", "Buy Threshold (0-1)", "0.65", props)}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main BotForm
// ---------------------------------------------------------------------------

export function BotForm({ defaultValues, onSubmit, submitLabel }: BotFormProps) {
  const initialStrategy: Strategy = (defaultValues?.strategy as Strategy) ?? "GRID";

  const getInitialValues = (): Partial<FormValues> => {
    const base: Partial<FormValues> = {
      name: defaultValues?.name ?? "",
      strategy: initialStrategy,
      ...STRATEGY_DEFAULTS[initialStrategy],
    };

    if (initialStrategy === "GRID" && defaultValues && "gridConfig" in defaultValues && defaultValues.gridConfig) {
      const gc = defaultValues.gridConfig;
      return {
        ...base,
        upperPrice: gc.upperPrice as any,
        lowerPrice: gc.lowerPrice as any,
        gridCount: gc.gridCount as any,
        gridType: gc.gridType,
        totalInvestment: gc.totalInvestment as any,
        amountPerGrid: gc.amountPerGrid as any,
        takeProfitPrice: gc.takeProfitPrice ?? ("" as any),
        stopLossPrice: gc.stopLossPrice ?? ("" as any),
        triggerPrice: gc.triggerPrice ?? ("" as any),
        gridMode: gc.gridMode,
        orderType: gc.orderType,
        trailingUp: gc.trailingUp,
        trailingDown: gc.trailingDown,
        stopLossAction: gc.stopLossAction,
        takeProfitAction: gc.takeProfitAction,
        minProfitPerGrid: gc.minProfitPerGrid ?? ("" as any),
        maxOpenOrders: gc.maxOpenOrders ?? ("" as any),
      };
    }

    if (initialStrategy !== "GRID" && defaultValues && "strategyConfig" in defaultValues && defaultValues.strategyConfig) {
      const loaded = strategyConfigToFormValues(initialStrategy, defaultValues.strategyConfig as Record<string, unknown>);
      return { ...base, ...loaded };
    }

    return base;
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getInitialValues() as any,
  });

  const strategy = form.watch("strategy");

  const handleStrategyChange = (newStrategy: Strategy) => {
    const name = form.getValues("name");
    form.reset({
      name,
      strategy: newStrategy,
      ...STRATEGY_DEFAULTS[newStrategy],
    } as any);
  };

  const handleSubmit = async (values: FormValues) => {
    if (values.strategy === "GRID") {
      // Validate required grid fields
      let hasError = false;
      if (!values.upperPrice || values.upperPrice === ("" as any)) {
        form.setError("upperPrice", { message: "Required" });
        hasError = true;
      }
      if (!values.lowerPrice || values.lowerPrice === ("" as any)) {
        form.setError("lowerPrice", { message: "Required" });
        hasError = true;
      }
      if (!values.gridCount || values.gridCount === ("" as any)) {
        form.setError("gridCount", { message: "Required" });
        hasError = true;
      }
      if (!values.totalInvestment || values.totalInvestment === ("" as any)) {
        form.setError("totalInvestment", { message: "Required" });
        hasError = true;
      }
      if (!values.amountPerGrid || values.amountPerGrid === ("" as any)) {
        form.setError("amountPerGrid", { message: "Required" });
        hasError = true;
      }
      if (hasError) return;

      if ((values.upperPrice as number) <= (values.lowerPrice as number)) {
        form.setError("upperPrice", { message: "Upper price must be greater than lower price" });
        return;
      }

      const data: BotFormData = {
        name: values.name,
        strategy: "GRID",
        gridConfig: {
          upperPrice: values.upperPrice as number,
          lowerPrice: values.lowerPrice as number,
          gridCount: values.gridCount as number,
          gridType: values.gridType ?? "ARITHMETIC",
          totalInvestment: values.totalInvestment as number,
          amountPerGrid: values.amountPerGrid as number,
          gridMode: values.gridMode ?? "NEUTRAL",
          orderType: values.orderType ?? "LIMIT",
          trailingUp: values.trailingUp ?? false,
          trailingDown: values.trailingDown ?? false,
          stopLossAction: values.stopLossAction ?? "STOP_ONLY",
          takeProfitAction: values.takeProfitAction ?? "STOP_ONLY",
          ...(values.takeProfitPrice && typeof values.takeProfitPrice === "number" ? { takeProfitPrice: values.takeProfitPrice } : {}),
          ...(values.stopLossPrice && typeof values.stopLossPrice === "number" ? { stopLossPrice: values.stopLossPrice } : {}),
          ...(values.triggerPrice && typeof values.triggerPrice === "number" ? { triggerPrice: values.triggerPrice } : {}),
          ...(values.minProfitPerGrid && typeof values.minProfitPerGrid === "number" ? { minProfitPerGrid: values.minProfitPerGrid } : {}),
          ...(values.maxOpenOrders && typeof values.maxOpenOrders === "number" ? { maxOpenOrders: values.maxOpenOrders } : {}),
        },
      };
      await onSubmit(data);
    } else {
      // Validate required totalInvestment for non-grid
      if (!values.s_totalInvestment || values.s_totalInvestment === ("" as any)) {
        form.setError("s_totalInvestment", { message: "Required" });
        return;
      }

      const strategyConfig = extractStrategyConfig(values.strategy as Exclude<Strategy, "GRID">, values);
      await onSubmit({
        name: values.name,
        strategy: values.strategy as Exclude<Strategy, "GRID">,
        strategyConfig,
      });
    }
  };

  const fieldError = (name: keyof FormValues) => {
    const err = form.formState.errors[name];
    return err ? <p className="text-sm text-destructive">{err.message as string}</p> : null;
  };

  const sectionProps: SectionProps = { form, fieldError };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Bot Name</Label>
            <Input id="name" placeholder="My Trading Bot" {...form.register("name")} />
            {fieldError("name")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="strategy">Strategy</Label>
            <Select
              value={strategy}
              onValueChange={(v) => handleStrategyChange(v as Strategy)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select strategy" />
              </SelectTrigger>
              <SelectContent>
                {ALL_STRATEGIES.map((s) => (
                  <SelectItem key={s} value={s}>{STRATEGY_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{STRATEGY_DESCRIPTIONS[strategy]}</p>
            {fieldError("strategy")}
          </div>
        </CardContent>
      </Card>

      {/* Strategy-specific sections */}
      {strategy === "GRID" && <GridConfigSection {...sectionProps} />}
      {strategy === "TREND_FOLLOWING" && <TrendFollowingSection {...sectionProps} />}
      {strategy === "MEAN_REVERSION" && <MeanReversionSection {...sectionProps} />}
      {strategy === "MARKET_MAKING" && <MarketMakingSection {...sectionProps} />}
      {strategy === "DCA" && <DCASection {...sectionProps} />}
      {strategy === "SCALPING" && <ScalpingSection {...sectionProps} />}
      {strategy === "ARBITRAGE" && <ArbitrageSection {...sectionProps} />}
      {strategy === "REGIME" && <RegimeSection {...sectionProps} />}
      {strategy === "AI_SIGNAL" && <AISignalSection {...sectionProps} />}

      <div className="flex justify-end">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
