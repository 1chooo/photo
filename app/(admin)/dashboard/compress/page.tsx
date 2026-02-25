import { ImageCompressor } from "@/components/image-compressor"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Image Compression Tool</h1>
          <p className="text-muted-foreground">Upload images, automatically convert to high-quality WebP format with EXIF preservation</p>
        </div>
        <ImageCompressor />
      </div>
    </main>
  )
}
