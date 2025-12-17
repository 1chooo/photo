import Photo from '@/components/photo';

interface PhotoData {
  id: string;
  url: string;
  alt?: string;
  variant?: 'original' | 'square';
  order: number;
  createdAt: string;
}

interface GalleryPhotosProps {
  slug: string;
}

async function getPhotos(slug: string): Promise<PhotoData[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/photos?slug=${slug}`, {
      next: { 
        revalidate: 3600, // Cache for 1 hour, revalidate after
        tags: [`gallery-${slug}`] // Tag for on-demand revalidation
      },
    });
    
    if (!response.ok) {
      console.error('Failed to fetch photos');
      return [];
    }
    
    const data = await response.json();
    return data.photos || [];
  } catch (error) {
    console.error('Error fetching photos:', error);
    return [];
  }
}

export default async function GalleryPhotos({ slug }: GalleryPhotosProps) {
  const photos = await getPhotos(slug);
  
  if (!photos || photos.length === 0) {
    return null;
  }

  return (
    <>
      {photos
        .sort((a, b) => a.order - b.order)
        .map((photo) => (
          <Photo
            key={photo.id}
            image={{
              id: photo.id,
              src: `/api/photos/image/${slug}/${photo.order}`,
              alt: photo.alt || '',
            }}
            title={photo.alt || undefined}
            variant={photo.variant || 'original'}
          />
        ))}
    </>
  );
}
