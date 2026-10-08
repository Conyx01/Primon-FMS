"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, CheckCircle2, Inbox, Package } from "lucide-react";
import {
  useNotifications,
  notificationLabel,
  notificationHref,
  type AppNotification,
} from "@/lib/hooks/use-notifications";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

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

function NotifRow({
  n,
  portal,
  onClose,
  onOpen,
}: {
  n: AppNotification;
  portal?: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const href = notificationHref(n.type, n.payload, { portal });
  const label = notificationLabel(n.type, n.payload, { portal });
  const isUnread = !n.readAt;

  function handleOpen() {
    if (isUnread) onOpen(n.id);
    onClose();
  }

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
      {isUnread && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primon-600" />}
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={handleOpen}>
        {inner}
      </Link>
    );
  }
  return <div onClick={handleOpen}>{inner}</div>;
}

export function NotificationBell({
  portal = false,
  types,
}: {
  portal?: boolean;
  types?: string[];
}) {
  const { notifications, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const visible = types
    ? notifications.filter((n) => types.includes(n.type))
    : notifications;
  const visibleUnread = visible.filter((n) => !n.readAt).length;

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

  return (
    <div className="relative">
      <button
        ref={bellRef}
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-primon-700 transition-colors hover:bg-primon-50"
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} />
        {visibleUnread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-critical px-1 text-[9px] font-bold text-white">
            {visibleUnread > 9 ? "9+" : visibleUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-xl border border-border bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-xs font-semibold text-primon-950">Notifications</p>
            {visibleUnread > 0 && (
              <button
                type="button"
                onClick={() => {
                  void markAllRead();
                }}
                className="text-[11px] font-medium text-primon-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 divide-y divide-border overflow-y-auto">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10">
                <Bell className="h-6 w-6 text-muted" strokeWidth={1.5} />
                <p className="text-xs text-muted">No notifications yet</p>
              </div>
            ) : (
              visible.map((n) => (
                <NotifRow
                  key={n.id}
                  n={n}
                  portal={portal}
                  onClose={() => setOpen(false)}
                  onOpen={(id) => {
                    void markRead([id]);
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
