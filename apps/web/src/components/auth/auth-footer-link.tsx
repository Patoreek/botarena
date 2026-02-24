import Link from "next/link";
import { cn } from "@/lib/utils";

export interface AuthFooterLinkProps {
  prompt: string;
  linkText: string;
  href: string;
  className?: string;
}

export function AuthFooterLink({ prompt, linkText, href, className }: AuthFooterLinkProps) {
  return (
    <p className={cn("text-center text-sm text-muted-foreground", className)}>
      {prompt}{" "}
      <Link href={href} className="font-medium text-foreground underline-offset-4 hover:underline">
        {linkText}
      </Link>
    </p>
  );
}
