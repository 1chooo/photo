'use client';

import EpisodeImage from '@/components/episode-image';
import { useState, useEffect } from 'react';

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

function EpisodeImagesSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={idx} className="bg-gray-100 aspect-video w-full rounded" />
      ))}
    </div>
  );
}

export default function EpisodeImages({ slug }: EpisodeImagesProps) {
  const [photos, setPhotos] = useState<EpisodeImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEpisodePhotos() {
      try {
        const response = await fetch(`/api/category/${slug}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          if (response.status === 404) {
            console.log(`Category "${slug}" not found`);
            setPhotos([]);
            return;
          }
          throw new Error(`Failed to fetch category: ${response.statusText}`);
        }

        const data = await response.json();
        const images = data?.images || [];

        // construct EpisodeImageData array
        const episodeImages = images.map((img: any, index: number) => ({
          id: img.id,
          url: img.url,
          alt: img.alt || '',
          variant: img.variant || 'original',
          order: index,
          createdAt: img.uploaded_at || new Date().toISOString(),
        }));

        setPhotos(episodeImages);
      } catch (error) {
        console.error('Error fetching episode photos:', error);
        setError(error instanceof Error ? error.message : 'Failed to load images');
        setPhotos([]);
      } finally {
        setLoading(false);
      }
    }

    fetchEpisodePhotos();
  }, [slug]);

  if (loading) {
    return <EpisodeImagesSkeleton />;
  }

  if (error) {
    return (
      <div className="text-rurikon-400 text-center py-8">
        <p>Failed to load images</p>
      </div>
    );
  }

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
