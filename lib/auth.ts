/**
 * Single-user MVP — every request is "demo" unless DEV_USER_ID overrides.
 * When real auth lands, replace with a session resolver.
 */
export function currentUserId(): string {
  return process.env.DEV_USER_ID ?? 'demo'
}
