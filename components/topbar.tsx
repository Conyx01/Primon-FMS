"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, LogOut, Menu, AlertTriangle, CheckCircle2, Inbox, Package } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { useUI } from "@/lib/ui-context";
import {
  useNotifications,
  notificationLabel,
  notificationHref,
  type AppNotification,
} from "@/lib/hooks/use-notifications";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ── Notification type → icon ─────────────────────────────────────────────────

function NotifIcon({ type }: { type: string }) {
  const cls = "h-4 w-4 shrink-0";
  if (type === "critical_gas_reading")
    return <AlertTriangle className={cn(cls, "text-status-critical")} strokeWidth={1.75} />;
  if (type === "fcc_certified")
    return <CheckCircle2 className={cn(cls, "text-status-compliant")} strokeWidth={1.75} />;
  if (type === "new_intake_submission")
    return <Inbox className={cn(cls, "text-primon-600")} strokeWidth={1.75} />;
  if (type === "low_stock")
    return <Package className={cn(cls, "text-brass-600")} strokeWidth={1.75} />;
  return <Bell className={cn(cls, "text-muted")} strokeWidth={1.75} />;
}

// ── Notification row ─────────────────────────────────────────────────────────

function NotifRow({ n, onClose }: { n: AppNotification; onClose: () => void }) {
  const href = notificationHref(n.type, n.payload);
  const label = notificationLabel(n.type, n.payload);
  const isUnread = !n.readAt;

  const inner = (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 transition-colors hover:bg-primon-50",
        isUnread && "bg-primon-50/60"
      )}
    >
      <NotifIcon type={n.type} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-xs leading-snug", isUnread ? "font-medium text-ink" : "text-muted")}>
          {label}
        </p>
        <p className="mt-0.5 text-[10px] text-muted">{formatDateTime(n.createdAt)}</p>
      </div>
      {isUnread && (
        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primon-600" />
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClose}>
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

// ── Topbar ───────────────────────────────────────────────────────────────────

export function Topbar({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const { user, role, isLoading } = useCurrentUser();
  const router = useRouter();
  const { setIsMobileNavOpen } = useUI();
  const { notifications, unreadCount, markAllRead } = useNotifications();

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleBellClick() {
    setOpen((v) => !v);
  }

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

        {/* Notification bell */}
        <div className="relative">
          <button
            ref={bellRef}
            aria-label="Notifications"
            onClick={handleBellClick}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-primon-700 transition-colors hover:bg-primon-50"
          >
            <Bell className="h-4 w-4" strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-critical px-1 text-[9px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown panel */}
          {open && (
            <div
              ref={panelRef}
              className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-xl border border-border bg-white shadow-xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-xs font-semibold text-primon-950">Notifications</p>
                {unreadCount > 0 && (
                  <button
                    onClick={() => { markAllRead(); }}
                    className="text-[11px] font-medium text-primon-600 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div className="max-h-80 divide-y divide-border overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10">
                    <Bell className="h-6 w-6 text-muted" strokeWidth={1.5} />
                    <p className="text-xs text-muted">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <NotifRow key={n.id} n={n} onClose={() => setOpen(false)} />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sign out */}
        {user && (
          <button
            onClick={async () => {
              await authClient.signOut();
              router.push("/login");
            }}
            title="Sign out"
            aria-label="Sign out"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-primon-700 transition-colors hover:bg-primon-50 hover:text-status-critical"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}

        {/* User pill */}
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
                {user.name?.charAt(0).toUpperCase() || "U"}
              </span>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-medium leading-tight text-ink">{user.name}</p>
                <p className="text-[11px] leading-tight text-muted capitalize">
                  {role?.replace("_", " ") || "User"}
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
