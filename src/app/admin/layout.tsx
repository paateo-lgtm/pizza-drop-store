import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Toaster } from "@/components/ui/sonner";
import { AdminNav, AdminNavFallback } from "./_components/admin-nav";
import { UserMenu } from "./_components/user-menu";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Pizza Drop" },
  robots: { index: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex flex-col gap-8 border-b border-line bg-surface px-3 py-5 md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <Link href="/admin" className="px-3">
          <Wordmark className="text-xl" />
        </Link>
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<AdminNavFallback />}>
            <AdminNav />
          </Suspense>
        </div>
        <div className="border-t border-line px-3 pt-4">
          <Suspense fallback={<div className="h-9" />}>
            <UserMenu />
          </Suspense>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">{children}</main>
      <Toaster position="bottom-right" />
    </div>
  );
}
