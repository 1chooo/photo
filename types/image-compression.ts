/**
 * Shared type definitions for image compression components
 */

export interface ExifData {
  make?: string
  model?: string
  dateTime?: string
  exposureTime?: string
  fNumber?: string
  iso?: string
  focalLength?: string
  lensModel?: string
  imageWidth?: number
  imageHeight?: number
  gps?: {
    latitude?: number
    longitude?: number
  }
}

export interface CompressedImage {
  id: string
  originalName: string
  originalSize: number
  compressedSize: number
  downloadUrl: string
  previewUrl: string
  hasExif: boolean
  exifData: ExifData | null
}

export interface PendingFile {
  id: string
  file: File
  previewUrl: string
  exifData: ExifData | null
}

export interface CompressionProgress {
  current: number
  total: number
}

export interface CompressionOptions {
  quality: number
  format?: "webp" | "jpeg" | "png" | "avif"
  maxSizeMB?: number
  maxWidthOrHeight?: number
  preserveExif?: boolean
}
