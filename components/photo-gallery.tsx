"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Image from "next/image"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BlurFade } from "@/components/ui/blur-fade"
import { cn } from "@/lib/utils"

interface Photo {
  id: string
  src: string
  alt: string
  orientation: "portrait" | "landscape"
}

interface PhotoGalleryProps {
  photos: Photo[]
  className?: string
  targetRowHeight?: number
  gap?: number
}

interface LayoutPhoto extends Photo {
  width: number
  height: number
  originalIndex: number
}

interface Row {
  photos: LayoutPhoto[]
  height: number
}

// Calculate justified layout - photos fill row width with equal height
function calculateJustifiedLayout(
  photos: Photo[],
  containerWidth: number,
  targetRowHeight: number,
  gap: number
): Row[] {
  if (containerWidth <= 0) return []

  const rows: Row[] = []
  let currentRow: LayoutPhoto[] = []
  let currentRowAspectSum = 0

  // Get aspect ratio for each photo (16:9 for landscape, 9:16 for portrait)
  const photosWithAspect = photos.map((photo, index) => ({
    ...photo,
    aspectRatio: photo.orientation === "landscape" ? 16 / 9 : 9 / 16,
    originalIndex: index,
  }))

  for (const photo of photosWithAspect) {
    currentRow.push({ ...photo, width: 0, height: 0, originalIndex: photo.originalIndex })
    currentRowAspectSum += photo.aspectRatio

    // Calculate what height this row would be if we fit all photos
    const totalGapWidth = (currentRow.length - 1) * gap
    const availableWidth = containerWidth - totalGapWidth
    const rowHeight = availableWidth / currentRowAspectSum

    // If row height is less than target, finalize this row
    if (rowHeight <= targetRowHeight) {
      // Calculate final dimensions for each photo in the row
      const finalizedRow = currentRow.map((p) => ({
        ...p,
        width: rowHeight * (p.orientation === "landscape" ? 16 / 9 : 9 / 16),
        height: rowHeight,
      }))

      rows.push({ photos: finalizedRow, height: rowHeight })
      currentRow = []
      currentRowAspectSum = 0
    }
  }

  // Handle remaining photos in the last row
  if (currentRow.length > 0) {
    // Use target height for incomplete last row
    const finalizedRow = currentRow.map((p) => ({
      ...p,
      width: targetRowHeight * (p.orientation === "landscape" ? 16 / 9 : 9 / 16),
      height: targetRowHeight,
    }))
    rows.push({ photos: finalizedRow, height: targetRowHeight })
  }

  return rows
}

export function PhotoGallery({
  photos,
  className,
  targetRowHeight = 280,
  gap = 4
}: PhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Measure container width
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })

    observer.observe(container)
    setContainerWidth(container.offsetWidth)

    return () => observer.disconnect()
  }, [])

  // Calculate justified layout
  const rows = useMemo(() =>
    calculateJustifiedLayout(photos, containerWidth, targetRowHeight, gap),
    [photos, containerWidth, targetRowHeight, gap]
  )

  const openLightbox = (index: number) => {
    setCurrentIndex(index)
    setLightboxOpen(true)
  }

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false)
  }, [])

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? photos.length - 1 : prevIndex - 1
    )
  }, [photos.length])

  const goToNext = useCallback(() => {
    setCurrentIndex((prevIndex) =>
      prevIndex === photos.length - 1 ? 0 : prevIndex + 1
    )
  }, [photos.length])

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          closeLightbox()
          break
        case 'ArrowLeft':
          goToPrevious()
          break
        case 'ArrowRight':
          goToNext()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxOpen, closeLightbox, goToPrevious, goToNext])

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [lightboxOpen])

  let photoIndex = 0

  return (
    <>
      {/* Justified Gallery - photos fill each row, same height per row */}
      <div ref={containerRef} className={cn("w-full", className)}>
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex"
            style={{
              marginBottom: rowIndex < rows.length - 1 ? gap : 0,
              gap: gap,
            }}
          >
            {row.photos.map((photo) => {
              const currentPhotoIndex = photoIndex++
              return (
                <BlurFade
                  key={photo.id}
                  delay={currentPhotoIndex * 0.03}
                  duration={0.4}
                >
                  <button
                    onClick={() => openLightbox(photo.originalIndex)}
                    className="group relative block overflow-hidden"
                    style={{
                      width: photo.width,
                      height: photo.height,
                    }}
                  >
                    <Image
                      src={photo.src || "/placeholder.svg"}
                      alt={photo.alt}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      loading={currentPhotoIndex < 6 ? "eager" : "lazy"}
                      quality={75}
                      sizes={`${Math.round(photo.width)}px`}
                    />
                  </button>
                </BlurFade>
              )
            })}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
          onClick={(e) => {
            // Close when clicking backdrop (not on image or buttons)
            if (e.target === e.currentTarget) {
              closeLightbox()
            }
          }}
        >
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 z-50"
            onClick={closeLightbox}
            aria-label="Close lightbox (ESC)"
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Previous Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 z-50 -translate-y-1/2"
            onClick={goToPrevious}
            aria-label="Previous image (←)"
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>

          {/* Next Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 z-50 -translate-y-1/2"
            onClick={goToNext}
            aria-label="Next image (→)"
          >
            <ChevronRight className="h-8 w-8" />
          </Button>

          {/* Pre-rendered images for instant transitions */}
          <div className="relative h-[80vh] w-[90vw]">
            {photos.map((photo, index) => {
              // Only render current, previous, and next images
              const isCurrent = index === currentIndex
              const isPrev = index === (currentIndex === 0 ? photos.length - 1 : currentIndex - 1)
              const isNext = index === (currentIndex === photos.length - 1 ? 0 : currentIndex + 1)
              
              if (!isCurrent && !isPrev && !isNext) return null
              
              return (
                <div
                  key={photo.id}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-200",
                    isCurrent ? "opacity-100 z-10" : "opacity-0 z-0"
                  )}
                >
                  <Image
                    src={photo.src || "/placeholder.svg"}
                    alt={photo.alt}
                    fill
                    className="object-contain"
                    priority={isCurrent}
                    quality={90}
                    sizes="90vw"
                  />
                </div>
              )
            })}
          </div>

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-muted-foreground">
            {currentIndex + 1} / {photos.length}
          </div>
        </div>
      )}
    </>
  )
}
