"use client"

import type React from "react"
import JSZip from "jszip"
import imageCompression from "browser-image-compression"
import { toast } from "sonner"
import { useState, useCallback, useEffect } from "react"
import { Loader2, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { FilesManager } from "./image-compression/files-manager"
import { QualityControl } from "./image-compression/quality-control"
import { CompressedImagesList } from "./image-compression/compressed-images-list"
import { ImagePreviewDialog } from "./image-compression/image-preview-dialog"
import { parseExif, checkCompressedExif, type ExifData } from "@/lib/exif-parser"
import { formatSize, calculateSavings } from "@/lib/image-utils"

interface CompressedImage {
  id: string
  originalName: string
  originalSize: number
  compressedSize: number
  downloadUrl: string
  previewUrl: string
  hasExif: boolean
  exifData: ExifData | null
}

interface PendingFile {
  id: string
  file: File
  previewUrl: string
  exifData: ExifData | null
}

export function ImageCompressor() {
  const [isDragging, setIsDragging] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [quality, setQuality] = useState(80)
  const [compressedImages, setCompressedImages] = useState<CompressedImage[]>([])
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [compressionProgress, setCompressionProgress] = useState<{
    current: number
    total: number
  } | null>(null)
  const [previewImage, setPreviewImage] = useState<CompressedImage | null>(null)

  // Keyboard shortcut for file selection (Cmd/Ctrl + O)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+O (Mac) or Ctrl+O (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "o") {
        e.preventDefault()
        document.getElementById("file-input")?.click()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleFilesSelection = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"))

    const newPendingFiles: PendingFile[] = await Promise.all(
      fileArray.map(async (file) => {
        const previewUrl = URL.createObjectURL(file)
        const exifData = await parseExif(file)
        return {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          previewUrl,
          exifData,
        }
      })
    )

    setPendingFiles((prev) => [...prev, ...newPendingFiles])
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const files = e.dataTransfer.files
      if (files.length > 0) {
        handleFilesSelection(files)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        handleFilesSelection(files)
      }
      e.target.value = ""
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const handleCompressAll = async () => {
    if (pendingFiles.length === 0) return

    setIsCompressing(true)
    setCompressionProgress({ current: 0, total: pendingFiles.length })

    toast.info(
      `Starting compression of ${pendingFiles.length} image${pendingFiles.length > 1 ? "s" : ""}...`
    )

    let successCount = 0
    let failCount = 0

    for (let i = 0; i < pendingFiles.length; i++) {
      const pending = pendingFiles[i]
      setCompressionProgress({ current: i + 1, total: pendingFiles.length })

      try {
        let fileToUpload = pending.file
        const fileSizeMB = pending.file.size / 1024 / 1024

        if (fileSizeMB > 3) {
          toast.loading(`Pre-compressing ${pending.file.name} (${fileSizeMB.toFixed(1)}MB)...`, {
            id: `compress-${pending.id}`,
          })

          const options = {
            maxSizeMB: 3.5,
            maxWidthOrHeight: 4096,
            useWebWorker: true,
            fileType: pending.file.type,
            preserveExif: true,
          }

          try {
            fileToUpload = await imageCompression(pending.file, options)
            console.log(
              `Pre-compressed ${pending.file.name} from ${fileSizeMB.toFixed(2)}MB to ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`
            )
          } catch (compressionError) {
            console.warn("Client-side compression failed, trying original file:", compressionError)
          }
        }

        toast.loading(`Converting ${pending.file.name} to WebP...`, {
          id: `compress-${pending.id}`,
        })

        const formData = new FormData()
        formData.append("image", fileToUpload)
        formData.append("quality", quality.toString())

        const response = await fetch("/api/compress", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) throw new Error("Compression failed")

        const blob = await response.blob()
        const downloadUrl = URL.createObjectURL(blob)

        const hasExif = await checkCompressedExif(blob)
        const compressedExifData = hasExif
          ? await parseExif(new File([blob], "compressed.webp"))
          : null

        const compressedImage: CompressedImage = {
          id: pending.id,
          originalName: pending.file.name,
          originalSize: pending.file.size,
          compressedSize: blob.size,
          downloadUrl,
          previewUrl: downloadUrl,
          hasExif,
          exifData: compressedExifData,
        }

        // Add compressed image immediately to the list
        setCompressedImages((prev) => [compressedImage, ...prev])

        successCount++
        toast.success(`✓ ${pending.file.name}`, {
          id: `compress-${pending.id}`,
          description: `${formatSize(pending.file.size)} → ${formatSize(blob.size)} (-${calculateSavings(pending.file.size, blob.size)}%)`,
        })
      } catch (error) {
        failCount++
        console.error(`Failed to compress ${pending.file.name}:`, error)
        toast.error(`Failed to compress ${pending.file.name}`, {
          id: `compress-${pending.id}`,
          description: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    pendingFiles.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    setPendingFiles([])
    setCompressionProgress(null)
    setIsCompressing(false)

    if (successCount > 0 && failCount === 0) {
      toast.success(
        `All ${successCount} image${successCount > 1 ? "s" : ""} compressed successfully! 🎉`
      )
    } else if (successCount > 0 && failCount > 0) {
      toast.warning(`Compression complete: ${successCount} succeeded, ${failCount} failed`)
    } else if (failCount > 0) {
      toast.error(`All ${failCount} image${failCount > 1 ? "s" : ""} failed to compress`)
    }
  }

  const removePendingFile = (id: string) => {
    setPendingFiles((prev) => {
      const file = prev.find((p) => p.id === id)
      if (file) URL.revokeObjectURL(file.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  const clearAllPending = () => {
    pendingFiles.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    setPendingFiles([])
  }

  const clearAllCompressed = () => {
    compressedImages.forEach((img) => URL.revokeObjectURL(img.downloadUrl))
    setCompressedImages([])
  }

  const removeCompressedImage = (id: string) => {
    setCompressedImages((prev) => {
      const img = prev.find((i) => i.id === id)
      if (img) URL.revokeObjectURL(img.downloadUrl)
      return prev.filter((i) => i.id !== id)
    })
  }

  const downloadAll = async () => {
    if (compressedImages.length === 0) return

    if (compressedImages.length === 1) {
      const link = document.createElement("a")
      link.href = compressedImages[0].downloadUrl
      link.download = compressedImages[0].originalName.replace(/\.[^.]+$/, ".webp")
      link.click()
      return
    }

    const zip = new JSZip()

    for (const img of compressedImages) {
      const response = await fetch(img.downloadUrl)
      const blob = await response.blob()
      const fileName = img.originalName.replace(/\.[^.]+$/, ".webp")
      zip.file(fileName, blob)
    }

    const zipBlob = await zip.generateAsync({ type: "blob" })
    const url = URL.createObjectURL(zipBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `compressed-images-${Date.now()}.zip`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
        {/* Left side: Upload and pending compression area */}
        <div className="space-y-6">
          <FilesManager
            files={pendingFiles}
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileSelect={handleFileSelect}
            onRemoveFile={removePendingFile}
            onClearAll={clearAllPending}
            formatSize={formatSize}
          />

          <QualityControl quality={quality} onQualityChange={setQuality} />

          {pendingFiles.length > 0 && (
            <Button
              onClick={handleCompressAll}
              disabled={isCompressing}
              className="w-full cursor-pointer"
              size="lg"
            >
              {isCompressing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Compressing ({compressionProgress?.current}/{compressionProgress?.total})...
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Compress All and Convert to WebP
                </>
              )}
            </Button>
          )}
        </div>

        {/* Right side: Compression results */}
        <div className="space-y-4">
          <CompressedImagesList
            images={compressedImages}
            onDownloadAll={downloadAll}
            onClearAll={clearAllCompressed}
            onRemove={removeCompressedImage}
            onPreview={setPreviewImage}
            formatSize={formatSize}
            calculateSavings={calculateSavings}
          />
        </div>
      </div>

      <ImagePreviewDialog
        image={previewImage}
        onClose={() => setPreviewImage(null)}
        formatSize={formatSize}
        calculateSavings={calculateSavings}
      />
    </TooltipProvider>
  )
}
