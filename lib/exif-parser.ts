import ExifReader from "exifreader"

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

export async function parseExif(file: File): Promise<ExifData | null> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const tags = ExifReader.load(arrayBuffer)

    const exif: ExifData = {}

    if (tags.Make?.description) exif.make = tags.Make.description
    if (tags.Model?.description) exif.model = tags.Model.description

    if (tags.DateTime?.description) {
      exif.dateTime = tags.DateTime.description
    } else if (tags.DateTimeOriginal?.description) {
      exif.dateTime = tags.DateTimeOriginal.description
    }

    if (tags.ExposureTime?.description) {
      exif.exposureTime = tags.ExposureTime.description
    }
    if (tags.FNumber?.description) {
      exif.fNumber = `f/${tags.FNumber.value}`
    }
    if (tags.ISOSpeedRatings?.description) {
      exif.iso = tags.ISOSpeedRatings.description
    }
    if (tags.FocalLength?.description) {
      exif.focalLength = tags.FocalLength.description
    }
    if (tags.LensModel?.description) {
      exif.lensModel = tags.LensModel.description
    }

    if (tags["Image Width"]?.value) {
      exif.imageWidth = Number(tags["Image Width"].value)
    } else if (tags.PixelXDimension?.value) {
      exif.imageWidth = Number(tags.PixelXDimension.value)
    }
    if (tags["Image Height"]?.value) {
      exif.imageHeight = Number(tags["Image Height"].value)
    } else if (tags.PixelYDimension?.value) {
      exif.imageHeight = Number(tags.PixelYDimension.value)
    }

    if (tags.GPSLatitude && tags.GPSLongitude) {
      const latRef = tags.GPSLatitudeRef?.description || "N"
      const lonRef = tags.GPSLongitudeRef?.description || "E"
      const lat = tags.GPSLatitude.description
      const lon = tags.GPSLongitude.description

      if (lat && lon) {
        exif.gps = {
          latitude: latRef === "S" ? -Number(lat) : Number(lat),
          longitude: lonRef === "W" ? -Number(lon) : Number(lon),
        }
      }
    }

    if (Object.keys(exif).length === 0) return null

    return exif
  } catch (error) {
    console.error("EXIF parsing error:", error)
    return null
  }
}

export async function checkCompressedExif(blob: Blob): Promise<boolean> {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const tags = ExifReader.load(arrayBuffer)
    // Check if there is any meaningful EXIF data
    return !!(
      tags.Make?.description ||
      tags.Model?.description ||
      tags.DateTime?.description ||
      tags.DateTimeOriginal?.description
    )
  } catch {
    return false
  }
}
