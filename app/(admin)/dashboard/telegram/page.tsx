'use client'

import { useAuth } from '@/lib/firebase/useAuth'
import { useState, useRef } from 'react'
import useSWR, { mutate } from 'swr'
import { Upload, Image as ImageIcon, CheckCircle, AlertCircle, X, Trash2, Copy } from 'lucide-react'

interface UploadedImage {
  id: string
  url: string
  file_id: string
  file_name: string
  file_size: number
  file_type?: string
  uploaded_by?: string
  uploaded_at: string
  alt?: string
}

const fetcher = async (url: string) => {
  const auth = (await import('firebase/auth')).getAuth()
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  
  const token = await user.getIdToken()
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export default function TelegramUploadPage() {
  const { user } = useAuth()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 使用 SWR 從 DB 獲取圖片
  const { data, error: fetchError, isLoading } = useSWR<{ images: UploadedImage[] }>(
    user ? '/api/telegram/images' : null,
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 30000, // 每 30 秒自動刷新
    }
  )

  const uploadedImages = data?.images || []

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 驗證文件類型
    if (!file.type.startsWith('image/')) {
      setError('請選擇圖片文件')
      return
    }

    // 驗證文件大小 (10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      setError('文件大小不能超過 10MB')
      return
    }

    setSelectedFile(file)
    setError(null)
    setSuccess(null)

    // 創建預覽
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    if (!selectedFile || !user) return

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      // 獲取 Firebase ID Token
      const idToken = await user.getIdToken()

      // 準備 FormData
      const formData = new FormData()
      formData.append('file', selectedFile)

      // 上傳到 API
      const response = await fetch('/api/telegram/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '上傳失敗')
      }

      // 重新驗證 SWR 數據
      await mutate('/api/telegram/images')
      setSuccess('照片上傳成功！')
      
      // 清空選擇
      setSelectedFile(null)
      setPreviewUrl(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗，請重試')
    } finally {
      setUploading(false)
    }
  }

  const handleRemovePreview = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (imageId: string) => {
    if (!confirm('確定要刪除這張照片嗎？')) return

    try {
      const idToken = await user!.getIdToken()
      const response = await fetch(`/api/telegram/images?id=${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      })

      if (!response.ok) {
        throw new Error('刪除失敗')
      }

      await mutate('/api/telegram/images')
      setSuccess('照片已刪除')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗')
      setTimeout(() => setError(null), 3000)
    }
  }

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopySuccess(url)
      setTimeout(() => setCopySuccess(null), 2000)
    } catch (err) {
      console.error('複製失敗:', err)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="pb-6 sm:pb-10 md:pb-14">
      <h1 className="font-semibold mb-7 text-rurikon-600">Telegram Upload</h1>
      
      <div className="max-w-3xl">
        {/* Upload Section */}
        <div className="mb-10">
          <div className="border-2 border-dashed border-rurikon-200 rounded-lg p-8 text-center hover:border-rurikon-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            
            {!previewUrl ? (
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="w-12 h-12 text-rurikon-300 mb-4" />
                <p className="text-rurikon-600 mb-2">
                  點擊選擇圖片或拖放到這裡
                </p>
                <p className="text-sm text-rurikon-400">
                  支持 JPG, PNG, GIF 等格式，最大 10MB
                </p>
              </label>
            ) : (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-64 rounded-lg shadow-lg"
                  />
                  <button
                    onClick={handleRemovePreview}
                    className="absolute top-2 right-2 bg-rurikon-800 text-white p-2 rounded-full hover:bg-rurikon-900 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-sm text-rurikon-600">
                  <p className="font-medium">{selectedFile?.name}</p>
                  <p className="text-rurikon-400">{formatFileSize(selectedFile?.size || 0)}</p>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="px-6 py-2 bg-rurikon-600 text-white rounded-lg hover:bg-rurikon-700 disabled:bg-rurikon-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {uploading ? '上傳中...' : '上傳到 Telegram'}
                </button>
              </div>
            )}
          </div>

          {/* Messages */}
          {error && (
            <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="mt-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <p>{success}</p>
            </div>
          )}
        </div>

        {/* Uploaded Images History */}
        {isLoading && (
          <div className="text-center py-8 text-rurikon-400">
            載入中...
          </div>
        )}

        {fetchError && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            無法載入圖片列表，請重新整理頁面
          </div>
        )}

        {!isLoading && !fetchError && uploadedImages.length > 0 && (
          <div>
            <h2 className="font-semibold mb-4 text-rurikon-600 flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              已上傳的照片 ({uploadedImages.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {uploadedImages.map((image) => (
                <div
                  key={image.id}
                  className="border border-rurikon-200 rounded-lg p-4 hover:border-rurikon-400 transition-colors"
                >
                  <div className="flex flex-col gap-4">
                    <div className="relative flex-shrink-0">
                      <img
                        src={image.url}
                        alt={image.file_name}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => handleDelete(image.id)}
                        className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-lg"
                        title="刪除照片"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 space-y-2 text-sm">
                      <div>
                        <span className="text-rurikon-400">檔案名稱：</span>
                        <span className="text-rurikon-600 font-medium">{image.file_name}</span>
                      </div>
                      <div>
                        <span className="text-rurikon-400">大小：</span>
                        <span className="text-rurikon-600">{formatFileSize(image.file_size)}</span>
                      </div>
                      <div>
                        <span className="text-rurikon-400">File ID：</span>
                        <code className="text-rurikon-600 bg-rurikon-50 px-2 py-1 rounded text-xs break-all">
                          {image.file_id}
                        </code>
                      </div>
                      {image.uploaded_by && (
                        <div>
                          <span className="text-rurikon-400">上傳者：</span>
                          <span className="text-rurikon-600">{image.uploaded_by}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-rurikon-400">上傳時間：</span>
                        <span className="text-rurikon-600">{formatDate(image.uploaded_at)}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-rurikon-400 flex-shrink-0">URL：</span>
                        <div className="flex-1 min-w-0">
                          <a
                            href={image.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-rurikon-500 hover:text-rurikon-700 underline break-all block"
                          >
                            {image.url}
                          </a>
                          <button
                            onClick={() => handleCopyUrl(image.url)}
                            className="mt-1 inline-flex items-center gap-1 text-xs text-rurikon-500 hover:text-rurikon-700 transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            {copySuccess === image.url ? '已複製！' : '複製 URL'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && !fetchError && uploadedImages.length === 0 && (
          <div className="text-center py-8 text-rurikon-400">
            尚未上傳任何照片
          </div>
        )}
      </div>
    </div>
  )
}
