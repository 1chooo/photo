import EpisodeImage from '@/components/episode-image';

interface EpisodeImageData {
  id: string;
  url: string;
  alt?: string;
  variant?: 'original' | 'square';
  order: number;
  createdAt: string;
}

interface EpisodeImagesProps {
  slug: string;
}

async function getEpisodePhotos(slug: string): Promise<EpisodeImageData[]> {
  try {
    // Construct URL for both client and server
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL 
      || process.env.VERCEL_URL 
      || 'http://localhost:3000';
    
    const url = `${baseUrl}/api/category/${slug}`;
    
    const response = await fetch(url, {
      cache: 'no-store', // Always fetch fresh data
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Category "${slug}" not found`);
        return [];
      }
      console.error(`API request failed: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch category: ${response.statusText}`);
    }

    const data = await response.json();
    const images = data?.images || [];
    
    // construct EpisodeImageData array
    return images.map((img: any, index: number) => ({
      id: img.id,
      url: img.url,
      alt: img.alt || '',
      variant: img.variant || 'original',
      order: index,
      createdAt: img.uploaded_at || new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Error fetching episode photos:', error);
    return [];
  }
}

export default async function EpisodeImages({ slug }: EpisodeImagesProps) {
  const photos = await getEpisodePhotos(slug);
  
  if (!photos || photos.length === 0) {
    return null;
  }

  return (
    <>
      {photos.map((photo) => (
        <EpisodeImage
          key={photo.id}
          image={{
            id: photo.id,
            src: photo.url,
            alt: photo.alt || '',
          }}
          title={photo.alt || undefined}
          variant={photo.variant || 'original'}
        />
      ))}
    </>
  );
}
