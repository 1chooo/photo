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

// 簡化後的 Props，只保留樣式相關設定
interface HomepageImagesProps {
  layout?: GalleryLayout;
  columns?: 1 | 2 | 3 | 4; // Column configuration
}

interface HomepageImageItemProps {
  image: GalleryImage;
}

function HomepageImageItem({ image, isPriority = false }: HomepageImageItemProps & { isPriority?: boolean }) {
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
          quality={70}
          priority={isPriority}
          loading={isPriority ? undefined : 'lazy'}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw"
          onLoad={(e) => handleLoadingComplete(e.currentTarget)}
        />
      </div>
    </div>
  );
}

// Get gallery layout based on column count
const getLayout = (columns: 1 | 2 | 3 | 4): GalleryLayout => {
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

export default function HomepageImages({ 
  layout, 
  columns = 4
}: HomepageImagesProps) {
  // 狀態初始化為空陣列和 loading 狀態
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
  }, []); // 移除依賴陣列中的變數，只在組件掛載時執行一次

  // Use provided layout or generate from columns prop
  const currentLayout = layout || getLayout(columns);

  if (loading) {
    return (
      <section id="homepage-images">
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
      <section id="homepage-images">
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
  const totalImagesInPattern = currentLayout.columns.reduce(
    (sum, column) => sum + column.length,
    0
  );
  const timesToRepeat = Math.ceil(images.length / totalImagesInPattern);

  // Create extended columns by repeating the pattern
  const extendedColumns = Array.from({ length: timesToRepeat }, (_, repeatIndex) =>
    currentLayout.columns.map((column, columnIndex) => ({
      column,
      key: `${repeatIndex}-${columnIndex}`,
    }))
  ).flat();

  return (
    <section id="homepage-images">
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
                      <HomepageImageItem image={item.image} />
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
