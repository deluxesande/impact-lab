"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "reicon-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/animate-ui/components/radix/sheet";
import type { NavItem } from "./nav";
import { cn } from "@/lib/utils";

/**
 * Mobile navigation. A client island so `SiteHeader` can stay a server
 * component — only the open/closed state needs the client.
 *
 * The sheet closes on navigation: Next's client-side transitions keep this
 * component mounted, so without the explicit close it stays open over the new
 * page. That is the single most common friction bug in this pattern.
 */
export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (items.length === 0) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:hidden"
      >
        <Menu size={20} aria-hidden />
      </SheetTrigger>

      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="text-base">Menu</SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 p-3">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {/* Filled marks the active item; outline is the default (§3.6). */}
                <Icon size={20} weight={active ? "Filled" : "Outline"} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
