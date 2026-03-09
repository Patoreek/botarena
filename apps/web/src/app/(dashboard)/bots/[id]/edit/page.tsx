"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { useBot } from "@/hooks/use-bots";
import { BotForm, type BotFormData } from "@/components/bots/bot-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { BotResponse } from "@repo/shared";

export default function EditBotPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { bot, loading } = useBot(params.id);

  const handleSubmit = async (data: BotFormData) => {
    if (!accessToken) return;
    try {
      await apiFetch<BotResponse>(`/bots/${params.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          name: data.name,
          exchange: data.exchange,
          tradingPair: data.tradingPair,
          gridConfig: data.gridConfig,
        }),
      });
      toast.success("Bot updated successfully");
      router.push(`/bots/${params.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update bot");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h2 className="text-xl font-semibold">Bot not found</h2>
        <Button asChild className="mt-4">
          <Link href="/bots">Back to Bots</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/bots/${bot.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Bot</h1>
          <p className="text-muted-foreground">Update configuration for {bot.name}</p>
        </div>
      </div>
      <BotForm
        defaultValues={{
          name: bot.name,
          strategy: bot.strategy as "GRID",
          exchange: bot.exchange,
          tradingPair: bot.tradingPair,
          gridConfig: bot.gridConfig
            ? {
                upperPrice: bot.gridConfig.upperPrice,
                lowerPrice: bot.gridConfig.lowerPrice,
                gridCount: bot.gridConfig.gridCount,
                gridType: bot.gridConfig.gridType as "ARITHMETIC" | "GEOMETRIC",
                totalInvestment: bot.gridConfig.totalInvestment,
                amountPerGrid: bot.gridConfig.amountPerGrid,
                takeProfitPrice: bot.gridConfig.takeProfitPrice ?? undefined,
                stopLossPrice: bot.gridConfig.stopLossPrice ?? undefined,
              }
            : undefined,
        }}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
      />
    </div>
  );
}
