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
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const db = getAdminDb();
    
    // fetch category document by slug
    const docRef = db.collection('telegram-categories').doc(slug);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.log(`Category "${slug}" not found`);
      return [];
    }
    
    const data = doc.data();
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
