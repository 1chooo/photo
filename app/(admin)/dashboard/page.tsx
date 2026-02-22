'use client'

import { useAuth } from '@/lib/firebase/useAuth'
import useSWR, { mutate } from 'swr'
import { 
  Folder, 
  RefreshCw, 
  Image as ImageIcon, 
  Pin, 
  LayoutDashboard,
  Clock,
  ArrowUpRight,
  Activity,
  User,
  Calendar
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface SystemStats {
  totalCategories: number
  totalImages: number
  totalHomepageImages: number
  recentActivity: string
}

const fetcher = async (url: string, token?: string) => {
  const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {}
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [idToken, setIdToken] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      user.getIdToken().then(setIdToken)
    }
  }, [user])

  // 從 Telegram Images API 獲取圖片資料
  const { data: imagesData, error: imagesError, isLoading: imagesLoading } = useSWR(
    idToken ? ['/api/images', idToken] : null,
    ([url, token]) => fetcher(url, token),
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 0,
    }
  )

  // 從 Category API 獲取分類資料
  const { data: categoriesData, error: categoriesError, isLoading: categoriesLoading } = useSWR(
    idToken ? ['/api/category', idToken] : null,
    ([url, token]) => fetcher(url, token),
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 0,
    }
  )

  // 從 Homepage API 獲取首頁精選圖片
  const { data: homepageData, error: homepageError, isLoading: homepageLoading } = useSWR(
    '/api/homepage',
    (url) => fetcher(url),
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 0,
    }
  )

  const totalImages = imagesData?.images?.length || 0
  const totalCategories = categoriesData?.categories?.length || 0
  const totalHomepageImages = homepageData?.selectedPhotos?.length || 0

  const stats: SystemStats = {
    totalCategories,
    totalImages,
    totalHomepageImages,
    recentActivity: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isLoading = imagesLoading || categoriesLoading || homepageLoading
  const error = imagesError || categoriesError || homepageError

  // UI Components helpers
  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    colorClass, 
    bgClass 
  }: { 
    title: string; 
    value: number; 
    icon: any; 
    colorClass: string; 
    bgClass: string 
  }) => (
    <div className="bg-white rounded-xl border border-rurikon-100 p-6 shadow-sm hover:shadow-md transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className={`text-3xl font-bold ${colorClass}`}>
              {isLoading ? (
                <div className="h-9 w-16 bg-gray-100 rounded animate-pulse" />
              ) : (
                value
              )}
            </h3>
          </div>
        </div>
        <div className={`p-3 rounded-lg ${bgClass} transition-colors group-hover:scale-110 duration-300`}>
          <Icon className={`h-6 w-6 ${colorClass}`} />
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-10">
      
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-rurikon-800 flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-rurikon-600" />
            Dashboard
          </h1>
          <p className="mt-2 text-gray-500">
            Welcome back, <span className="font-semibold text-rurikon-600">{user?.email?.split('@')[0]}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
          <Clock className="h-4 w-4" />
          <span>{stats.recentActivity}</span>
        </div>
      </div>

      {error && (
        <div className="mb-8 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Failed to load dashboard data. Please try again.
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard 
          title="Total Categories" 
          value={stats.totalCategories} 
          icon={Folder} 
          colorClass="text-rurikon-600" 
          bgClass="bg-rurikon-50" 
        />
        <StatCard 
          title="Total Images" 
          value={stats.totalImages} 
          icon={ImageIcon} 
          colorClass="text-blue-600" 
          bgClass="bg-blue-50" 
        />
        <StatCard 
          title="Homepage Pinned" 
          value={stats.totalHomepageImages} 
          icon={Pin} 
          colorClass="text-purple-600" 
          bgClass="bg-purple-50" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Quick Actions (Takes up 2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-rurikon-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                Quick Actions
              </h2>
              <button
                onClick={() => {
                  if (idToken) {
                    mutate(['/api/images', idToken])
                    mutate(['/api/category', idToken])
                  }
                  mutate('/api/homepage')
                }}
                className="text-xs flex items-center gap-1 text-rurikon-600 hover:text-rurikon-800 transition-colors bg-rurikon-50 px-2 py-1 rounded hover:bg-rurikon-100 cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Data
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a
                href="/dashboard/upload"
                className="group relative flex flex-col p-5 bg-white border border-gray-200 rounded-xl hover:border-rurikon-300 hover:shadow-md transition-all duration-200"
              >
                <div className="absolute top-4 right-4 text-gray-300 group-hover:text-rurikon-400 transition-colors">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3 text-blue-600 group-hover:scale-110 transition-transform">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-gray-800 group-hover:text-rurikon-600 transition-colors">Upload Images</h3>
                <p className="text-sm text-gray-500 mt-1">Upload photos directly via Telegram storage integration.</p>
              </a>

              <a
                href="/dashboard/category"
                className="group relative flex flex-col p-5 bg-white border border-gray-200 rounded-xl hover:border-rurikon-300 hover:shadow-md transition-all duration-200"
              >
                <div className="absolute top-4 right-4 text-gray-300 group-hover:text-rurikon-400 transition-colors">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center mb-3 text-orange-600 group-hover:scale-110 transition-transform">
                  <Folder className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-gray-800 group-hover:text-rurikon-600 transition-colors">Manage Categories</h3>
                <p className="text-sm text-gray-500 mt-1">Organize your uploaded images into specific collections.</p>
              </a>

              <a
                href="/dashboard/homepage"
                className="group relative flex flex-col p-5 bg-white border border-gray-200 rounded-xl hover:border-rurikon-300 hover:shadow-md transition-all duration-200 md:col-span-2"
              >
                <div className="absolute top-4 right-4 text-gray-300 group-hover:text-rurikon-400 transition-colors">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0 text-purple-600 group-hover:scale-110 transition-transform">
                    <Pin className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 group-hover:text-rurikon-600 transition-colors">Homepage Gallery</h3>
                    <p className="text-sm text-gray-500 mt-1">Select and reorder featured images for your public homepage display.</p>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* System Info (Takes up 1 column) */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-rurikon-100 p-6 shadow-sm h-full">
            <h2 className="font-semibold text-gray-800 mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-400" />
              System Status
            </h2>
            
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                  <User className="w-3 h-3" /> User Account
                </div>
                <div className="text-sm font-medium text-gray-800 truncate" title={user?.email || ''}>
                  {user?.email}
                </div>
                <div className="text-xs text-gray-400 font-mono mt-1 truncate" title={user?.uid}>
                  ID: {user?.uid}
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                  <Calendar className="w-3 h-3" /> Member Since
                </div>
                <div className="text-sm font-medium text-gray-800">
                  {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'N/A'}
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                 <div className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                  <Clock className="w-3 h-3" /> Last Activity
                </div>
                <div className="text-sm font-medium text-gray-800">
                   {stats.recentActivity}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
