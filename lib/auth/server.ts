import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

// Build the trusted origins list from the configured URL so that both
// local dev (localhost:3000 OR 3001 if port is taken) and the production
// Vercel deployment are accepted without throwing "invalid origin" errors.
const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

const trustedOriginsSet = new Set([appUrl]);
// Always trust both common dev ports so hot-reload port shifts don't break auth
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
