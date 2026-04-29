import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground font-mono select-none">
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        <p className="text-7xl font-bold tracking-tighter text-muted-foreground/30">404</p>

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            The route you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors"
        >
          ← Back to canvas
        </Link>
      </div>
    </div>
  )
}
