'use client';

import Image from 'next/image';
import { getBlurDataURL } from '@/lib/blur-placeholder';
import { useState } from 'react';
import cn from 'clsx';

interface EpisodeImageProps {
  image: {
    id: string;
    src: string;
    alt: string;
    width?: number;
    height?: number;
  };
  title?: React.ReactNode;
  variant?: 'original' | 'square';
}

export default function EpisodeImage({ image, title, variant = 'original' }: EpisodeImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  
  if (!image) {
    return null;
  }
  
  return (
    <figure>
      <span className="inline-block w-full">
        <span className="sidenote-content float-left w-full">
          <section>
            <div className="container w-full">
              <div className="w-full p-1">
                {variant === 'square' ? (
                  <div className="overflow-hidden h-full w-full">
                    <div className="block h-full w-full relative aspect-square">
                      <Image
                        alt={image.alt}
                        className={`object-cover object-center transition-all duration-700 transform scale-100 hover:scale-110 ${
                          isLoaded ? 'opacity-100' : 'opacity-20'
                        }`}
                        src={image.src}
                        fill
                        quality={70}
                        sizes="(max-width: 768px) 100vw, (max-width: 1536px) 80vw, 1200px"
                        placeholder="blur"
                        blurDataURL={getBlurDataURL(800, 800)}
                        onLoad={() => setIsLoaded(true)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="overflow-hidden w-full">
                    <div className="block w-full relative">
                      <Image
                        alt={image.alt}
                        className={`object-contain object-center w-full h-auto transition-opacity duration-700 ${
                          isLoaded ? 'opacity-100' : 'opacity-20'
                        }`}
                        src={image.src}
                        width={image.width || 1200}
                        height={image.height || 800}
                        quality={70}
                        sizes="(max-width: 768px) 100vw, (max-width: 1536px) 80vw, 1200px"
                        placeholder="blur"
                        blurDataURL={getBlurDataURL(image.width || 1200, image.height || 800)}
                        onLoad={() => setIsLoaded(true)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </span>
      </span>
      {title && (
        <span
          className={cn(
            'sidenote block relative mt-3.5 mb-7 mx-auto text-left text-pretty w-[80%] text-xs sm:text-sm leading-5 sm:leading-6 text-rurikon-400',
            'text:inline text:float-right text:clear-right text:w-[50%] text:-mr-[50%] text:mt-0 text:pl-7'
          )}
        >
          <span className="sr-only">Sidenote: </span>
          {title}
        </span>
      )}
    </figure>
  );
}