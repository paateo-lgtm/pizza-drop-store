import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { getSettings } from "@/lib/settings";
import { PageHeader, PageSkeleton } from "../_components/page-header";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Einstellungen" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Einstellungen" />
      <Suspense fallback={<PageSkeleton rows={6} />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  await requireUser("settings:manage");
  return <SettingsForm settings={await getSettings()} />;
}
