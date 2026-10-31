"use client";

import { usePathname, useRouter } from "next/navigation";
import { use, useEffect } from "react";
import { toast } from "sonner";

/** Zeigt nach einer Weiterleitung mit ?gespeichert=Name eine Bestätigung und räumt die URL auf. */
export function SavedToast({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { gespeichert } = use(searchParams);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof gespeichert === "string") {
      toast.success(`„${gespeichert}“ gespeichert`);
      router.replace(pathname, { scroll: false });
    }
  }, [gespeichert, pathname, router]);

  return null;
}
