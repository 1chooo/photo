import Image from 'next/image';
import { GalleryImage } from '@/types/gallery';

interface GalleryProps {
  images: GalleryImage[];
}

interface GalleryItemProps {
  image: GalleryImage;
}

function GalleryItem({ image }: GalleryItemProps) {
  return (
    <div className="overflow-hidden h-full w-full">
      <div className="block h-full w-full relative aspect-square">
        <Image
          alt={image.alt}
          className="object-cover object-center transition duration-500 transform scale-100 hover:scale-110"
          src={image.src}
          fill
          sizes="100vw"
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
