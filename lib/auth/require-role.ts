import { NextResponse } from 'next/server';
import { getSessionUser } from './session';
import { Role } from '@prisma/client';

export async function requireRole(allowedRoles: Role[]) {
  const session = await getSessionUser();

  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (!allowedRoles.includes(session.dbUser.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user: session.dbUser };
}
