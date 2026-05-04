'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface User {
  id: string
  email: string
  name?: string
  picture?: string
  role: string
}

export function UserMenu() {
  const [user, setUser] = useState<User | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Fetch current user
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  async function handleSignOut() {
    setIsOpen(false)
    // Call logout endpoint which clears session and redirects to Auth0 logout
    // The logout endpoint will handle redirecting back to landing page
    window.location.href = '/api/auth/logout'
  }

  // Show Sign in/Register buttons when not authenticated or still loading
  if (isLoading || !user) {
    return (
      <div className="flex items-center gap-2">
        <a
          href="/sign-in"
          className="text-[13px] text-[#9198a1] hover:text-white px-3 py-1.5 rounded-md transition-colors"
        >
          Sign in
        </a>
        <a
          href="/register"
          className="text-[13px] font-medium px-3 py-1.5 rounded-md bg-gradient-to-b from-[#f6f8fa] to-[#d1d9e0] text-[#0d1117] border border-white/20 hover:from-white hover:to-[#e6edf3] transition-colors"
        >
          Register
        </a>
      </div>
    )
  }

  // Get initials from name or email
  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase()

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-[#0969da] to-[#5a61e7] text-white text-[11px] font-bold hover:from-[#0860ca] hover:to-[#4c55db] transition-colors border border-white/20"
        title={user.email}
      >
        {initials}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md bg-[#161b22] border border-white/10 shadow-lg overflow-hidden z-50">
          {/* Header with user email */}
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-[12px] font-medium text-white/90">
              {user.name || 'User'}
            </p>
            <p className="text-[11px] text-white/50 mt-0.5 truncate">{user.email}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false)
                router.push('/account')
              }}
              className="w-full text-left px-4 py-2 text-[12px] text-white/80 hover:bg-white/8 transition-colors"
            >
              Manage account
            </button>
            <button
              onClick={() => {
                setIsOpen(false)
                router.push('/saved-workflows')
              }}
              className="w-full text-left px-4 py-2 text-[12px] text-white/80 hover:bg-white/8 transition-colors"
            >
              Saved Workflows
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-white/8" />

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2 text-[12px] text-[#f85149] hover:bg-white/8 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
