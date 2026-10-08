"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Package, FileCheck, UserRound, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { authClient } from "@/lib/auth/client";
import { useUI } from "@/lib/ui-context";

const nav = [
  { href: "/portal", label: "Shipments", icon: Package },
  { href: "/portal/certificates", label: "Certificates", icon: FileCheck },
  { href: "/portal/account", label: "Account", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  if (href === "/portal/certificates") return pathname.startsWith("/portal/certificates");
  if (href === "/portal/account") return pathname.startsWith("/portal/account");
  if (href === "/portal") {
    return (
      pathname === "/portal" ||
      (pathname.startsWith("/portal/") &&
        !pathname.startsWith("/portal/account") &&
        !pathname.startsWith("/portal/certificates"))
    );
  }
  return pathname.startsWith(href);
}

export function PortalSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useCurrentUser();
  const { isMobileNavOpen, setIsMobileNavOpen } = useUI();

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-primon-950 text-primon-100 transition-transform duration-300 ease-in-out lg:z-30 lg:translate-x-0",
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center px-5">
          <Image
            src="/Primon-logo.png"
            alt="Primon Enterprises Ltd"
            width={140}
            height={Math.round((140 * 242) / 858)}
            className="object-contain"
            priority
          />
        </div>

        <nav className="flex-1 space-y-1.5 px-3 py-4">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-white/10 text-white"
                    : "text-primon-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <p className="truncate text-xs font-medium text-white">{user?.name ?? "Client"}</p>
          <p className="mt-0.5 truncate text-[11px] text-primon-400">{user?.email ?? ""}</p>
          <button
            type="button"
            onClick={signOut}
            className="mt-3 inline-flex items-center gap-2 text-xs text-primon-300 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
