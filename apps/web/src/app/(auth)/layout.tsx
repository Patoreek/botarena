import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[minmax(0,45%)_minmax(320px,1fr)]">
      {/* Left panel - abstract image and quote (hidden on small screens) */}
      <aside className="relative hidden overflow-hidden rounded-r-2xl lg:block">
        <Image
          src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&q=80"
          alt=""
          fill
          className="object-cover"
          priority
          sizes="45vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-10 text-white">
          <div className="mb-4 flex items-center gap-2">
            <Image src="/logo.svg" alt="" width={36} height={36} className="rounded" />
            <span className="text-xs font-medium uppercase tracking-widest text-white/70">
              Botarena
            </span>
          </div>
          <h2 className="text-3xl font-semibold leading-tight md:text-4xl">
            Get Everything You Want
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/90">
            You can get everything you want if you work hard, trust the process, and stick to the
            plan.
          </p>
        </div>
      </aside>

      {/* Right panel - form (always visible, takes remaining space) */}
      <main className="relative z-10 flex min-w-0 flex-col bg-background min-h-screen lg:min-h-0">
        <header className="flex shrink-0 items-center p-6 md:p-10">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Image src="/logo.svg" alt="Botarena" width={32} height={32} className="rounded" />
            Botarena
          </Link>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 pb-10 md:px-10">
          <div className="w-full max-w-sm shrink-0">{children}</div>
        </div>
      </main>
    </div>
  );
}
