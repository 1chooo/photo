'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { ImageIcon, Plus, X } from 'lucide-react';
import Image from 'next/image';

interface Photo {
  id: string;
  url: string;
  alt?: string;
  variant?: 'original' | 'square';
  order: number;
  slug: string;
  createdAt: string;
}

interface Gallery {
  slug: string;
  photos: Photo[];
}

interface SelectedPhoto {
  photoId: string;
  slug: string;
  order: number;
}

// Gallery layouts for different column counts
const getGalleryLayout = (columns: 1 | 2 | 3 | 4) => {
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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function HomepagePhotosManagement() {
  const { data: galleriesData } = useSWR<{ galleries: Gallery[] }>(
    '/api/photos',
    fetcher,
    { revalidateOnFocus: true }
  );

  const { data: homepageData } = useSWR<{ selectedPhotos: SelectedPhoto[] }>(
    '/api/homepage',
    fetcher,
    { revalidateOnFocus: true }
  );

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewColumns, setPreviewColumns] = useState<1 | 2 | 3 | 4>(4);

  const galleries = galleriesData?.galleries || [];
  const selectedPhotos = homepageData?.selectedPhotos || [];

  // Get all photos with their slug info
  const allPhotos = galleries.flatMap(gallery =>
    gallery.photos.map(photo => ({ ...photo, slug: gallery.slug }))
  );

  // Get selected photo objects
  const selectedPhotoObjects = selectedPhotos
    .map(sp => {
      const photo = allPhotos.find(p => p.id === sp.photoId && p.slug === sp.slug);
      return photo ? { ...photo, selectedOrder: sp.order } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a!.selectedOrder - b!.selectedOrder);

  // Get unselected photos
  const unselectedPhotos = allPhotos.filter(
    photo => !selectedPhotos.some(sp => sp.photoId === photo.id && sp.slug === photo.slug)
  );

  const handleAddPhoto = async (photo: Photo) => {
    const newSelected = [
      ...selectedPhotos,
      {
        photoId: photo.id,
        slug: photo.slug,
        order: selectedPhotos.length,
      },
    ];

    setSaving(true);
    try {
      const response = await fetch('/api/homepage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedPhotos: newSelected }),
      });

      if (response.ok) {
        mutate('/api/homepage');
      } else {
        alert('Failed to add photo');
      }
    } catch (error) {
      console.error('Error adding photo:', error);
      alert('Failed to add photo');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePhoto = async (photoId: string, slug: string) => {
    const newSelected = selectedPhotos
      .filter(sp => !(sp.photoId === photoId && sp.slug === slug))
      .map((sp, index) => ({ ...sp, order: index }));

    setSaving(true);
    try {
      const response = await fetch('/api/homepage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedPhotos: newSelected }),
      });

      if (response.ok) {
        mutate('/api/homepage');
      } else {
        alert('Failed to remove photo');
      }
    } catch (error) {
      console.error('Error removing photo:', error);
      alert('Failed to remove photo');
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const reordered = [...selectedPhotos];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    const updated = reordered.map((sp, index) => ({ ...sp, order: index }));

    setSaving(true);
    try {
      const response = await fetch('/api/homepage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedPhotos: updated }),
      });

      if (response.ok) {
        mutate('/api/homepage');
      }
    } catch (error) {
      console.error('Error reordering photos:', error);
    } finally {
      setSaving(false);
    }

    setDraggedIndex(null);
  };

  return (
    <div>
      <h1 className="font-semibold mb-7 text-rurikon-600">Homepage Photos</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Selected Photos with Gallery Layout */}
        <div className="bg-white rounded-lg border border-rurikon-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-rurikon-600 lowercase flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Homepage Preview ({selectedPhotoObjects.length})
            </h2>
            <div className="flex items-center gap-2">
              {saving && (
                <span className="text-sm text-rurikon-400 lowercase mr-2">saving...</span>
              )}
              <div className="flex gap-1 border border-rurikon-200 rounded-md overflow-hidden">
                {[1, 2, 3, 4].map((cols) => (
                  <button
                    key={cols}
                    onClick={() => setPreviewColumns(cols as 1 | 2 | 3 | 4)}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${previewColumns === cols
                      ? 'bg-rurikon-600 text-white'
                      : 'bg-white text-rurikon-600 hover:bg-rurikon-50'
                      }`}
                    title={`Preview ${cols} column${cols > 1 ? 's' : ''}`}
                  >
                    {cols}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-sm text-rurikon-400 mb-4 lowercase">
            Drag photos to reorder • Click × to remove
          </p>

          {selectedPhotoObjects.length === 0 ? (
            <div className="text-center py-12 text-rurikon-400">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="lowercase">No photos selected</p>
              <p className="text-sm mt-1 lowercase">Add photos from the right panel</p>
            </div>
          ) : (
            <div className="w-full">
              <div className="flex flex-wrap w-full">
                {(() => {
                  let imageIndex = 0;
                  const galleryLayout = getGalleryLayout(previewColumns);
                  const totalImagesInPattern = galleryLayout.columns.reduce(
                    (sum, column) => sum + column.length,
                    0
                  );
                  const timesToRepeat = Math.ceil(selectedPhotoObjects.length / totalImagesInPattern);
                  const extendedColumns = Array.from({ length: timesToRepeat }, (_, repeatIndex) =>
                    galleryLayout.columns.map((column, columnIndex) => ({
                      column,
                      key: `${repeatIndex}-${columnIndex}`,
                    }))
                  ).flat();

                  return extendedColumns.map(({ column, key }) => {
                    const columnImages: { photo: typeof selectedPhotoObjects[0]; size: 'full' | 'half'; index: number }[] = [];

                    column.forEach((item) => {
                      if (imageIndex < selectedPhotoObjects.length) {
                        columnImages.push({
                          photo: selectedPhotoObjects[imageIndex],
                          size: item.size as 'full' | 'half',
                          index: imageIndex,
                        });
                        imageIndex++;
                      }
                    });

                    if (columnImages.length === 0) {
                      return null;
                    }

                    return (
                      <div
                        key={key}
                        className="flex w-full md:w-1/2 flex-wrap"
                      >
                        {columnImages.map((item) => {
                          const widthClass = item.size === 'full' ? 'w-full' : 'w-full md:w-1/2';

                          return (
                            <div
                              key={`${item.photo!.slug}-${item.photo!.id}`}
                              className={`${widthClass} p-1`}
                            >
                              <div
                                draggable
                                onDragStart={() => handleDragStart(item.index)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, item.index)}
                                className="relative group cursor-move h-full w-full"
                              >
                                <div className="aspect-[3/2] relative overflow-hidden rounded-md">
                                  <Image
                                    src={`/api/photos/image/${item.photo!.slug}/${item.photo!.order}`}
                                    alt={item.photo!.alt || ''}
                                    fill
                                    className="object-cover object-center"
                                    sizes="(max-width: 768px) 100vw, 50vw"
                                    onError={(e) => {
                                      e.currentTarget.src = item.photo!.url;
                                    }}
                                  />
                                  <div className="absolute inset-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                                    <button
                                      onClick={() => handleRemovePhoto(item.photo!.id, item.photo!.slug)}
                                      className="opacity-0 group-hover:opacity-100 bg-rurikon-600 text-white p-2 rounded-full hover:bg-red-600 transition-all"
                                      title="Remove from homepage"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <div className="absolute top-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                                    #{item.index + 1}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Right: All Available Photos */}
        <div className="bg-white rounded-lg border border-rurikon-100 p-6">
          <h2 className="font-semibold text-rurikon-600 mb-4 lowercase flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            All Photos ({unselectedPhotos.length} available)
          </h2>

          <p className="text-sm text-rurikon-400 mb-4 lowercase">
            Click + to add to homepage
          </p>

          {unselectedPhotos.length === 0 ? (
            <div className="text-center py-12 text-rurikon-400">
              <p className="lowercase">All photos are selected</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-h-150 overflow-y-auto pr-2">
              {unselectedPhotos.map((photo) => (
                <div
                  key={`${photo.slug}-${photo.id}`}
                  className="relative group rounded-lg overflow-hidden bg-rurikon-50 border border-rurikon-200 hover:border-rurikon-400 transition-all"
                >
                  <div className="aspect-square bg-rurikon-100">
                    <img
                      src={`/api/photos/image/${photo.slug}/${photo.order}`}
                      alt={photo.alt || ''}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = photo.url;
                      }}
                    />
                  </div>

                  <div className="absolute inset-0 bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center cursor-pointer">
                    <button
                      onClick={() => handleAddPhoto(photo)}
                      className="opacity-0 group-hover:opacity-100 bg-rurikon-600 text-white p-3 rounded-full hover:bg-rurikon-700 transition-all transform scale-90 group-hover:scale-100"
                      title="Add to homepage"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-2 bg-white">
                    <p className="text-xs text-rurikon-600 truncate font-medium">
                      {photo.alt || 'Untitled'}
                    </p>
                    <p className="text-xs text-rurikon-400 lowercase">{photo.slug}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
