"use client";

import { Bell } from "lucide-react";
import { useDemo } from "@/lib/store";
import { currentUser } from "@/lib/mock-data";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export function Topbar({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const { workOrders } = useDemo();
  const { user, role, isLoading } = useCurrentUser();
  
  const displayUser = user || currentUser.ops_manager; // Fallback while loading
  const displayRole = role || 'ops_manager';
  const flagged = workOrders.filter((w) => w.status === "flagged").length;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-canvas/80 px-6 py-5 backdrop-blur-md lg:px-10">
      <div>
        <h1 className="font-display text-2xl text-primon-950">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      <div className="flex items-center gap-4">
        {action}
        <button
          aria-label="Notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-primon-700 transition-colors hover:bg-primon-50"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
          {flagged > 0 && (
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-status-critical" />
          )}
        </button>
        <div className="flex items-center gap-2.5 rounded-full border border-border bg-white py-1 pl-1 pr-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primon-800 text-xs font-medium text-white">
            {displayUser.name?.charAt(0).toUpperCase() || 'U'}
          </span>
          <div className="hidden text-left sm:block">
            <p className="text-xs font-medium leading-tight text-ink">{displayUser.name}</p>
            <p className="text-[11px] leading-tight text-muted">{displayRole}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
