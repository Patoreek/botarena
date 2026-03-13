import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { authGuard } from "@/lib/auth-guard";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await authGuard();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r bg-card">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Image src="/logo.svg" alt="Botarena" width={28} height={28} className="rounded" />
            Botarena
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Dashboard
          </Link>
          <Link
            href="/bots"
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Bots
          </Link>
          <Link
            href="/runs"
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Runs
          </Link>
          <Link
            href="/arena"
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Arena
          </Link>
          <Link
            href="/settings/profile"
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Settings
          </Link>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-2 border-b px-4">
          <ThemeToggle />
          <UserMenu />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
