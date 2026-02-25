import { type NextRequest, NextResponse } from "next/server"
import sharp from "sharp"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("image") as File
    const quality = Number.parseInt(formData.get("quality") as string) || 80

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    // Check file size (Vercel has ~4.5MB limit on Hobby plan)
    const fileSizeMB = file.size / 1024 / 1024
    if (fileSizeMB > 4) {
      return NextResponse.json(
        { error: "Image too large. Please ensure client-side compression is working properly." },
        { status: 413 }
      )
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Use sharp to compress and convert to webp
    const compressedBuffer = await sharp(buffer)
      .withMetadata() // Add withMetadata() to preserve original EXIF data
      .webp({
        quality: quality,
        effort: 4, // Compression effort (0-6), 4 is the balance point
      })
      .toBuffer()

    // Return compressed image
    return new NextResponse(new Uint8Array(compressedBuffer), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Disposition": `attachment; filename="compressed.webp"`,
      },
    })
  } catch (error) {
    console.error("Compression error:", error)
    return NextResponse.json({ error: "Image processing failed" }, { status: 500 })
  }
}
