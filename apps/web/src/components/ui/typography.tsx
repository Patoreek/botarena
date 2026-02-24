import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const headingVariants = cva("font-semibold tracking-tight text-foreground", {
  variants: {
    size: {
      h1: "text-2xl md:text-3xl",
      h2: "text-xl md:text-2xl",
      h3: "text-lg md:text-xl",
      h4: "text-base md:text-lg",
    },
  },
  defaultVariants: {
    size: "h1",
  },
});

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>, VariantProps<typeof headingVariants> {
  as?: "h1" | "h2" | "h3" | "h4";
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, size = "h1", as: Comp = "h1", ...props }, ref) => (
    <Comp ref={ref} className={cn(headingVariants({ size }), className)} {...props} />
  )
);
Heading.displayName = "Heading";

const textVariants = cva("text-foreground", {
  variants: {
    size: {
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
    },
    muted: {
      true: "text-muted-foreground",
      false: "",
    },
  },
  defaultVariants: {
    size: "base",
    muted: false,
  },
});

export type TextProps = React.HTMLAttributes<HTMLParagraphElement> &
  VariantProps<typeof textVariants>;

const Text = React.forwardRef<HTMLParagraphElement, TextProps>(
  ({ className, size, muted, ...props }, ref) => (
    <p ref={ref} className={cn(textVariants({ size, muted }), className)} {...props} />
  )
);
Text.displayName = "Text";

export interface MutedProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "base";
}

const Muted = React.forwardRef<HTMLSpanElement, MutedProps>(
  ({ className, size = "sm", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "text-muted-foreground",
        size === "sm" && "text-sm",
        size === "base" && "text-base",
        className
      )}
      {...props}
    />
  )
);
Muted.displayName = "Muted";

export { Heading, Text, Muted, headingVariants, textVariants };
