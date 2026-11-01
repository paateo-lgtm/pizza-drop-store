import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Toaster } from "@/components/ui/sonner";

export default function ShopLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#inhalt"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:ring-[3px] focus:ring-ring/50"
      >
        Zum Inhalt springen
      </a>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-8">
        <Link href="/" aria-label="Pizza Drop – Startseite">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/#so-gehts" className="hover:text-olive">
            So funktioniert&apos;s
          </Link>
        </nav>
      </header>

      <main id="inhalt" className="flex-1">
        {children}
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-line px-4 py-8 text-sm sm:px-8">
        <Wordmark className="text-xl" />
        <nav className="flex gap-5 text-ink-muted">
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/agb">AGB</Link>
        </nav>
      </footer>
      <Toaster position="top-center" />
    </>
  );
}
