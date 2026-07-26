"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "./nav";
import { cn } from "@/lib/utils";

/**
 * Desktop navigation. Client-only because the active item is derived from the
 * pathname; it reads the same `NavItem[]` as `MobileNav` so the two cannot drift.
 */
export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  if (items.length === 0) return null;

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon size={16} weight={active ? "Filled" : "Outline"} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
