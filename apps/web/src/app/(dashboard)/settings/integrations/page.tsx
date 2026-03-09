"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Key, Eye, EyeOff, Trash2, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { useApiKeys } from "@/hooks/use-api-keys";
import type { ApiKeyResponse, ApiProvider } from "@repo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProviderConfig {
  provider: ApiProvider;
  name: string;
  description: string;
  hasSecret: boolean;
  keyPlaceholder: string;
  secretPlaceholder?: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    provider: "BINANCE",
    name: "Binance",
    description: "Connect your Binance account for automated trading",
    hasSecret: true,
    keyPlaceholder: "Enter your Binance API key",
    secretPlaceholder: "Enter your Binance API secret",
  },
  {
    provider: "OPENAI",
    name: "OpenAI",
    description: "Enable AI-powered analysis and recommendations",
    hasSecret: false,
    keyPlaceholder: "sk-...",
  },
];

function ProviderCard({
  config,
  existingKey,
  onSave,
  onDelete,
}: {
  config: ProviderConfig;
  existingKey: ApiKeyResponse | undefined;
  onSave: () => void;
  onDelete: () => void;
}) {
  const { accessToken } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [label, setLabel] = useState(existingKey?.label ?? config.name);
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const handleSave = async () => {
    if (!accessToken || !apiKey.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/api-keys", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          provider: config.provider,
          label: label.trim() || config.name,
          apiKey: apiKey.trim(),
          ...(config.hasSecret && apiSecret.trim() ? { apiSecret: apiSecret.trim() } : {}),
        }),
      });
      toast.success(`${config.name} API key saved`);
      setApiKey("");
      setApiSecret("");
      setEditing(false);
      setShowKey(false);
      setShowSecret(false);
      onSave();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!accessToken || !existingKey) return;
    setDeleting(true);
    try {
      await apiFetch(`/api-keys/${existingKey.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      toast.success(`${config.name} API key removed`);
      onDelete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{config.name}</CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </div>
          </div>
          {existingKey && !editing && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-600">
              <Check className="mr-1 h-3 w-3" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {existingKey && !editing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{existingKey.label}</p>
                <p className="text-sm text-muted-foreground font-mono">{existingKey.keyHint}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Update
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={config.name}
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={config.keyPlaceholder}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {config.hasSecret && (
              <div className="space-y-2">
                <Label>API Secret</Label>
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder={config.secretPlaceholder}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !apiKey.trim()}>
                {saving ? "Saving..." : existingKey ? "Update Key" : "Save Key"}
              </Button>
              {editing && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setApiKey("");
                    setApiSecret("");
                    setShowKey(false);
                    setShowSecret(false);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function IntegrationsPage() {
  const { keys, loading, refetch } = useApiKeys();

  if (loading) {
    return (
      <div className="space-y-4">
        {PROVIDERS.map((p) => (
          <Card key={p.provider}>
            <CardHeader>
              <div className="h-6 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-64 animate-pulse rounded bg-muted" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {PROVIDERS.map((config) => (
        <ProviderCard
          key={config.provider}
          config={config}
          existingKey={keys.find((k) => k.provider === config.provider)}
          onSave={refetch}
          onDelete={refetch}
        />
      ))}
    </div>
  );
}
