import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { CANONICAL_PUBLIC_ORIGIN } from "@/lib/verify-url";

const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

const trustedOriginsSet = new Set([
  appUrl,
  CANONICAL_PUBLIC_ORIGIN,
  "https://primon-fms.vercel.app",
]);
if (process.env.NODE_ENV !== "production") {
  trustedOriginsSet.add("http://localhost:3000");
  trustedOriginsSet.add("http://localhost:3001");
  trustedOriginsSet.add("http://localhost:3002");
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Invite-only: public Sign Up UI is gone; also block the API path.
  disabledPaths: ["/sign-up/email"],
  trustedOrigins: [...trustedOriginsSet],
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "supervisor",
        input: false,
      },
    },
  },
});
