import Link from "next/link";

import { GUEST_NAV_ITEMS } from "@/lib/constants";
import { Button } from "@/components/ui/primitives";
import { BrandWordmark } from "@/components/shared/brand";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#05070f]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-6 px-4 py-4 md:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center">
          <BrandWordmark variant="hero" />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          {GUEST_NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/app/map">
            <Button className="rounded-2xl bg-white px-5 py-3 text-slate-950 hover:bg-slate-100">Open Live Map</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
