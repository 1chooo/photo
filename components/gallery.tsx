'use client';

import { GalleryImage, GalleryLayout } from '@/types/gallery';
import Image from 'next/image';
import { useState, useEffect } from 'react';

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

interface GalleryProps {
  images?: GalleryImage[];
  layout?: GalleryLayout;
  fetchFromApi?: boolean; // 是否從 API 獲取數據
  columns?: 1 | 2 | 3 | 4; // Column configuration
}

interface GalleryItemProps {
  image: GalleryImage;
}

function GalleryItem({ image }: GalleryItemProps) {
  const [aspectRatio, setAspectRatio] = useState<string>('aspect-square');
  const [isLoaded, setIsLoaded] = useState(false);

  // If width and height are provided, calculate aspect ratio
  if (image.width && image.height && !isLoaded) {
    const isPortrait = image.height > image.width;
    const ratio = isPortrait ? 'aspect-[2/3]' : 'aspect-[3/2]';
    if (aspectRatio !== ratio) {
      setAspectRatio(ratio);
      setIsLoaded(true);
    }
  }

  const handleLoadingComplete = (img: HTMLImageElement) => {
    // Determine orientation from the loaded image
    const isPortrait = img.naturalHeight > img.naturalWidth;
    const ratio = isPortrait ? 'aspect-[2/3]' : 'aspect-[3/2]';
    setAspectRatio(ratio);
    setIsLoaded(true);
  };

  // Use proxy URL to hide original photo URL
  const proxySrc = image.id ? `/api/homepage/image/${image.id}` : image.src;
  
  return (
    <div className="overflow-hidden h-full w-full">
      <div className={`block h-full w-full relative ${aspectRatio} transition-all duration-300`}>
        <Image
          alt={image.alt}
          className="object-cover object-center transition duration-500 transform hover:scale-105"
          src={proxySrc}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          onLoad={(e) => handleLoadingComplete(e.currentTarget)}
        />
      </div>
    </div>
  );
}

// Get gallery layout based on column count
const getGalleryLayout = (columns: 1 | 2 | 3 | 4): GalleryLayout => {
  switch (columns) {
    case 1:
      return {
        columns: [
          [{ size: 'full' }],
          [{ size: 'full' }],
          [{ size: 'full' }],
          [{ size: 'full' }],
        ],
      };
    case 2:
      return {
        columns: [
          [{ size: 'full' }],
          [{ size: 'full' }],
        ],
      };
    case 3:
      return {
        columns: [
          [{ size: 'half' }, { size: 'half' }, { size: 'half' }, { size: 'half' }, { size: 'full' }],
          [{ size: 'full' }, { size: 'half' }, { size: 'half' }, { size: 'half' }, { size: 'half' }],
          [{ size: 'half' }, { size: 'half' }, { size: 'half' }, { size: 'half' }, { size: 'full' }],
          [{ size: 'full' }, { size: 'half' }, { size: 'half' }, { size: 'half' }, { size: 'half' }],
        ],
      };
    case 4:
    default:
      return {
        columns: [
          [{ size: 'half' }, { size: 'half' }, { size: 'half' }, { size: 'half' }, { size: 'full' }],
          [{ size: 'full' }, { size: 'half' }, { size: 'half' }, { size: 'half' }, { size: 'half' }],
          [{ size: 'half' }, { size: 'half' }, { size: 'half' }, { size: 'half' }, { size: 'full' }],
          [{ size: 'full' }, { size: 'half' }, { size: 'half' }, { size: 'half' }, { size: 'half' }],
        ],
      };
  }
};

export default function Gallery({ 
  images: externalImages, 
  layout, 
  fetchFromApi = true,
  columns = 4
}: GalleryProps) {
  const [images, setImages] = useState<GalleryImage[]>(externalImages || []);
  const [loading, setLoading] = useState(fetchFromApi);

  useEffect(() => {
    // 如果需要從 API 獲取數據
    if (fetchFromApi) {
      async function fetchHomepagePhotos() {
        try {
          const res = await fetch('/api/homepage/images');
          const { images: photos } = await res.json() as { images: Photo[] };

          if (!photos || photos.length === 0) {
            setImages([]);
            return;
          }

          // 轉換為 Gallery 組件需要的格式
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
    }
  }, [fetchFromApi]);

  // Use provided layout or generate from columns prop
  const galleryLayout = layout || getGalleryLayout(columns);

  if (loading) {
    return (
      <section id="gallery">
        <div className="container w-full mx-auto px-4">
          <div className="flex items-center justify-center min-h-[50vh]">
            <p className="text-rurikon-400">Loading...</p>
          </div>
        </div>
      </section>
    );
  }

  if (images.length === 0) {
    return (
      <section id="gallery">
        <div className="container w-full mx-auto px-4">
          <div className="flex items-center justify-center min-h-[50vh]">
            <p className="text-rurikon-400">No photos available</p>
          </div>
        </div>
      </section>
    );
  }

  let imageIndex = 0;

  // Calculate how many times we need to repeat the layout pattern
  const totalImagesInPattern = galleryLayout.columns.reduce(
    (sum, column) => sum + column.length,
    0
  );
  const timesToRepeat = Math.ceil(images.length / totalImagesInPattern);

  // Create extended columns by repeating the pattern
  const extendedColumns = Array.from({ length: timesToRepeat }, (_, repeatIndex) =>
    galleryLayout.columns.map((column, columnIndex) => ({
      column,
      key: `${repeatIndex}-${columnIndex}`,
    }))
  ).flat();

  return (
    <section id="gallery">
      <div className="container w-full mx-auto px-4">
        <div className="flex flex-wrap w-full">
          {extendedColumns.map(({ column, key }) => {
            const columnImages: { image: GalleryImage; size: 'full' | 'half' }[] = [];
            
            column.forEach((item) => {
              if (imageIndex < images.length) {
                columnImages.push({
                  image: images[imageIndex],
                  size: item.size,
                });
                imageIndex++;
              }
            });

            // Skip rendering empty columns
            if (columnImages.length === 0) {
              return null;
            }

            return (
              <div
                key={key}
                className="flex w-full md:w-1/2 flex-wrap"
              >
                {columnImages.map((item, itemIndex) => {
                  const widthClass =
                    item.size === 'full' ? 'w-full' : 'w-full md:w-1/2';
                  
                  return (
                    <div key={itemIndex} className={`${widthClass} p-1`}>
                      <GalleryItem image={item.image} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
