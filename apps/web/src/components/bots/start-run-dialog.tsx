"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { useApiKeys } from "@/hooks/use-api-keys";
import {
  INTERVAL_LABELS,
  DURATION_OPTIONS,
  DURATION_LABELS,
  TOP_MARKET_PAIRS,
  type RunInterval,
  type ApiProvider,
  type RunResponse,
} from "@repo/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

const EXCHANGE_PROVIDERS: { value: ApiProvider; label: string }[] = [
  { value: "BINANCE", label: "Binance" },
];

const INTERVALS: { value: RunInterval; label: string }[] = Object.entries(INTERVAL_LABELS).map(
  ([value, label]) => ({ value: value as RunInterval, label })
);

interface StartRunDialogProps {
  botId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function StartRunDialog({ botId, open, onOpenChange, onCreated }: StartRunDialogProps) {
  const { accessToken } = useAuth();
  const { keys, loading: keysLoading } = useApiKeys();
  const [exchange, setExchange] = useState<string>("");
  const [pairMode, setPairMode] = useState<"preset" | "custom">("preset");
  const [selectedPair, setSelectedPair] = useState<string>("");
  const [customPair, setCustomPair] = useState("");
  const [interval, setInterval] = useState<string>("ONE_MINUTE");
  const [durationHours, setDurationHours] = useState<string>("1");
  const [submitting, setSubmitting] = useState(false);

  const exchangeKeys = keys.filter((k) =>
    EXCHANGE_PROVIDERS.some((e) => e.value === k.provider)
  );

  const handleSubmit = async () => {
    if (!accessToken) return;
    const marketPair = pairMode === "custom" ? customPair.trim() : selectedPair;
    if (!exchange || !marketPair || !interval) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch<RunResponse>(`/bots/${botId}/runs`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ exchange, marketPair, interval, durationHours: Number(durationHours) }),
      });
      toast.success("Run started");
      onOpenChange(false);
      resetForm();
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start run");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setExchange("");
    setPairMode("preset");
    setSelectedPair("");
    setCustomPair("");
    setInterval("ONE_MINUTE");
    setDurationHours("1");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start New Run</DialogTitle>
          <DialogDescription>
            Configure the exchange, market pair, and trading interval for this run.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Exchange */}
          <div className="space-y-2">
            <Label>Exchange</Label>
            {keysLoading ? (
              <div className="h-10 animate-pulse rounded-md bg-muted" />
            ) : exchangeKeys.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                No exchange integrations found.{" "}
                <Link href="/settings/integrations" className="text-primary underline">
                  Add one in Settings
                </Link>{" "}
                to start a run.
              </div>
            ) : (
              <Select value={exchange} onValueChange={setExchange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select exchange" />
                </SelectTrigger>
                <SelectContent>
                  {exchangeKeys.map((k) => (
                    <SelectItem key={k.provider} value={k.provider}>
                      {EXCHANGE_PROVIDERS.find((e) => e.value === k.provider)?.label ?? k.provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Separator />

          {/* Market Pair */}
          <div className="space-y-2">
            <Label>Market Pair</Label>
            <Select value={pairMode} onValueChange={(v) => setPairMode(v as "preset" | "custom")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preset">Popular Pairs</SelectItem>
                <SelectItem value="custom">Custom Pair</SelectItem>
              </SelectContent>
            </Select>

            {pairMode === "preset" ? (
              <Select value={selectedPair} onValueChange={setSelectedPair}>
                <SelectTrigger>
                  <SelectValue placeholder="Select market pair" />
                </SelectTrigger>
                <SelectContent>
                  {TOP_MARKET_PAIRS.map((pair) => (
                    <SelectItem key={pair} value={pair}>
                      {pair}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={customPair}
                onChange={(e) => setCustomPair(e.target.value)}
                placeholder="e.g. BTCUSDT or BTC/USDT"
              />
            )}
          </div>

          <Separator />

          {/* Interval */}
          <div className="space-y-2">
            <Label>Trading Interval</Label>
            <Select value={interval} onValueChange={setInterval}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVALS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Duration */}
          <div className="space-y-2">
            <Label>Run Duration</Label>
            <Select value={durationHours} onValueChange={setDurationHours}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {DURATION_LABELS[h]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || exchangeKeys.length === 0 || !exchange}
          >
            {submitting ? "Starting..." : "Start Run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
