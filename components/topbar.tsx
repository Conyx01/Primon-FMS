"use client";

import { Bell, LogOut, Menu } from "lucide-react";
import { useDemo } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { useUI } from "@/lib/ui-context";

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
  const router = useRouter();
  const { setIsMobileNavOpen } = useUI();
  
  const flagged = workOrders.filter((w) => w.status === "flagged").length;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-canvas/80 px-4 sm:px-6 backdrop-blur-md lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={() => setIsMobileNavOpen(true)}
          className="shrink-0 rounded-md p-1.5 text-primon-950 transition-colors hover:bg-primon-50 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 truncate">
          <h1 className="truncate font-display text-lg sm:text-xl text-primon-950">{title}</h1>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
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
        {user && (
          <button
            onClick={async () => {
              await authClient.signOut();
              router.push('/login');
            }}
            title="Sign out"
            aria-label="Sign out"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-primon-700 transition-colors hover:bg-primon-50 hover:text-status-critical"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
        <div className="flex items-center gap-2.5 rounded-full border border-border bg-white py-1 pl-1 pr-3">
          {isLoading ? (
            <>
              <div className="h-8 w-8 animate-pulse rounded-full bg-primon-100" />
              <div className="hidden space-y-1 sm:block">
                <div className="h-3 w-20 animate-pulse rounded bg-primon-100" />
                <div className="h-2 w-16 animate-pulse rounded bg-primon-100" />
              </div>
            </>
          ) : user ? (
            <>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primon-800 text-xs font-medium text-white">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </span>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-medium leading-tight text-ink">{user.name}</p>
                <p className="text-[11px] leading-tight text-muted capitalize">
                  {role?.replace('_', ' ') || 'User'}
                </p>
              </div>
            </>
          ) : (
            <div className="text-sm font-medium text-muted">Not signed in</div>
          )}
        </div>
      </div>
    </header>
  );
}
