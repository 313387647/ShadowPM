"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";

export function Header() {
  const pathname = usePathname();

  const currentNav = NAV_ITEMS.find(
    (item) =>
      pathname === item.href || pathname.startsWith(item.href + "/")
  );

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background px-6">
      <h2 className="text-lg font-semibold text-foreground">
        {currentNav?.label ?? "ShadowPM"}
      </h2>
    </header>
  );
}
