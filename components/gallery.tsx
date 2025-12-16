'use client';

import { BlurFade } from '@/components/magicui/blur-fade';
import { GalleryImage, GalleryLayout } from '@/types/gallery';
import { getBlurDataURL } from '@/lib/blur-placeholder';
import Image from 'next/image';
import { useMemo, useState, useEffect } from 'react';

interface GalleryProps {
  images: GalleryImage[];
  layout?: GalleryLayout;
}

interface GalleryItemProps {
  image: GalleryImage;
  index: number;
}

function GalleryItem({ image, index }: GalleryItemProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Use actual image dimensions if available, otherwise default to landscape
  const width = image.width || 800;
  const height = image.height || 600;
  
  return (
    <BlurFade delay={0.25 + index * 0.05} inView>
      <Image
        className={`mb-4 w-full object-contain transition-all duration-700 hover:scale-105 ${
          isLoaded ? 'opacity-100' : 'opacity-20'
        }`}
        src={image.src}
        alt={image.alt}
        loading="lazy"
        width={width}
        height={height}
        quality={80}
        placeholder="blur"
        blurDataURL={getBlurDataURL(width, height)}
        onLoad={() => setIsLoaded(true)}
      />
    </BlurFade>
  );
}

export default function Gallery({ images }: GalleryProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Randomly shuffle images only on client side after mount
  const shuffledImages = useMemo(() => {
    if (!isMounted) return images;
    return [...images].sort(() => Math.random() - 0.5);
  }, [images, isMounted]);

  return (
    <section id="gallery">
      <div className="container w-full mx-auto px-4">
        <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4">
          {shuffledImages.map((image, idx) => (
            <GalleryItem key={image.id} image={image} index={idx} />
          ))}
        </div>
      </div>
    </section>
  );
}
