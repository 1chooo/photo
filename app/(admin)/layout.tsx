'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { useAuth } from '@/lib/firebase/useAuth'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading) {
      // If user is not authenticated and not on signin page, redirect to signin
      if (!user && pathname !== '/signin') {
        router.push('/signin')
      }
      // If user is authenticated and on signin page, redirect to dashboard
      if (user && pathname === '/signin') {
        router.push('/dashboard')
      }
    }
  }, [user, loading, pathname, router])

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      router.push('/signin')
    } catch (error) {
      console.error('Failed to sign out:', error)
    }
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-rurikon-500">Loading...</div>
      </div>
    )
  }

  // Show signin page without protection
  if (pathname === '/signin') {
    return <>{children}</>
  }

  // Protect all other admin routes
  if (!user) {
    return null // Will redirect in useEffect
  }

  // Dashboard layout with sidebar
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64  flex flex-col">
        {/* Logo/Header */}
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-2xl font-bold">Admin Panel</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <Link
            href="/dashboard"
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              pathname === '/dashboard'
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span className="font-medium">Dashboard</span>
          </Link>

          <Link
            href="/dashboard/photos"
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              pathname === '/dashboard/photos'
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span className="font-medium">Photo Management</span>
          </Link>
        </nav>

        {/* User Info & Sign Out */}
        <div className="p-4 border-t border-gray-700">
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">Signed in as</div>
            <div className="text-sm font-medium truncate" title={user?.email || ''}>
              {user?.email}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full px-4 py-2 hover:bg-red-700 rounded-lg transition-colors font-medium text-sm"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50">
        {children}
      </main>
    </div>
  )
}
