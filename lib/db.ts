/**
 * Public DB barrel — import the client + schema from one place.
 *
 *   import { db, users, apiKeys } from '@/lib/db'
 *
 * Existing imports from '@/lib/db/client' and '@/lib/db/schema' continue to work.
 */
export { db } from './db/client'
export * from './db/schema'
