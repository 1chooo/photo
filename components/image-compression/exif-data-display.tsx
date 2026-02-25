import { Camera } from "lucide-react"
import { Label } from "@/components/ui/label"

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

interface ExifDataDisplayProps {
  exifData: ExifData | null
  hasExif: boolean
  compact?: boolean
}

export function ExifDataDisplay({ exifData, hasExif, compact = false }: ExifDataDisplayProps) {
  if (!exifData) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Camera className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">No EXIF data available</p>
        <p className="text-xs mt-1">
          {hasExif ? "Unable to parse EXIF data" : "Original image had no EXIF metadata"}
        </p>
      </div>
    )
  }

  const ExifField = ({ label, value }: { label: string; value?: string | number }) => {
    if (!value) return null
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <p className={compact ? "text-xs" : "text-sm"}>{value}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {exifData.make && (
        <ExifField
          label="Camera"
          value={`${exifData.make} ${exifData.model || ""}`.trim()}
        />
      )}

      <ExifField label="Lens" value={exifData.lensModel} />
      <ExifField label="Date Taken" value={exifData.dateTime} />

      {(exifData.imageWidth || exifData.imageHeight) && (
        <ExifField
          label="Resolution"
          value={`${exifData.imageWidth} × ${exifData.imageHeight} pixels`}
        />
      )}

      <ExifField label="Focal Length" value={exifData.focalLength} />
      <ExifField label="Aperture" value={exifData.fNumber} />
      <ExifField label="Shutter Speed" value={exifData.exposureTime} />
      <ExifField label="ISO" value={exifData.iso} />

      {exifData.gps && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">GPS Location</Label>
          <p className={`font-mono ${compact ? "text-xs" : "text-sm"}`}>
            {exifData.gps.latitude?.toFixed(6)}, {exifData.gps.longitude?.toFixed(6)}
          </p>
          <a
            href={`https://www.google.com/maps?q=${exifData.gps.latitude},${exifData.gps.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-block"
          >
            View on Google Maps →
          </a>
        </div>
      )}
    </div>
  )
}
