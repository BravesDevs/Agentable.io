import Link from 'next/link'

interface SearchParams {
  reason?: string
  detail?: string
  hint?:   string
}

const REASON_TITLES: Record<string, string> = {
  config:        'Auth0 not configured',
  state:         'Sign in expired or was tampered with',
  exchange:      'Could not complete sign in',
  userinfo:      'Could not load your profile',
  db:            'Database not ready',
  auth0:         'Auth0 returned an error',
  unknown:       'Something went wrong while signing you in',
}

export default async function AuthErrorPage(props: { searchParams: Promise<SearchParams> }) {
  const { reason = 'unknown', detail, hint } = await props.searchParams
  const title = REASON_TITLES[reason] ?? REASON_TITLES.unknown

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground font-mono select-none">
      <div className="flex flex-col items-center gap-6 px-6 text-center max-w-lg">
        <p className="text-7xl font-bold tracking-tighter text-muted-foreground/30">!</p>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {detail && (
            <p className="text-sm text-muted-foreground break-words">
              {detail}
            </p>
          )}
          {hint && (
            <p className="text-xs text-muted-foreground/80 mt-2">
              {hint}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors"
          >
            Try again
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  )
}
