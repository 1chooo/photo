'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
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

  return <>{children}</>
}
