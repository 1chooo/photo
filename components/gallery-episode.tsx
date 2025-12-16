'use client';

import Image from 'next/image';
import { GalleryImage } from '@/types/gallery';
import { getBlurDataURL } from '@/lib/blur-placeholder';
import { useState } from 'react';

interface GalleryProps {
  images: GalleryImage[];
}

interface GalleryItemProps {
  image: GalleryImage;
}

function GalleryItem({ image }: GalleryItemProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  
  return (
    <div className="overflow-hidden h-full w-full">
      <div className="block h-full w-full relative aspect-square">
        <Image
          alt={image.alt}
          className={`object-cover object-center transition-all duration-700 transform scale-100 hover:scale-110 ${
            isLoaded ? 'opacity-100' : 'opacity-20'
          }`}
          src={image.src}
          fill
          sizes="100vw"
          placeholder="blur"
          blurDataURL={getBlurDataURL(800, 800)}
          onLoad={() => setIsLoaded(true)}
        />
      </div>
    </div>
  );
}

export default function Gallery({ images }: GalleryProps) {
  return (
    <section>
      <div className="container w-full">
        <div className="flex flex-col w-full">
          {images.map((image, index) => (
            <div key={index} className="w-full p-1">
              <GalleryItem image={image} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
