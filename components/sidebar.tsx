"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FilePlus2,
  Activity,
  Boxes,
  Inbox,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PrimonLogo } from "./logo";
import { useDemo } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useUI } from "@/lib/ui-context";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, allowedRoles: ["admin", "ops_manager"] },
  { href: "/dashboard/work-orders/new", label: "New work order", icon: FilePlus2, allowedRoles: ["admin", "ops_manager"] },
  { href: "/dashboard/monitor", label: "Gas-reading monitor", icon: Activity, allowedRoles: ["admin", "ops_manager", "supervisor"] },
  { href: "/dashboard/inventory", label: "Fumigant stock", icon: Boxes, allowedRoles: ["admin"] },
  { href: "/dashboard/intake", label: "Website intake", icon: Inbox, allowedRoles: ["admin", "ops_manager"] },
  { href: "/dashboard/household", label: "Household clients", icon: Users, allowedRoles: ["admin", "ops_manager"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { workOrders } = useDemo();
  const { role } = useCurrentUser();
  const { isMobileNavOpen, setIsMobileNavOpen } = useUI();
  const flaggedCount = workOrders.filter((w) => w.status === "flagged").length;

  if (role === "client" || role === "executive") {
    return null; // Clients and Executives don't see the dashboard sidebar
  }

  const filteredNav = nav.filter((item) => !role || item.allowedRoles.includes(role));

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-primon-950 text-primon-100 transition-transform duration-300 ease-in-out lg:z-30 lg:translate-x-0",
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center px-5">
          <PrimonLogo width={140} />
        </div>

        <nav className="flex-1 space-y-1.5 px-3 py-4">
          {filteredNav.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-white/10 text-white"
                    : "text-primon-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                  {item.label}
                </span>
                {item.href === "/dashboard/monitor" && flaggedCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-status-critical px-1 text-[10px] font-semibold text-white">
                    {flaggedCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-6 py-4">
          <p className="text-[11px] leading-relaxed text-primon-400">
            Licensed commercial applicator — Malawi Pesticides Control Board
          </p>
        </div>
      </aside>
    </>
  );
}
