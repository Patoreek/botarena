"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginBody, type LoginBody } from "@repo/shared";
import { useAuth } from "@/lib/auth-context";
import { AuthFormLayout } from "@/components/auth/auth-form-layout";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Text } from "@/components/ui/typography";

export default function LoginPage() {
  const { login, error } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<LoginBody>({
    resolver: zodResolver(loginBody),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginBody) => {
    setSubmitError(null);
    try {
      await login(data.email, data.password);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Login failed");
    }
  };

  const formError = error ?? submitError;

  return (
    <AuthFormLayout
      title="Welcome Back"
      description="Enter your email and password to access your account"
    >
      <form
        method="post"
        action="#"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit(onSubmit)(e);
        }}
        className="space-y-5"
      >
        {formError && (
          <Text size="sm" className="text-destructive">
            {formError}
          </Text>
        )}
        <FormField label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            {...form.register("email")}
          />
        </FormField>
        <FormField
          label="Password"
          htmlFor="password"
          error={form.formState.errors.password?.message}
        >
          <PasswordInput
            id="password"
            placeholder="Enter your password"
            {...form.register("password")}
          />
        </FormField>
        <div className="flex items-center justify-between">
          <Checkbox label="Remember me" />
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Forgot Password
          </Link>
        </div>
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={form.formState.isSubmitting}
          onClick={() => form.handleSubmit(onSubmit)()}
        >
          {form.formState.isSubmitting ? "Signing in..." : "Sign In"}
        </Button>
      </form>
      <AuthFooterLink prompt="Don't have an account?" linkText="Sign Up" href="/signup" />
    </AuthFormLayout>
  );
}
