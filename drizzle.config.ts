import { readFileSync } from 'fs'
import { defineConfig } from 'drizzle-kit'

// drizzle-kit doesn't read .env.local automatically (that's Next.js-specific),
// so we parse it here before defineConfig reads process.env.
try {
  const raw = readFileSync('.env.local', 'utf8')
  for (const line of raw.split('\n')) {
    const match = line.match(/^([^#=\s]+)\s*=\s*"?([^"]*)"?\s*$/)
    if (match) process.env[match[1]] ??= match[2]
  }
} catch { /* file absent in CI — env vars supplied externally */ }

export default defineConfig({
  schema:  './lib/db/schema.ts',
  out:     './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
