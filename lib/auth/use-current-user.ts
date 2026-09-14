'use client';

import { useEffect, useState } from 'react';
import { authClient } from './client';
import { DemoRole } from '@/lib/types';
import { User as DbUser } from '@prisma/client';

export function useCurrentUser() {
  const { data: session, isPending } = authClient.useSession();
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isPending) return;

    if (!session) {
      setDbUser(null);
      setIsLoading(false);
      return;
    }

    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch user');
        return res.json();
      })
      .then((data) => {
        setDbUser(data);
      })
      .catch((err) => {
        console.error(err);
        setDbUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [session, isPending]);

  return {
    user: dbUser,
    role: (dbUser?.role as DemoRole) || null,
    isLoading: isPending || isLoading,
  };
}
