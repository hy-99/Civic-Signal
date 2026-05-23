"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_NAV_ITEMS, APP_NAME, NAV_ITEMS } from "@/lib/constants";
import type { AuthViewer } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AppSidebar({ viewer }: { viewer: AuthViewer | null }) {
  const pathname = usePathname();
  const adminItems = viewer ? ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(viewer.role)) : [];

  return (
    <aside className="civic-light-card flex h-full flex-col rounded-[2rem] p-4">
      <Link href="/app/map" className="civic-report-stripe rounded-[1.6rem] px-5 py-4 text-lg font-black tracking-[-0.03em] text-white">
        {APP_NAME}
      </Link>
      <div className="mt-6 grid gap-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-[1.2rem] px-4 py-3 text-sm font-medium transition",
              pathname.startsWith(item.href)
                ? "bg-[#eef4ff] text-[#1d4ed8] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.15)]"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {adminItems.length ? (
        <div className="mt-8 grid gap-2">
          <p className="px-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Moderator Tools</p>
          {adminItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-[1.2rem] px-4 py-3 text-sm font-medium transition",
                pathname.startsWith(item.href)
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="mt-auto rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-950">{viewer ? viewer.display_name : "Guest Viewer"}</p>
        <p className="mt-1">{viewer ? `${viewer.role} access` : "Public access"}</p>
      </div>
    </aside>
  );
}
