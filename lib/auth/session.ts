import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { User as DbUser } from "@prisma/client";

type AuthSessionUser = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>["user"];

export async function getSessionUser(): Promise<{
  authUser: AuthSessionUser;
  dbUser: DbUser;
} | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!dbUser) {
    return null;
  }

  return { authUser: session.user, dbUser };
}
