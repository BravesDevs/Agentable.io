import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { apiKeys } from '@/lib/db/schema'
import { isProviderId } from '@/lib/providers/registry'
import { currentUserId } from '@/lib/auth'

export const runtime = 'nodejs'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  if (!isProviderId(provider)) {
    return Response.json({ error: 'Unknown provider' }, { status: 400 })
  }

  const userId = currentUserId()
  await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)))

  return Response.json({ ok: true })
}
