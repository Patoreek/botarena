"use client";

import { useForm } from "react-hook-form";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const formSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    strategy: z.enum(["GRID"]),
    exchange: z.string().min(1, "Exchange is required").max(50),
    tradingPair: z.string().min(1, "Trading pair is required").max(20),
    upperPrice: z.coerce.number().positive("Must be positive"),
    lowerPrice: z.coerce.number().positive("Must be positive"),
    gridCount: z.coerce.number().int().min(2, "Min 2 grids").max(500, "Max 500 grids"),
    gridType: z.enum(["ARITHMETIC", "GEOMETRIC"]),
    totalInvestment: z.coerce.number().positive("Must be positive"),
    amountPerGrid: z.coerce.number().positive("Must be positive"),
    takeProfitPrice: z.coerce.number().positive().optional().or(z.literal("")),
    stopLossPrice: z.coerce.number().positive().optional().or(z.literal("")),
  })
  .refine((d) => d.upperPrice > d.lowerPrice, {
    message: "Upper price must be greater than lower price",
    path: ["upperPrice"],
  });

type FormValues = z.infer<typeof formSchema>;

export interface BotFormData {
  name: string;
  strategy: "GRID";
  exchange: string;
  tradingPair: string;
  gridConfig: {
    upperPrice: number;
    lowerPrice: number;
    gridCount: number;
    gridType: "ARITHMETIC" | "GEOMETRIC";
    totalInvestment: number;
    amountPerGrid: number;
    takeProfitPrice?: number;
    stopLossPrice?: number;
  };
}

interface BotFormProps {
  defaultValues?: Partial<BotFormData>;
  onSubmit: (data: BotFormData) => Promise<void>;
  submitLabel: string;
}

const EXCHANGES = ["Binance", "Coinbase", "Kraken", "Bybit", "OKX", "KuCoin"];

export function BotForm({ defaultValues, onSubmit, submitLabel }: BotFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      strategy: defaultValues?.strategy ?? "GRID",
      exchange: defaultValues?.exchange ?? "",
      tradingPair: defaultValues?.tradingPair ?? "",
      upperPrice: defaultValues?.gridConfig?.upperPrice ?? (undefined as unknown as number),
      lowerPrice: defaultValues?.gridConfig?.lowerPrice ?? (undefined as unknown as number),
      gridCount: defaultValues?.gridConfig?.gridCount ?? (undefined as unknown as number),
      gridType: defaultValues?.gridConfig?.gridType ?? "ARITHMETIC",
      totalInvestment: defaultValues?.gridConfig?.totalInvestment ?? (undefined as unknown as number),
      amountPerGrid: defaultValues?.gridConfig?.amountPerGrid ?? (undefined as unknown as number),
      takeProfitPrice: defaultValues?.gridConfig?.takeProfitPrice ?? "",
      stopLossPrice: defaultValues?.gridConfig?.stopLossPrice ?? "",
    },
  });

  const strategy = form.watch("strategy");

  const handleSubmit = async (values: FormValues) => {
    const data: BotFormData = {
      name: values.name,
      strategy: values.strategy,
      exchange: values.exchange,
      tradingPair: values.tradingPair,
      gridConfig: {
        upperPrice: values.upperPrice,
        lowerPrice: values.lowerPrice,
        gridCount: values.gridCount,
        gridType: values.gridType,
        totalInvestment: values.totalInvestment,
        amountPerGrid: values.amountPerGrid,
        ...(values.takeProfitPrice && typeof values.takeProfitPrice === "number"
          ? { takeProfitPrice: values.takeProfitPrice }
          : {}),
        ...(values.stopLossPrice && typeof values.stopLossPrice === "number"
          ? { stopLossPrice: values.stopLossPrice }
          : {}),
      },
    };
    await onSubmit(data);
  };

  const fieldError = (name: keyof FormValues) => {
    const err = form.formState.errors[name];
    return err ? <p className="text-sm text-destructive">{err.message as string}</p> : null;
  };

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
            <Input id="name" placeholder="My Grid Bot" {...form.register("name")} />
            {fieldError("name")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="strategy">Strategy</Label>
            <Select
              value={form.watch("strategy")}
              onValueChange={(v) => form.setValue("strategy", v as "GRID")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GRID">Grid Trading</SelectItem>
              </SelectContent>
            </Select>
            {fieldError("strategy")}
          </div>
        </CardContent>
      </Card>

      {/* Grid Strategy Config */}
      {strategy === "GRID" && (
        <Card>
          <CardHeader>
            <CardTitle>Grid Strategy Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="exchange">Exchange</Label>
                <Select
                  value={form.watch("exchange")}
                  onValueChange={(v) => form.setValue("exchange", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select exchange" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXCHANGES.map((ex) => (
                      <SelectItem key={ex} value={ex}>
                        {ex}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldError("exchange")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="tradingPair">Trading Pair</Label>
                <Input id="tradingPair" placeholder="BTC/USDT" {...form.register("tradingPair")} />
                {fieldError("tradingPair")}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="upperPrice">Upper Price</Label>
                <Input
                  id="upperPrice"
                  type="number"
                  step="any"
                  placeholder="50000"
                  {...form.register("upperPrice")}
                />
                {fieldError("upperPrice")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lowerPrice">Lower Price</Label>
                <Input
                  id="lowerPrice"
                  type="number"
                  step="any"
                  placeholder="40000"
                  {...form.register("lowerPrice")}
                />
                {fieldError("lowerPrice")}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gridCount">Number of Grids</Label>
                <Input
                  id="gridCount"
                  type="number"
                  placeholder="10"
                  {...form.register("gridCount")}
                />
                {fieldError("gridCount")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="gridType">Grid Type</Label>
                <Select
                  value={form.watch("gridType")}
                  onValueChange={(v) => form.setValue("gridType", v as "ARITHMETIC" | "GEOMETRIC")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARITHMETIC">Arithmetic</SelectItem>
                    <SelectItem value="GEOMETRIC">Geometric</SelectItem>
                  </SelectContent>
                </Select>
                {fieldError("gridType")}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="totalInvestment">Total Investment</Label>
                <Input
                  id="totalInvestment"
                  type="number"
                  step="any"
                  placeholder="1000"
                  {...form.register("totalInvestment")}
                />
                {fieldError("totalInvestment")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="amountPerGrid">Amount Per Grid</Label>
                <Input
                  id="amountPerGrid"
                  type="number"
                  step="any"
                  placeholder="100"
                  {...form.register("amountPerGrid")}
                />
                {fieldError("amountPerGrid")}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="takeProfitPrice">Take Profit Price (optional)</Label>
                <Input
                  id="takeProfitPrice"
                  type="number"
                  step="any"
                  placeholder="55000"
                  {...form.register("takeProfitPrice")}
                />
                {fieldError("takeProfitPrice")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="stopLossPrice">Stop Loss Price (optional)</Label>
                <Input
                  id="stopLossPrice"
                  type="number"
                  step="any"
                  placeholder="38000"
                  {...form.register("stopLossPrice")}
                />
                {fieldError("stopLossPrice")}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
