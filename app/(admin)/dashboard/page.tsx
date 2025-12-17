'use client'

import { useAuth } from '@/lib/firebase/useAuth'
import useSWR, { mutate } from 'swr'
import { Folder, Camera, CheckCircle, RefreshCw } from 'lucide-react'

interface SystemStats {
  totalGalleries: number
  totalPhotos: number
  recentActivity: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardPage() {
  const { user } = useAuth()
  const { data, error, isLoading } = useSWR('/api/photos', fetcher, {
    refreshInterval: 30000, // Auto refresh every 30 seconds
    revalidateOnFocus: true,
  });

  const galleries = data?.galleries || [];
  const totalPhotos = galleries.reduce((sum: number, gallery: any) => 
    sum + (gallery.photos?.length || 0), 0
  );

  const stats: SystemStats = {
    totalGalleries: galleries.length,
    totalPhotos,
    recentActivity: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  };

  return (
    <div>
      <div>
        <h1 className="font-semibold mb-7 text-rurikon-600">Admin</h1>
        <p className="mt-7 text-rurikon-600 lowercase">Welcome back, {user?.email?.split('@')[0]}!</p>

        {error && (
          <div className="mt-7 bg-rurikon-50 border border-rurikon-200 text-rurikon-800 px-4 py-3 rounded">
            Failed to load dashboard data. Please try again.
          </div>
        )}

        {/* Stats Grid */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-rurikon-100 border-l-4 border-l-rurikon-600 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-rurikon-50 border border-rurikon-200 flex items-center justify-center">
                <Folder className="h-5 w-5 text-rurikon-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-rurikon-400 lowercase">Total Galleries</p>
                <p className="text-2xl font-semibold text-rurikon-600 mt-1">
                  {isLoading ? (
                    <span className="animate-pulse">...</span>
                  ) : (
                    stats.totalGalleries
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-rurikon-100 border-l-4 border-l-rurikon-600 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-rurikon-50 border border-rurikon-200 flex items-center justify-center">
                <Camera className="h-5 w-5 text-rurikon-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-rurikon-400 lowercase">Total Photos</p>
                <p className="text-2xl font-semibold text-rurikon-600 mt-1">
                  {isLoading ? (
                    <span className="animate-pulse">...</span>
                  ) : (
                    stats.totalPhotos
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-green-100 border-l-4 border-l-green-500 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-rurikon-400 lowercase">Account Status</p>
                <p className="text-lg font-semibold text-green-600 mt-1 lowercase">Active</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-7 bg-white rounded-lg border border-rurikon-100 p-6">
          <h2 className="font-semibold mb-7 text-rurikon-600 lowercase">System Information</h2>
          <div>
            <div className="flex justify-between py-3 border-b border-rurikon-100">
              <span className="text-rurikon-600 lowercase">Last Activity</span>
              <span className="text-rurikon-600">{stats.recentActivity}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-rurikon-100">
              <span className="text-rurikon-600 lowercase">User Email</span>
              <span className="text-rurikon-600">{user?.email}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-rurikon-100">
              <span className="text-rurikon-600 lowercase">User ID</span>
              <span className="font-mono text-sm text-rurikon-600">{user?.uid}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-rurikon-600 lowercase">Account Created</span>
              <span className="text-rurikon-600">
                {user?.metadata?.creationTime || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-7 bg-white rounded-lg border border-rurikon-100 p-6">
          <h2 className="font-semibold mb-7 text-rurikon-600 lowercase">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="/dashboard/photos"
              className="flex items-center space-x-4 p-4 bg-rurikon-50 border-2 border-rurikon-200 rounded-lg hover:bg-rurikon-100 hover:border-rurikon-300 transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-white border border-rurikon-200 flex items-center justify-center shrink-0">
                <Camera className="h-5 w-5 text-rurikon-600" />
              </div>
              <div>
                <h3 className="font-semibold text-rurikon-600 lowercase">Manage Photos</h3>
                <p className="text-sm text-rurikon-600 lowercase">Add, edit, or remove photos from galleries</p>
              </div>
            </a>

            <button
              onClick={() => mutate('/api/photos')}
              className="flex items-center space-x-4 p-4 bg-rurikon-50 border-2 border-rurikon-200 rounded-lg hover:bg-rurikon-100 hover:border-rurikon-300 transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-white border border-rurikon-200 flex items-center justify-center shrink-0">
                <RefreshCw className="h-5 w-5 text-rurikon-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-rurikon-600 lowercase">Refresh Stats</h3>
                <p className="text-sm text-rurikon-600 lowercase">Update dashboard statistics</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
