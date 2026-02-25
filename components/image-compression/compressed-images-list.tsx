import { CheckCircle2, Download, ImageIcon, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface ExifData {
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

interface CompressedImagesListProps {
  images: CompressedImage[]
  onDownloadAll: () => void
  onClearAll: () => void
  onRemove: (id: string) => void
  onPreview: (image: CompressedImage) => void
  formatSize: (bytes: number) => string
  calculateSavings: (original: number, compressed: number) => string
}

export function CompressedImagesList({
  images,
  onDownloadAll,
  onClearAll,
  onRemove,
  onPreview,
  formatSize,
  calculateSavings,
}: CompressedImagesListProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            Compression Results {images.length > 0 && `(${images.length} images)`}
          </CardTitle>
          {images.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onDownloadAll}
                className="h-8 px-3 bg-transparent cursor-pointer"
              >
                <Download className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Download All</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={onClearAll} className="h-8 px-2 cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">Compressed images will be displayed here</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-150 overflow-y-auto">
            {images.map((img) => (
              <div 
                key={img.id} 
                className="group flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-all relative"
              >
                <div 
                  className="w-14 h-14 rounded-md overflow-hidden bg-muted shrink-0 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  onClick={() => onPreview(img)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.previewUrl || "/placeholder.svg"}
                    alt={img.originalName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div 
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onPreview(img)}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {img.originalName.replace(/\.[^.]+$/, ".webp")}
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant={img.hasExif ? "default" : "secondary"}
                          className={`text-[10px] px-1.5 py-0 h-4 ${img.hasExif ? "bg-green-600 hover:bg-green-700" : ""}`}
                        >
                          {img.hasExif ? "EXIF" : "No EXIF"}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {img.hasExif
                            ? "EXIF data preserved"
                            : "EXIF data not preserved or original file has no EXIF"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{formatSize(img.originalSize)}</span>
                    <span>→</span>
                    <span className="text-green-600 font-medium">
                      {formatSize(img.compressedSize)}
                    </span>
                    <span className="text-green-600">
                      (-{calculateSavings(img.originalSize, img.compressedSize)}%)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button 
                    asChild 
                    variant="outline" 
                    size="sm" 
                    className="bg-transparent cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <a
                      href={img.downloadUrl}
                      download={img.originalName.replace(/\.[^.]+$/, ".webp")}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(img.id)
                    }}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
