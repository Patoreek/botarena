"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { BotForm, type BotFormData } from "@/components/bots/bot-form";
import { Button } from "@/components/ui/button";
import type { BotResponse } from "@repo/shared";

export default function NewBotPage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const handleSubmit = async (data: BotFormData) => {
    if (!accessToken) return;
    try {
      const payload: Record<string, unknown> = {
        name: data.name,
        strategy: data.strategy,
      };
      if ("gridConfig" in data) {
        payload.gridConfig = data.gridConfig;
      } else {
        payload.strategyConfig = data.strategyConfig;
      }

      const bot = await apiFetch<BotResponse>("/bots", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      });
      toast.success("Bot created successfully");
      router.push(`/bots/${bot.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create bot");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/bots">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Bot</h1>
          <p className="text-muted-foreground">Configure a new trading bot</p>
        </div>
      </div>
      <BotForm onSubmit={handleSubmit} submitLabel="Create Bot" />
    </div>
  );
}
