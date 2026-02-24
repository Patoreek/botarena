"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateProfileBody, type UpdateProfileBody } from "@repo/shared";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function ProfileSettingsPage() {
  const { user, accessToken, refresh } = useAuth();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const form = useForm<UpdateProfileBody>({
    resolver: zodResolver(updateProfileBody),
    defaultValues: {
      name: "",
      email: "",
      currentPassword: "",
      newPassword: "",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name ?? "",
        email: user.email,
        currentPassword: "",
        newPassword: "",
      });
    }
  }, [user?.id, user?.email, user?.name, form]);

  const onSubmit = async (data: UpdateProfileBody) => {
    setMessage(null);
    if (!accessToken) return;
    try {
      await apiFetch("/me", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          ...(data.name !== undefined && data.name !== "" && { name: data.name }),
          ...(data.email !== undefined && data.email !== "" && { email: data.email }),
          ...(data.newPassword &&
            data.currentPassword && {
              currentPassword: data.currentPassword,
              newPassword: data.newPassword,
            }),
        }),
      });
      await refresh();
      setMessage({ type: "success", text: "Profile updated." });
      form.resetField("currentPassword");
      form.resetField("newPassword");
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Update failed" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Update your name, email, or password.</p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Profile settings</CardTitle>
          <CardDescription>Changes are saved when you submit.</CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {message && (
              <p
                className={
                  message.type === "success" ? "text-sm text-green-600" : "text-sm text-destructive"
                }
              >
                {message.text}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...form.register("name")} placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                placeholder="you@example.com"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password (to change password)</Label>
              <Input id="currentPassword" type="password" {...form.register("currentPassword")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" type="password" {...form.register("newPassword")} />
              {form.formState.errors.newPassword && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.newPassword.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
