'use client'

import { ViewTransition } from 'react'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { useAuth } from '@/lib/firebase/useAuth'
import DashboardNavbar from '@/components/dashboard-navbar'

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

  // Dashboard layout with navbar
  return (
    <>
      <div className="fixed sm:hidden h-6 sm:h-10 md:h-14 w-full top-0 left-0 z-30 pointer-events-none content-fade-out" />
      <div className="flex flex-col mobile:flex-row">
        <DashboardNavbar user={user} handleSignOut={handleSignOut} />
        <main className="relative flex-1 contain-[inline-size]">
          <div className="absolute w-full h-px opacity-50 bg-rurikon-border right-0 mobile:right-auto mobile:left-0 mobile:w-px mobile:h-full mobile:opacity-100 mix-blend-multiply" />
          <ViewTransition name="crossfade">
            <article className="pl-0 pt-6 mobile:pt-0 mobile:pl-6 sm:pl-10 md:pl-14">
              {children}
            </article>
          </ViewTransition>
        </main>
      </div>
    </>
  )
}
