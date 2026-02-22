'use client';

import { GalleryImage } from '@/types/gallery';
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

interface HomepageImagesProps {}

interface HomepageImageItemProps {
  image: GalleryImage;
}

function GallerySkeleton() {
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
  const proxySrc = image.id ? `/api/homepage/image/${image.id}` : image.src;

  return (
    <div className="mb-4 break-inside-avoid overflow-hidden bg-gray-50">
      <Image
        alt={image.alt}
        src={proxySrc}
        width={image.width || 800}
        height={image.height || 600}
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

export default function HomepageImages({ 
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
    return <GallerySkeleton />;
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
        <div className="columns-2 md:columns-3 2xl:columns-4 gap-4 md:gap-6">
          {images.map((img, idx) => (
            <MasonryItem key={img.id ?? idx} image={img} isPriority={idx < 4} />
          ))}
        </div>
      </div>
    </section>
  );
}
