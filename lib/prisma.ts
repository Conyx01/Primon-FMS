import { resolve } from 'path'
import { neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@prisma/client'
import ws from 'ws'

// Seed/scripts may run outside Next.js env loading. If DATABASE_URL is
// already set (Vercel, `next dev`), this is a no-op.
if (!process.env.DATABASE_URL?.trim()) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { config } = require('dotenv') as typeof import('dotenv')
    config({ path: resolve(process.cwd(), '.env.local') })
    config({ path: resolve(process.cwd(), '.env') })
  } catch {
    // dotenv is optional at runtime; Vercel injects env vars directly.
  }
}

// Must be set BEFORE any Neon Pool is created (PrismaNeon.connect() does that).
// WebSocket mode is required for prisma.$transaction().
neonConfig.webSocketConstructor = ws

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL?.trim()
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is missing. Set it in .env.local (local) or the hosting env (Vercel).'
    )
  }
  return connectionString
}

function createPrismaClient(): PrismaClient {
  // Prisma 6.7 PrismaNeon is a factory: it takes PoolConfig and constructs
  // the Pool internally. Passing an existing Pool here used to drop the URL
  // (clients defaulted to localhost / OS user).
  const adapter = new PrismaNeon({ connectionString: getConnectionString() })

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

// Lazy singleton so Next.js can import this module during compile/hot-reload
// before env is fully available. First query creates the client or throws.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
