"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AuthViewer } from "@/lib/types";
import { ADMIN_NAV_ITEMS, NAV_ITEMS } from "@/lib/constants";
import { BrandWordmark } from "@/components/shared/brand";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { SettingsMenu } from "@/components/layout/settings-menu";
import { cn } from "@/lib/utils";

export function AppTopbar({ viewer }: { viewer: AuthViewer | null }) {
  const pathname = usePathname();
  const visibleNav = NAV_ITEMS;
  const adminItems = viewer ? ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(viewer.role)) : [];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-3 px-3 sm:px-4">
        <Link
          href="/app/map"
          className="flex min-w-fit items-center rounded-xl bg-[#0d2046] px-3 py-2 shadow-sm ring-1 ring-white/10"
        >
          <BrandWordmark variant="compact" />
        </Link>

        <nav className="hidden items-center gap-1 xl:flex">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                pathname.startsWith(item.href) && "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
              )}
            >
              {item.label}
            </Link>
          ))}
          {adminItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                pathname.startsWith(item.href) && "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex min-w-fit items-center gap-2">
          <NotificationsMenu />
          <SettingsMenu />
        </div>
      </div>
    </header>
  );
}
