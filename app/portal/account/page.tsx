"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PortalTopbar } from "@/components/portal-topbar";
import { useCurrentUser } from "@/lib/auth/use-current-user";

const ROLE_LABEL: Record<string, string> = {
  client: "Client",
  ops_manager: "Ops manager",
  supervisor: "Supervisor",
  admin: "Admin",
  executive: "Executive",
};

export default function PortalAccountPage() {
  const { user, role, isLoading } = useCurrentUser();

  return (
    <div>
      <PortalTopbar title="Account" description="Your portal login" />
      <div className="px-6 py-8 lg:px-10">
        {isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <Card className="max-w-lg space-y-4 p-6">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted">Name</p>
              <p className="mt-1 text-sm font-medium text-ink">{user?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted">Email</p>
              <p className="mt-1 text-sm font-medium text-ink">{user?.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted">Role</p>
              <p className="mt-1 text-sm font-medium text-ink">
                {role ? ROLE_LABEL[role] ?? role : "—"}
              </p>
            </div>
            <p className="border-t border-border pt-4 text-sm text-muted">
              To change your password, use{" "}
              <Link
                href="/forgot-password"
                className="font-medium text-primon-700 hover:text-primon-950"
              >
                Forgot password
              </Link>
              . A reset link will be sent to this email.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
