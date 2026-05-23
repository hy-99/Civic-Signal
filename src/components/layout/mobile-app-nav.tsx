"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_NAV_ITEMS, NAV_ITEMS } from "@/lib/constants";
import type { AuthViewer } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MobileAppNav({ viewer }: { viewer: AuthViewer | null }) {
  const pathname = usePathname();
  const adminItems = viewer ? ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(viewer.role)) : [];
  const items = [...NAV_ITEMS.slice(0, 4), ...adminItems.slice(0, 1)];

  return (
    <nav className="grid grid-cols-4 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur-xl md:hidden">
      {items.slice(0, 4).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-lg px-2 py-2 text-center text-[11px] font-semibold text-slate-500",
            pathname.startsWith(item.href) && "bg-blue-50 text-blue-700",
          )}
        >
          {item.label.replace("Public ", "")}
        </Link>
      ))}
    </nav>
  );
}
