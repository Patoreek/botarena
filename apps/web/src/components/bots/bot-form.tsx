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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const formSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    strategy: z.enum(["GRID"]),
    upperPrice: z.coerce.number().positive("Must be positive"),
    lowerPrice: z.coerce.number().positive("Must be positive"),
    gridCount: z.coerce.number().int().min(2, "Min 2 grids").max(500, "Max 500 grids"),
    gridType: z.enum(["ARITHMETIC", "GEOMETRIC"]),
    totalInvestment: z.coerce.number().positive("Must be positive"),
    amountPerGrid: z.coerce.number().positive("Must be positive"),
    takeProfitPrice: z.coerce.number().positive().optional().or(z.literal("")),
    stopLossPrice: z.coerce.number().positive().optional().or(z.literal("")),
    triggerPrice: z.coerce.number().positive().optional().or(z.literal("")),
    gridMode: z.enum(["LONG", "SHORT", "NEUTRAL"]),
    orderType: z.enum(["LIMIT", "MARKET"]),
    trailingUp: z.boolean(),
    trailingDown: z.boolean(),
    stopLossAction: z.enum(["CLOSE_ALL", "STOP_ONLY"]),
    takeProfitAction: z.enum(["CLOSE_ALL", "STOP_ONLY"]),
    minProfitPerGrid: z.coerce.number().positive().optional().or(z.literal("")),
    maxOpenOrders: z.coerce.number().int().min(1).optional().or(z.literal("")),
  })
  .refine((d) => d.upperPrice > d.lowerPrice, {
    message: "Upper price must be greater than lower price",
    path: ["upperPrice"],
  });

type FormValues = z.infer<typeof formSchema>;

