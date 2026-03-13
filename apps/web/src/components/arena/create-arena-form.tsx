"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { useBots } from "@/hooks/use-bots";
import { useApiKeys } from "@/hooks/use-api-keys";
import {
  INTERVAL_LABELS,
  DURATION_OPTIONS,
  DURATION_LABELS,
  TOP_MARKET_PAIRS,
  type RunInterval,
  type ApiProvider,
  type ArenaResponse,
} from "@repo/shared";

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
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";

const EXCHANGE_PROVIDERS: { value: ApiProvider; label: string }[] = [
  { value: "BINANCE", label: "Binance" },
];

const INTERVALS: { value: RunInterval; label: string }[] = Object.entries(INTERVAL_LABELS).map(
  ([value, label]) => ({ value: value as RunInterval, label })
);

export function CreateArenaForm() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { keys, loading: keysLoading } = useApiKeys();
  const { bots, loading: botsLoading } = useBots({ limit: 100 });

  const [name, setName] = useState("");
  const [exchange, setExchange] = useState<string>("");
  const [pairMode, setPairMode] = useState<"preset" | "custom">("preset");
  const [selectedPair, setSelectedPair] = useState<string>("");
  const [customPair, setCustomPair] = useState("");
  const [interval, setInterval] = useState<string>("ONE_MINUTE");
  const [durationHours, setDurationHours] = useState<string>("1");
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const exchangeKeys = keys.filter((k) =>
    EXCHANGE_PROVIDERS.some((e) => e.value === k.provider)
  );

  const toggleBot = (botId: string) => {
    setSelectedBotIds((prev) => {
      if (prev.includes(botId)) return prev.filter((id) => id !== botId);
      if (prev.length >= 5) {
        toast.error("Maximum 5 bots per arena");
        return prev;
      }
      return [...prev, botId];
    });
  };

  const handleSubmit = async () => {
    if (!accessToken) return;
    const marketPair = pairMode === "custom" ? customPair.trim() : selectedPair;

    if (!name.trim()) { toast.error("Please enter an arena name"); return; }
    if (!exchange) { toast.error("Please select an exchange"); return; }
    if (!marketPair) { toast.error("Please select a market pair"); return; }
    if (selectedBotIds.length < 2) { toast.error("Select at least 2 bots"); return; }

    setSubmitting(true);
    try {
      const arena = await apiFetch<ArenaResponse>("/arenas", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          name: name.trim(),
          exchange,
          marketPair,
          interval,
          durationHours: Number(durationHours),
          botIds: selectedBotIds,
        }),
      });
      toast.success("Arena started!");
      router.push(`/arena/${arena.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create arena");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Arena Name */}
      <div className="space-y-2">
        <Label>Arena Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Grid Bot Showdown"
        />
      </div>

      <Separator />

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
            </Link>
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
        <Label>Arena Duration</Label>
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

      <Separator />

      {/* Bot Selector */}
      <div className="space-y-2">
        <Label>
          Select Bots ({selectedBotIds.length}/5)
          <span className="ml-2 text-xs text-muted-foreground">min 2, max 5</span>
        </Label>
        {botsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : bots.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            No bots yet.{" "}
            <Link href="/bots/new" className="text-primary underline">
              Create a bot
            </Link>{" "}
            first.
          </div>
        ) : (
          <div className="space-y-2 rounded-md border p-3 max-h-64 overflow-y-auto">
            {bots.map((bot) => (
              <label
                key={bot.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={selectedBotIds.includes(bot.id)}
                  onChange={() => toggleBot(bot.id)}
                />
                <div className="flex-1">
                  <span className="font-medium text-sm">{bot.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{bot.strategy}</span>
                </div>
                {bot.stats && (
                  <span className="text-xs text-muted-foreground">
                    PnL: {bot.stats.netPnl.toFixed(2)}
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/arena")}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || selectedBotIds.length < 2 || !exchange || !name.trim()}
        >
          {submitting ? "Starting Arena..." : "Start Arena"}
        </Button>
      </div>
    </div>
  );
}
