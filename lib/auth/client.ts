import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./server";

export const authClient = createAuthClient({
  // Use the same origin the app is served from.
  // This prevents sign-in failures when Next.js shifts ports (e.g. 3000 → 3001).
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  plugins: [inferAdditionalFields<typeof auth>()],
});
