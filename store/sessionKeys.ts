'use client'

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { ProviderId } from '@/lib/providers/registry'

/**
 * In-memory only — these never hit localStorage or the DB unless the user
 * explicitly chose 'database' in the LLM node form (which routes through
 * POST /api/v1/keys with persist:'db'). Cleared on hard refresh.
 */
interface SessionKeysState {
  keys: Partial<Record<ProviderId, string>>
  setKey:    (provider: ProviderId, key: string) => void
  clearKey:  (provider: ProviderId) => void
  clearAll:  () => void
}

export const useSessionKeys = create<SessionKeysState>((set) => ({
  keys: {},
  setKey:   (provider, key) => set((s) => ({ keys: { ...s.keys, [provider]: key } })),
  clearKey: (provider) => set((s) => {
    const next = { ...s.keys }
    delete next[provider]
    return { keys: next }
  }),
  clearAll: () => set({ keys: {} }),
}))

export const useSessionKeysSnapshot = () =>
  useSessionKeys(useShallow((s) => s.keys))
