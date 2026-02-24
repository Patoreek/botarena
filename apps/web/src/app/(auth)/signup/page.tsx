"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupBody, type SignupBody } from "@repo/shared";
import { useAuth } from "@/lib/auth-context";
import { AuthFormLayout } from "@/components/auth/auth-form-layout";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import { Text } from "@/components/ui/typography";

export default function SignupPage() {
  const { signup, error } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<SignupBody>({
    resolver: zodResolver(signupBody),
    defaultValues: { email: "", password: "", name: "" },
  });

  const onSubmit = async (data: SignupBody) => {
    setSubmitError(null);
    try {
      await signup(data.email, data.password, data.name);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Signup failed");
    }
  };

  const formError = error ?? submitError;

  return (
    <AuthFormLayout title="Create an account" description="Enter your details below to get started">
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
        <FormField label="Name (optional)" htmlFor="name">
          <Input id="name" placeholder="Your name" {...form.register("name")} />
        </FormField>
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
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={form.formState.isSubmitting}
          onClick={() => form.handleSubmit(onSubmit)()}
        >
          {form.formState.isSubmitting ? "Creating account..." : "Sign Up"}
        </Button>
      </form>
      <AuthFooterLink prompt="Already have an account?" linkText="Log in" href="/login" />
    </AuthFormLayout>
  );
}
