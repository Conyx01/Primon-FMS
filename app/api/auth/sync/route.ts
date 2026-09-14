import { auth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const { data: sessionData } = await auth.getSession();
    if (!sessionData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, email, name } = sessionData.user;

    const user = await prisma.user.upsert({
      where: { id },
      update: {
        email: email,
        name: name || email.split('@')[0],
      },
      create: {
        id,
        email: email,
        name: name || email.split('@')[0],
        role: 'supervisor', // Default role
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Failed to sync user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
