import { auth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { User as DbUser } from '@prisma/client';

export async function getSessionUser(): Promise<{ authUser: any; dbUser: DbUser } | null> {
  const { data: sessionData } = await auth.getSession();
  if (!sessionData?.user) {
    return null;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionData.user.id },
  });

  if (!dbUser) {
    return null;
  }

  return { authUser: sessionData.user, dbUser };
}
