"use client";

import { Menu } from "lucide-react";
import { useUI } from "@/lib/ui-context";
import { NotificationBell } from "@/components/notification-bell";

export function PortalTopbar({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const { setIsMobileNavOpen } = useUI();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-canvas/80 px-4 backdrop-blur-md sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setIsMobileNavOpen(true)}
          className="shrink-0 rounded-md p-1.5 text-primon-950 transition-colors hover:bg-primon-50 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 truncate">
          <h1 className="truncate font-display text-lg text-primon-950 sm:text-xl">{title}</h1>
          {description ? (
            <p className="hidden truncate text-[11px] text-muted sm:block">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        <NotificationBell portal types={["fcc_certified"]} />
      </div>
    </header>
  );
}