export interface BotFormData {
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

interface BotFormProps {
  defaultValues?: Partial<BotFormData>;
  onSubmit: (data: BotFormData) => Promise<void>;
  submitLabel: string;
}

export function BotForm({ defaultValues, onSubmit, submitLabel }: BotFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      strategy: defaultValues?.strategy ?? "GRID",
      upperPrice: defaultValues?.gridConfig?.upperPrice ?? (undefined as unknown as number),
      lowerPrice: defaultValues?.gridConfig?.lowerPrice ?? (undefined as unknown as number),
      gridCount: defaultValues?.gridConfig?.gridCount ?? (undefined as unknown as number),
      gridType: defaultValues?.gridConfig?.gridType ?? "ARITHMETIC",
      totalInvestment: defaultValues?.gridConfig?.totalInvestment ?? (undefined as unknown as number),
      amountPerGrid: defaultValues?.gridConfig?.amountPerGrid ?? (undefined as unknown as number),
      takeProfitPrice: defaultValues?.gridConfig?.takeProfitPrice ?? "",
      stopLossPrice: defaultValues?.gridConfig?.stopLossPrice ?? "",
      triggerPrice: defaultValues?.gridConfig?.triggerPrice ?? "",
      gridMode: defaultValues?.gridConfig?.gridMode ?? "NEUTRAL",
      orderType: defaultValues?.gridConfig?.orderType ?? "LIMIT",
      trailingUp: defaultValues?.gridConfig?.trailingUp ?? false,
      trailingDown: defaultValues?.gridConfig?.trailingDown ?? false,
      stopLossAction: defaultValues?.gridConfig?.stopLossAction ?? "STOP_ONLY",
      takeProfitAction: defaultValues?.gridConfig?.takeProfitAction ?? "STOP_ONLY",
      minProfitPerGrid: defaultValues?.gridConfig?.minProfitPerGrid ?? "",
      maxOpenOrders: defaultValues?.gridConfig?.maxOpenOrders ?? "",
    },
  });

  const strategy = form.watch("strategy");

  const handleSubmit = async (values: FormValues) => {
    const data: BotFormData = {
      name: values.name,
      strategy: values.strategy,
      gridConfig: {
        upperPrice: values.upperPrice,
        lowerPrice: values.lowerPrice,
        gridCount: values.gridCount,
        gridType: values.gridType,
        totalInvestment: values.totalInvestment,
        amountPerGrid: values.amountPerGrid,
        gridMode: values.gridMode,
        orderType: values.orderType,
        trailingUp: values.trailingUp,
        trailingDown: values.trailingDown,
        stopLossAction: values.stopLossAction,
        takeProfitAction: values.takeProfitAction,
        ...(values.takeProfitPrice && typeof values.takeProfitPrice === "number"
          ? { takeProfitPrice: values.takeProfitPrice }
          : {}),
        ...(values.stopLossPrice && typeof values.stopLossPrice === "number"
          ? { stopLossPrice: values.stopLossPrice }
          : {}),
        ...(values.triggerPrice && typeof values.triggerPrice === "number"
          ? { triggerPrice: values.triggerPrice }
          : {}),
        ...(values.minProfitPerGrid && typeof values.minProfitPerGrid === "number"
          ? { minProfitPerGrid: values.minProfitPerGrid }
          : {}),
        ...(values.maxOpenOrders && typeof values.maxOpenOrders === "number"
          ? { maxOpenOrders: values.maxOpenOrders }
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
        <>
          <Card>
            <CardHeader>
              <CardTitle>Grid Configuration</CardTitle>
              <CardDescription>Define the price range and grid parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                <div className="space-y-2">
                  <Label htmlFor="gridMode">Grid Mode</Label>
                  <Select
                    value={form.watch("gridMode")}
                    onValueChange={(v) => form.setValue("gridMode", v as "LONG" | "SHORT" | "NEUTRAL")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEUTRAL">Neutral</SelectItem>
                      <SelectItem value="LONG">Long</SelectItem>
                      <SelectItem value="SHORT">Short</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldError("gridMode")}
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk Management</CardTitle>
              <CardDescription>Configure take profit, stop loss, and exit behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <Label htmlFor="takeProfitAction">On Take Profit</Label>
                  <Select
                    value={form.watch("takeProfitAction")}
                    onValueChange={(v) => form.setValue("takeProfitAction", v as "CLOSE_ALL" | "STOP_ONLY")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STOP_ONLY">Stop Bot Only</SelectItem>
                      <SelectItem value="CLOSE_ALL">Close All Positions</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldError("takeProfitAction")}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <div className="space-y-2">
                  <Label htmlFor="stopLossAction">On Stop Loss</Label>
                  <Select
                    value={form.watch("stopLossAction")}
                    onValueChange={(v) => form.setValue("stopLossAction", v as "CLOSE_ALL" | "STOP_ONLY")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STOP_ONLY">Stop Bot Only</SelectItem>
                      <SelectItem value="CLOSE_ALL">Close All Positions</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldError("stopLossAction")}
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
                  <Label htmlFor="orderType">Order Type</Label>
                  <Select
                    value={form.watch("orderType")}
                    onValueChange={(v) => form.setValue("orderType", v as "LIMIT" | "MARKET")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LIMIT">Limit</SelectItem>
                      <SelectItem value="MARKET">Market</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldError("orderType")}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="triggerPrice">Trigger Price (optional)</Label>
                  <Input
                    id="triggerPrice"
                    type="number"
                    step="any"
                    placeholder="45000"
                    {...form.register("triggerPrice")}
                  />
                  {fieldError("triggerPrice")}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minProfitPerGrid">Min Profit Per Grid % (optional)</Label>
                  <Input
                    id="minProfitPerGrid"
                    type="number"
                    step="any"
                    placeholder="0.5"
                    {...form.register("minProfitPerGrid")}
                  />
                  {fieldError("minProfitPerGrid")}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="maxOpenOrders">Max Open Orders (optional)</Label>
                  <Input
                    id="maxOpenOrders"
                    type="number"
                    placeholder="20"
                    {...form.register("maxOpenOrders")}
                  />
                  {fieldError("maxOpenOrders")}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="trailingUp">Trailing Up</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically extend the grid upward when price breaks above the upper bound
                    </p>
                  </div>
                  <Switch
                    id="trailingUp"
                    checked={form.watch("trailingUp")}
                    onCheckedChange={(v) => form.setValue("trailingUp", v)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="trailingDown">Trailing Down</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically extend the grid downward when price breaks below the lower bound
                    </p>
                  </div>
                  <Switch
                    id="trailingDown"
                    checked={form.watch("trailingDown")}
                    onCheckedChange={(v) => form.setValue("trailingDown", v)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
