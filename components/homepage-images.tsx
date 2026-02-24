'use client';

import { GalleryImage } from '@/types/gallery';
import Image from 'next/image';
import { useState, useEffect, useRef, useMemo } from 'react';

interface Photo {
  id: string;
  url: string;
  file_id: string;
  file_name: string;
  file_size: number;
  width: number;
  height: number;
  category?: string;
  alt?: string;
  uploaded_at: string;
  order: number;
}

interface HomepageImagesProps {
  layout?: 'column' | 'row';
}

interface HomepageImageItemProps {
  image: GalleryImage;
}

interface LayoutPhoto extends GalleryImage {
  originalIndex: number;
}

interface Row {
  photos: LayoutPhoto[];
  height: number;
}

// Calculate justified layout - photos fill row width with equal height
function calculateJustifiedLayout(
  photos: GalleryImage[],
  containerWidth: number,
  targetRowHeight: number,
  gap: number
): Row[] {
  if (containerWidth <= 0) return [];

  const rows: Row[] = [];
  let currentRow: LayoutPhoto[] = [];
  let currentRowAspectSum = 0;

  // Calculate aspect ratio for each photo based on dimensions
  const photosWithAspect = photos.map((photo, index) => ({
    ...photo,
    aspectRatio: (photo.width || 800) / (photo.height || 450),
    originalIndex: index,
  }));

  for (const photo of photosWithAspect) {
    currentRow.push({ ...photo, originalIndex: photo.originalIndex });
    currentRowAspectSum += photo.aspectRatio;

    // Calculate what height this row would be if we fit all photos
    const totalGapWidth = (currentRow.length - 1) * gap;
    const availableWidth = containerWidth - totalGapWidth;
    const rowHeight = availableWidth / currentRowAspectSum;

    // If row height is less than target, finalize this row
    if (rowHeight <= targetRowHeight) {
      rows.push({ photos: currentRow, height: rowHeight });
      currentRow = [];
      currentRowAspectSum = 0;
    }
  }

  // Handle remaining photos in the last row
  if (currentRow.length > 0) {
    // Use target height for incomplete last row
    rows.push({ photos: currentRow, height: targetRowHeight });
  }

  return rows;
}

function GallerySkeleton({ layout = 'column' }: { layout?: 'column' | 'row' }) {
  return (
    <section id="homepage-images-skeleton" className="animate-pulse my-8">
      <div className="container">
        <div className="columns-2 md:columns-3 2xl:columns-4 gap-4 md:gap-6">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div
              key={idx}
              className="mb-4 break-inside-avoid bg-gray-100 aspect-3/2"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function MasonryItem({ image, isPriority = false }: HomepageImageItemProps & { isPriority?: boolean }) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="mb-4 break-inside-avoid overflow-hidden bg-gray-50">
      <Image
        alt={image.alt}
        src={image.src}
        width={image.width || 800}
        height={image.height || 450}
        className={`w-full h-auto object-cover transition duration-700 ${
          isLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'
        }`}
        sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, (max-width: 1920px) 25vw, 20vw"
        quality={70}
        priority={isPriority}
        loading={isPriority ? undefined : 'lazy'}
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
}

// Column-based Masonry Layout
function ColumnLayout({ images }: { images: GalleryImage[] }) {
  return (
    <div className="columns-2 md:columns-3 2xl:columns-4 gap-4 md:gap-6">
      {images.map((img, idx) => (
        <MasonryItem key={img.id ?? idx} image={img} isPriority={idx < 4} />
      ))}
    </div>
  );
}

// Row-based Justified Layout
function RowLayout({ images }: { images: GalleryImage[] }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRowHeight = 280;
  const gap = 16;

  // Measure container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);
    setContainerWidth(container.offsetWidth);

    return () => observer.disconnect();
  }, []);

  // Calculate justified layout
  const rows = useMemo(
    () => calculateJustifiedLayout(images, containerWidth, targetRowHeight, gap),
    [images, containerWidth]
  );

  return (
    <div ref={containerRef} className="w-full">
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="flex"
          style={{
            marginBottom: rowIndex < rows.length - 1 ? gap : 0,
            gap: gap,
          }}
        >
          {row.photos.map((photo, photoIndex) => {
            const width = row.height * ((photo.width || 800) / (photo.height || 450));
            const globalIndex = photo.originalIndex;

            return (
              <RowImageItem
                key={photo.id ?? photoIndex}
                src={photo.src}
                alt={photo.alt}
                width={width}
                height={row.height}
                isPriority={globalIndex < 4}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function RowImageItem({
  src,
  alt,
  width,
  height,
  isPriority,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  isPriority: boolean;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div
      className="relative overflow-hidden bg-gray-50"
      style={{
        width: width,
        height: height,
        flexShrink: 0,
      }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className={`object-cover transition duration-700 ${
          isLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'
        }`}
        sizes={`${Math.round(width)}px`}
        quality={70}
        priority={isPriority}
        loading={isPriority ? undefined : 'lazy'}
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
}

export default function HomepageImages({ 
  layout = 'column'
}: HomepageImagesProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHomepagePhotos() {
      try {
        const res = await fetch('/api/homepage/images');
        const { images: photos } = await res.json() as { images: Photo[] };

        if (!photos || photos.length === 0) {
          setImages([]);
          return;
        }

        const galleryImages: GalleryImage[] = photos.map(photo => ({
          id: photo.id,
          src: photo.url,
          alt: photo.alt || photo.file_name,
          width: photo.width,
          height: photo.height,
        }));

        setImages(galleryImages);
      } catch (error) {
        console.error('Failed to fetch homepage photos:', error);
        setImages([]);
      } finally {
        setLoading(false);
      }
    }

    fetchHomepagePhotos();
  }, []);

  if (loading) {
    return <GallerySkeleton layout={layout} />;
  }

  if (images.length === 0) {
    return (
      <section id="homepage-images" className='my-8'>
        <div className="container">
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-rurikon-400 bg-gray-50 rounded-lg">
             <div className="w-16 h-16 bg-gray-100 rounded-full mb-4 animate-pulse"></div>
             <p>No photos available yet</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="homepage-images" className='my-8'>
      <div className="container">
        {layout === 'row' ? (
          <RowLayout images={images} />
        ) : (
          <ColumnLayout images={images} />
        )}
      </div>
    </section>
  );
}
