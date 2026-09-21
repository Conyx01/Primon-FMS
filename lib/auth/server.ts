import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Invite-only: public Sign Up UI is gone; also block the API path.
  disabledPaths: ["/sign-up/email"],
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
