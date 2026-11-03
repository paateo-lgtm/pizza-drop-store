"use client";

import {
  BarChart3,
  CalendarClock,
  ChefHat,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  MessageSquareText,
  Pizza,
  Settings,
  TicketPercent,
  Users,
  Wheat,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: typeof Pizza;
};

const SECTIONS: { title?: string; items: Item[] }[] = [
  { items: [{ href: "/admin", label: "Übersicht", icon: LayoutDashboard }] },
  {
    title: "Betrieb",
    items: [
      { href: "/admin/drops", label: "Drops", icon: CalendarClock },
      {
        href: "/admin/bestellungen",
        label: "Bestellungen",
        icon: ClipboardList,
      },
      { href: "/kitchen", label: "Kitchen-Mode", icon: ChefHat },
    ],
  },
  {
    title: "Sortiment",
    items: [
      { href: "/admin/pizzen", label: "Pizzen", icon: Pizza },
      { href: "/admin/zutaten", label: "Zutaten", icon: Wheat },
      { href: "/admin/gutscheine", label: "Gutscheine", icon: TicketPercent },
    ],
  },
  {
    title: "Auswertung",
    items: [
      {
        href: "/admin/reporting",
        label: "Reporting",
        icon: BarChart3,
      },
      { href: "/admin/feedback", label: "Feedback", icon: MessageSquareText },
    ],
  },
  {
    title: "Verwaltung",
    items: [
      { href: "/admin/inhalte", label: "Inhalte & Recht", icon: FileText },
      { href: "/admin/einstellungen", label: "Einstellungen", icon: Settings },
      { href: "/admin/team", label: "Team", icon: Users },
      { href: "/admin/protokoll", label: "Protokoll", icon: History },
    ],
  },
];

/** Aktiver Menüpunkt hängt an der URL; im vorgerenderten Gerüst steht die Navigation ohne Markierung. */
export function AdminNav() {
  return <NavItems pathname={usePathname()} />;
}

export function AdminNavFallback() {
  return <NavItems pathname="" />;
}

function NavItems({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Admin-Navigation" className="flex flex-col gap-6">
      {SECTIONS.map((section, i) => (
        <div key={section.title ?? i}>
          {section.title && (
            <p className="mb-2 px-3 text-xs font-medium tracking-wide text-ink-muted uppercase">
              {section.title}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-wash",
                      active && "bg-olive-soft font-medium text-olive-deep",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
