import { useState } from "react"
import { FileImage, Camera, Trash2, Upload, Plus, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

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

interface PendingFile {
  id: string
  file: File
  previewUrl: string
  exifData: ExifData | null
}

interface FilesManagerProps {
  files: PendingFile[]
  isDragging: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: (id: string) => void
  onClearAll: () => void
  formatSize: (bytes: number) => string
}

export function FilesManager({
  files,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onRemoveFile,
  onClearAll,
  formatSize,
}: FilesManagerProps) {
  const formatExifSummary = (exif: ExifData) => {
    const parts: string[] = []
    if (exif.model) parts.push(exif.model)
    if (exif.focalLength) parts.push(exif.focalLength)
    if (exif.fNumber) parts.push(exif.fNumber)
    if (exif.exposureTime) parts.push(exif.exposureTime)
    if (exif.iso) parts.push(`ISO ${exif.iso}`)
    return parts.join(" · ")
  }

  const totalSize = files.reduce((sum, p) => sum + p.file.size, 0)

  const handleFileInputClick = () => {
    document.getElementById("file-input")?.click()
  }

  // Empty state - show full upload area
  if (files.length === 0) {
    return (
      <Card
        className="border-2 border-dashed transition-colors duration-200"
        style={{ borderColor: isDragging ? "var(--primary)" : undefined }}
      >
        <CardContent className="p-6">
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className="flex flex-col items-center justify-center py-8 cursor-pointer"
            onClick={handleFileInputClick}
          >
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
              <Upload className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-base font-medium text-foreground mb-1">Drag and drop images here</p>
            <p className="text-sm text-muted-foreground">
              or click to select files (multiple selection supported)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Press{" "}
              <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border rounded">
                {typeof navigator !== "undefined" && navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}
              </kbd>{" "}
              +{" "}
              <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border rounded">O</kbd> to
              select
            </p>
            <input
              id="file-input"
              type="file"
              accept="image/*"
              multiple
              onChange={onFileSelect}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Files present - show list with compact add more option
  return (
    <Card
      className="transition-colors duration-200"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Pending ({files.length} images, {formatSize(totalSize)})
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClearAll} className="h-8 px-2 cursor-pointer">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Add more files button */}
        <div
          onClick={handleFileInputClick}
          className={`flex flex-col items-center justify-center gap-1.5 p-3 border-2 border-dashed rounded-lg cursor-pointer transition-all hover:bg-muted/50 hover:border-primary ${
            isDragging ? "bg-muted/70 border-primary" : "bg-muted/20"
          }`}
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium">
              Add more images
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            or press{" "}
            <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border rounded">
              {typeof navigator !== "undefined" && navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}
            </kbd>{" "}
            +{" "}
            <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border rounded">O</kbd>
          </p>
          <input
            id="file-input"
            type="file"
            accept="image/*"
            multiple
            onChange={onFileSelect}
            className="hidden"
          />
        </div>

        {/* Files list */}
        <div className="space-y-3 max-h-100 overflow-y-auto">
          {files.map((pending) => (
            <div key={pending.id} className="group flex gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-all">
              <div className="w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pending.previewUrl || "/placeholder.svg"}
                  alt={pending.file.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <FileImage className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <p className="text-sm font-medium truncate">{pending.file.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">{formatSize(pending.file.size)}</p>
                  {pending.exifData && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Camera className="w-3 h-3 mr-1" />
                          EXIF
                          <Info className="w-3 h-3 ml-1" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="start">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b">
                            <Camera className="w-4 h-4" />
                            <h4 className="font-semibold text-sm">EXIF Data</h4>
                          </div>
                          
                          <div className="grid gap-2 text-sm">
                            {pending.exifData.model && (
                              <div className="grid grid-cols-[100px_1fr] gap-2">
                                <span className="text-muted-foreground font-medium">Camera</span>
                                <span className="font-mono text-xs">
                                  {pending.exifData.make} {pending.exifData.model}
                                </span>
                              </div>
                            )}
                            {pending.exifData.lensModel && (
                              <div className="grid grid-cols-[100px_1fr] gap-2">
                                <span className="text-muted-foreground font-medium">Lens</span>
                                <span className="font-mono text-xs break-all">
                                  {pending.exifData.lensModel}
                                </span>
                              </div>
                            )}
                            {pending.exifData.dateTime && (
                              <div className="grid grid-cols-[100px_1fr] gap-2">
                                <span className="text-muted-foreground font-medium">Date/Time</span>
                                <span className="font-mono text-xs">{pending.exifData.dateTime}</span>
                              </div>
                            )}
                            {(pending.exifData.imageWidth || pending.exifData.imageHeight) && (
                              <div className="grid grid-cols-[100px_1fr] gap-2">
                                <span className="text-muted-foreground font-medium">Resolution</span>
                                <span className="font-mono text-xs">
                                  {pending.exifData.imageWidth} × {pending.exifData.imageHeight}
                                </span>
                              </div>
                            )}
                            
                            {(pending.exifData.focalLength ||
                              pending.exifData.fNumber ||
                              pending.exifData.exposureTime ||
                              pending.exifData.iso) && (
                              <>
                                <div className="border-t pt-2 mt-1">
                                  <span className="text-xs font-semibold text-muted-foreground">
                                    Settings
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {pending.exifData.focalLength && (
                                    <div>
                                      <span className="text-xs text-muted-foreground block">Focal Length</span>
                                      <Badge variant="secondary" className="mt-1 font-mono text-xs">
                                        {pending.exifData.focalLength}
                                      </Badge>
                                    </div>
                                  )}
                                  {pending.exifData.fNumber && (
                                    <div>
                                      <span className="text-xs text-muted-foreground block">Aperture</span>
                                      <Badge variant="secondary" className="mt-1 font-mono text-xs">
                                        {pending.exifData.fNumber}
                                      </Badge>
                                    </div>
                                  )}
                                  {pending.exifData.exposureTime && (
                                    <div>
                                      <span className="text-xs text-muted-foreground block">Shutter</span>
                                      <Badge variant="secondary" className="mt-1 font-mono text-xs">
                                        {pending.exifData.exposureTime}
                                      </Badge>
                                    </div>
                                  )}
                                  {pending.exifData.iso && (
                                    <div>
                                      <span className="text-xs text-muted-foreground block">ISO</span>
                                      <Badge variant="secondary" className="mt-1 font-mono text-xs">
                                        {pending.exifData.iso}
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                            
                            {pending.exifData.gps && (
                              <>
                                <div className="border-t pt-2 mt-1">
                                  <span className="text-xs font-semibold text-muted-foreground">
                                    Location
                                  </span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2">
                                  <span className="text-muted-foreground font-medium">GPS</span>
                                  <span className="font-mono text-xs">
                                    {pending.exifData.gps.latitude?.toFixed(6)},{" "}
                                    {pending.exifData.gps.longitude?.toFixed(6)}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
              
              <div className="flex items-center shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveFile(pending.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
