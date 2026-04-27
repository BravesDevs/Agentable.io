import { publicRegistry } from '@/lib/providers/registry'

export const runtime = 'nodejs'

export async function GET() {
  return Response.json({ providers: publicRegistry() })
}
