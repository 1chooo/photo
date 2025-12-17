'use client'

import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { useAuth } from '@/lib/firebase/useAuth'

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      router.push('/signin')
    } catch (error) {
      console.error('Failed to sign out:', error)
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 hover:border-red-300 transition-colors font-medium"
          >
            Sign Out
          </button>
        </div>

        <div className="space-y-6">
          <div className="p-6 border border-rurikon-border rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Welcome!</h2>
            <p className="text-rurikon-500">
              You are signed in as: <span className="font-medium">{user?.email}</span>
            </p>
          </div>

          <div className="p-6 border border-rurikon-border rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Dashboard Content</h2>
            <p className="text-rurikon-500">
              This is your admin dashboard. You can add your admin functionalities here.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
