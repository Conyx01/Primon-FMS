import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

// Build the trusted origins list from the configured URL so that both
// local dev (localhost:3000) and the production Vercel deployment are
// accepted without throwing "invalid origin" errors.
const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Invite-only: public Sign Up UI is gone; also block the API path.
  disabledPaths: ["/sign-up/email"],
  trustedOrigins: [appUrl],
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
