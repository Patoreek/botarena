import * as React from "react";
import { cn } from "@/lib/utils";
import { Heading, Text } from "@/components/ui/typography";

export interface AuthFormLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function AuthFormLayout({ title, description, children, className }: AuthFormLayoutProps) {
  return (
    <div className={cn("space-y-8", className)}>
      <div>
        <Heading as="h1" size="h1">
          {title}
        </Heading>
        {description && (
          <Text size="sm" muted className="mt-2">
            {description}
          </Text>
        )}
      </div>
      {children}
    </div>
  );
}
