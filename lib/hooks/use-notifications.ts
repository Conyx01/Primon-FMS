"use client";

import { useCallback, useEffect, useState } from "react";

export interface AppNotification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  channel: string;
  readAt: string | null;
  createdAt: string;
}

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Non-blocking — topbar still renders
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    try {
      await fetch("/api/notifications/mark-read", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }, []);

  return { notifications, unreadCount, isLoading, markAllRead, refresh };
}

// ── Notification message helpers ──────────────────────────────────────────────

export function notificationLabel(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case "critical_gas_reading":
      return `Critical reading on Day ${payload.dayNumber ?? "?"} — action required`;
    case "fcc_certified":
      return `${payload.certificateNumber ?? "FCC"} has been certified`;
    case "new_intake_submission":
      return `New intake submission from ${payload.name ?? "unknown"}`;
    case "low_stock":
      return `Low stock alert — ${payload.formulationName ?? "a formulation"} is running low`;
    default:
      return type.replace(/_/g, " ");
  }
}

export function notificationHref(type: string, payload: Record<string, unknown>): string | null {
  switch (type) {
    case "critical_gas_reading":
      return payload.workOrderId ? `/dashboard/monitor/${payload.workOrderId}` : "/dashboard/monitor";
    case "fcc_certified":
      return payload.fccId ? `/dashboard/monitor/${payload.fccId}` : null;
    case "new_intake_submission":
      return "/dashboard/intake";
    case "low_stock":
      return "/dashboard/inventory";
    default:
      return null;
  }
}
