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

interface FailedUpload {
  file: File
  fileName: string
  error: string
  errorType: 'network' | 'validation' | 'telegram' | 'server' | 'unknown'
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)
  const [failedUploads, setFailedUploads] = useState<FailedUpload[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch uploaded images using SWR
  const { data, error: fetchError, isLoading } = useSWR<{ images: UploadedImage[] }>(
    user ? '/api/telegram/images' : null,
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 30000, // refresh every 30 seconds
    }
  )

  const uploadedImages = data?.images || []

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Validate files
    const maxSize = 10 * 1024 * 1024
    const validFiles: File[] = []
    const errors: string[] = []

    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: Invalid file type`)
      } else if (file.size > maxSize) {
        errors.push(`${file.name}: File size exceeds 10MB`)
      } else {
        validFiles.push(file)
      }
    })

    if (errors.length > 0) {
      setError(errors.join('\n'))
    } else {
      setError(null)
    }

    if (validFiles.length === 0) return

    setSelectedFiles(validFiles)
    setSuccess(null)

    // Prepare preview URLs
    const previews: string[] = []
    let loadedCount = 0

    validFiles.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        previews.push(reader.result as string)
        loadedCount++
        if (loadedCount === validFiles.length) {
          setPreviewUrls(previews)
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const handleUpload = async (filesToUpload?: File[]) => {
    const files = filesToUpload || selectedFiles
    if (files.length === 0 || !user) return

    setUploading(true)
    setError(null)
    setSuccess(null)
    const failed: FailedUpload[] = []
    setUploadProgress({ current: 0, total: files.length })

    try {
      const idToken = await user.getIdToken()
      let successCount = 0

      // Upload files one by one to track progress
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadProgress({ current: i + 1, total: files.length })

        try {
          const formData = new FormData()
          formData.append('file', file)

          const response = await fetch('/api/telegram/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${idToken}`,
            },
            body: formData,
          })

          const data = await response.json()

          if (!response.ok) {
            // 分類錯誤類型
            let errorType: FailedUpload['errorType'] = 'unknown'
            let errorMessage = data.error || 'Upload failed'

            if (response.status === 400) {
              errorType = 'validation'
            } else if (response.status === 401 || response.status === 403) {
              errorType = 'server'
              errorMessage = 'Authentication error. Please log in again.'
            } else if (response.status === 500) {
              errorType = 'server'
            } else if (errorMessage.includes('Telegram')) {
              errorType = 'telegram'
            }

            failed.push({
              file,
              fileName: file.name,
              error: errorMessage,
              errorType,
            })
          } else {
            successCount++
          }
        } catch (err) {
          // Catch network or unexpected errors
          failed.push({
            file,
            fileName: file.name,
            error: err instanceof Error ? err.message : 'Network error or unexpected error',
            errorType: 'network',
          })
        }
      }

      // Refresh uploaded images list
      await mutate('/api/telegram/images')

      setFailedUploads(failed)

      if (failed.length > 0) {
        setError(`Uploaded ${successCount} out of ${files.length} images. ${failed.length} failed.`)
      } else {
        setSuccess(`Uploaded all ${files.length} images successfully!`)
        setFailedUploads([])
      }

      // Clear selected files only if all were uploaded successfully
      if (!filesToUpload && failed.length === 0) {
        setSelectedFiles([])
        setPreviewUrls([])
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗，請重試')
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  const handleRemovePreview = (index?: number) => {
    if (index !== undefined) {
      // Remove specific file
      setSelectedFiles(prev => prev.filter((_, i) => i !== index))
      setPreviewUrls(prev => prev.filter((_, i) => i !== index))
    } else {
      // Clear all
      setSelectedFiles([])
      setPreviewUrls([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRetryFailed = async () => {
    if (failedUploads.length === 0) return
    const filesToRetry = failedUploads.map(f => f.file)
    setFailedUploads([])
    await handleUpload(filesToRetry)
  }

  const handleRemoveFailed = (index: number) => {
    setFailedUploads(prev => prev.filter((_, i) => i !== index))
  }

  const getErrorTypeLabel = (type: FailedUpload['errorType']) => {
    switch (type) {
      case 'network': return 'Network Error'
      case 'validation': return 'Validation Error'
      case 'telegram': return 'Telegram API Error'
      case 'server': return 'Server Error'
      default: return 'Unknown Error'
    }
  }

  const handleDelete = async (imageId: string) => {
    if (!confirm('Sure to delete this image?')) return

    try {
      const idToken = await user!.getIdToken()
      const response = await fetch(`/api/telegram/images?id=${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete image')
      }

      await mutate('/api/telegram/images')
      setSuccess('Image deleted successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid delete operation')
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
    // Main Container: Fixed height relative to viewport (adjust calculation as needed)
    <div className="h-[calc(100vh-80px)] w-full overflow-hidden p-4">
      <div className="flex h-full gap-6">
        
        {/* Left Side: Upload & Controls */}
        <div className="w-1/2 flex flex-col h-full overflow-hidden bg-white rounded-xl shadow-sm border border-rurikon-100">
          <div className="p-4 border-b border-rurikon-100 shrink-0">
             <h1 className="font-semibold text-rurikon-600 text-lg">Upload Zone</h1>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
             <div className="border-2 border-dashed border-rurikon-200 rounded-lg p-8 text-center hover:border-rurikon-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />

              {previewUrls.length === 0 ? (
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className="w-12 h-12 text-rurikon-300 mb-4" />
                  <p className="text-rurikon-600 mb-2">
                    Click to select images or drag and drop here
                  </p>
                  <p className="text-sm text-rurikon-400">
                    Support JPG, PNG, GIF up to 10MB each
                  </p>
                </label>
              ) : (
                <div className="space-y-4">
                  {/* Selected Drafts Preview */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {previewUrls.map((url, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={url}
                          alt={`Preview ${index + 1}`}
                          className="w-full aspect-square object-cover rounded-lg shadow-lg"
                        />
                        <button
                          onClick={() => handleRemovePreview(index)}
                          className="absolute top-2 right-2 bg-rurikon-800 text-white p-1.5 rounded-full hover:bg-rurikon-900 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-2 rounded-b-lg">
                          <p className="text-xs text-white truncate">{selectedFiles[index]?.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-rurikon-600">
                    <p>
                      Chosen {selectedFiles.length} image{selectedFiles.length > 1 ? 's' : ''}
                    </p>
                    <button
                      onClick={() => handleRemovePreview()}
                      className="text-rurikon-500 hover:text-rurikon-700 underline"
                    >
                      Clear All
                    </button>
                  </div>
                  
                  {uploadProgress && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-rurikon-600">
                        <span>
                          Uploading...
                        </span>
                        <span>{uploadProgress.current} / {uploadProgress.total}</span>
                      </div>
                      <div className="w-full bg-rurikon-100 rounded-full h-2">
                        <div
                          className="bg-rurikon-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => handleUpload()}
                    disabled={uploading}
                    className="w-full px-6 py-2 bg-rurikon-600 text-white rounded-lg hover:bg-rurikon-700 disabled:bg-rurikon-300 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {uploading ? `上傳中... (${uploadProgress?.current || 0}/${uploadProgress?.total || 0})` : `上傳 ${selectedFiles.length} 張到 Telegram`}
                  </button>
                </div>
              )}
            </div>

            {/* Messages */}
            {error && (
              <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="whitespace-pre-wrap">{error}</p>
              </div>
            )}

            {success && (
              <div className="mt-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <p>{success}</p>
              </div>
            )}

            {/* Failed Uploads Details */}
            {failedUploads.length > 0 && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-red-900 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Failed Uploads ({failedUploads.length})
                  </h3>
                  <button
                    onClick={handleRetryFailed}
                    disabled={uploading}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {uploading ? 'Retrying...' : 'Retry All'}
                  </button>
                </div>
                <div className="space-y-2">
                  {failedUploads.map((failed, index) => (
                    <div key={index} className="bg-white border border-red-200 rounded p-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-red-900 truncate">{failed.fileName}</p>
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                            {getErrorTypeLabel(failed.errorType)}
                          </span>
                        </div>
                        <p className="text-sm text-red-700">{failed.error}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveFailed(index)}
                        className="text-red-400 hover:text-red-600 transition-colors shrink-0"
                        title="移除此項"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Uploaded History Preview */}
        <div className="w-1/2 flex flex-col h-full overflow-hidden bg-white rounded-xl shadow-sm border border-rurikon-100">
           <div className="p-4 border-b border-rurikon-100 shrink-0 flex items-center justify-between">
              <h2 className="font-semibold text-rurikon-600 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Uploaded History
              </h2>
              <span className="text-sm text-rurikon-400">
                {uploadedImages.length} items
              </span>
           </div>

           <div className="flex-1 overflow-y-auto p-6">
              {isLoading && (
                <div className="text-center py-8 text-rurikon-400">
                  Loading uploaded images...
                </div>
              )}

              {fetchError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                  Cannot load uploaded images: {fetchError.message}
                </div>
              )}

              {!isLoading && !fetchError && uploadedImages.length > 0 && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {uploadedImages.map((image) => (
                    <div
                      key={image.id}
                      className="border border-rurikon-200 rounded-lg p-4 hover:border-rurikon-400 transition-colors bg-white"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="relative shrink-0">
                          <img
                            src={image.url}
                            alt={image.file_name}
                            className="w-full h-48 object-cover rounded-lg bg-gray-50"
                          />
                          <button
                            onClick={() => handleDelete(image.id)}
                            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-lg opacity-90 hover:opacity-100"
                            title="刪除照片"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex-1 space-y-2 text-sm">
                          <div>
                            <span className="text-rurikon-400 block text-xs uppercase tracking-wide">File Name</span>
                            <span className="text-rurikon-600 font-medium truncate block">{image.file_name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-rurikon-400 block text-xs uppercase tracking-wide">Size</span>
                                <span className="text-rurikon-600">{formatFileSize(image.file_size)}</span>
                            </div>
                            <div>
                                <span className="text-rurikon-400 block text-xs uppercase tracking-wide">Date</span>
                                <span className="text-rurikon-600 truncate">{formatDate(image.uploaded_at).split(' ')[0]}</span>
                            </div>
                          </div>
                          
                          <div>
                            <span className="text-rurikon-400 block text-xs uppercase tracking-wide">URL</span>
                            <div className="flex items-center gap-2 mt-1">
                                <a
                                  href={image.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-rurikon-500 hover:text-rurikon-700 underline truncate flex-1"
                                >
                                  Link
                                </a>
                                <button
                                  onClick={() => handleCopyUrl(image.url)}
                                  className="shrink-0 inline-flex items-center gap-1 text-xs bg-rurikon-50 hover:bg-rurikon-100 text-rurikon-600 px-2 py-1 rounded transition-colors border border-rurikon-200"
                                >
                                  <Copy className="w-3 h-3" />
                                  {copySuccess === image.url ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isLoading && !fetchError && uploadedImages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-rurikon-300">
                  <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
                  <p>No uploaded images yet.</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  )
}
