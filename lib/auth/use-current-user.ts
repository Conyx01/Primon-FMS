"use client";

import { authClient } from "./client";
import { DemoRole } from "@/lib/types";

export function useCurrentUser() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;

  return {
    user,
    role: (user?.role as DemoRole | undefined) || null,
    isLoading: isPending,
  };
}
