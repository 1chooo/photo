'use client'

import { useAuth } from '@/lib/firebase/useAuth'
import useSWR, { mutate } from 'swr'

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
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-600 mt-2">Welcome back, {user?.email?.split('@')[0]}!</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
            Failed to load dashboard data. Please try again.
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Galleries</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {isLoading ? '...' : stats.totalGalleries}
                </p>
              </div>
              <div className="text-4xl">📁</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Photos</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {isLoading ? '...' : stats.totalPhotos}
                </p>
              </div>
              <div className="text-4xl">📸</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Account Status</p>
                <p className="text-lg font-bold text-green-600 mt-2">Active</p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">System Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between py-3 border-b border-gray-200">
              <span className="text-gray-600">Last Activity</span>
              <span className="font-medium text-gray-900">{stats.recentActivity}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-200">
              <span className="text-gray-600">User Email</span>
              <span className="font-medium text-gray-900">{user?.email}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-200">
              <span className="text-gray-600">User ID</span>
              <span className="font-mono text-sm text-gray-700">{user?.uid}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-gray-600">Account Created</span>
              <span className="font-medium text-gray-900">
                {user?.metadata?.creationTime || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="/dashboard/photos"
              className="flex items-center space-x-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-colors"
            >
              <span className="text-3xl">📸</span>
              <div>
                <h3 className="font-semibold text-blue-900">Manage Photos</h3>
                <p className="text-sm text-blue-700">Add, edit, or remove photos from galleries</p>
              </div>
            </a>

            <button
              onClick={() => mutate('/api/photos')}
              className="flex items-center space-x-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 hover:border-green-300 transition-colors"
            >
              <span className="text-3xl">🔄</span>
              <div className="text-left">
                <h3 className="font-semibold text-green-900">Refresh Stats</h3>
                <p className="text-sm text-green-700">Update dashboard statistics</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
