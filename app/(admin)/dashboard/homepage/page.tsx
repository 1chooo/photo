'use client';

import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { ImageIcon, Plus, X, LayoutGrid, GripVertical, Check, Loader2, ImagePlus } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/lib/firebase/useAuth';

interface Photo {
  id: string;
  url: string;
  file_id: string;
  file_name: string;
  file_size: number;
  file_type?: string;
  category?: string;
  alt?: string;
  uploaded_by?: string;
  uploaded_at: string;
  updated_at?: string;
}

interface SelectedPhoto {
  photoId: string;
  order: number;
}

// --- Layout Logic (保持不變) ---
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

const fetcher = async (url: string, token: string | null) => {
  if (!token) return null;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
};

export default function HomepagePhotosManagement() {
  const { user, loading: authLoading } = useAuth();
  const [idToken, setIdToken] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      user.getIdToken().then(setIdToken);
    }
  }, [user]);

  const { data: imagesData } = useSWR(
    idToken ? ['/api/telegram/images', idToken] : null,
    ([url, token]) => fetcher(url, token),
    { revalidateOnFocus: true }
  );

  const { data: homepageData } = useSWR<{ selectedPhotos: SelectedPhoto[] }>(
    '/api/homepage',
    (url) => fetch(url).then((res) => res.json()),
    { revalidateOnFocus: true }
  );

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewColumns, setPreviewColumns] = useState<1 | 2 | 3 | 4>(4);

  const allPhotos = (imagesData?.images || []) as Photo[];
  const selectedPhotos = homepageData?.selectedPhotos || [];

  // Get selected photo objects
  const selectedPhotoObjects = selectedPhotos
    .map(sp => {
      const photo = allPhotos.find(p => p.id === sp.photoId);
      return photo ? { ...photo, selectedOrder: sp.order } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a!.selectedOrder - b!.selectedOrder);

  // Get unselected photos
  const unselectedPhotos = allPhotos.filter(
    photo => !selectedPhotos.some(sp => sp.photoId === photo.id)
  );

  // --- Handlers (保持不變) ---
  const handleAddPhoto = async (photo: Photo) => {
    const newSelected = [
      ...selectedPhotos,
      {
        photoId: photo.id,
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

  const handleRemovePhoto = async (photoId: string) => {
    const newSelected = selectedPhotos
      .filter(sp => sp.photoId !== photoId)
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

  if (authLoading || !user || !idToken) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-rurikon-400">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-rurikon-600" />
        <p>Loading assets...</p>
      </div>
    );
  }

  

  return (
    <div className="pb-10 mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
           <h1 className="text-2xl font-bold text-rurikon-800 tracking-tight">Homepage Gallery</h1>
           <p className="text-gray-500 text-sm mt-1">Manage the featured photos displayed on your homepage.</p>
        </div>
        
        {saving && (
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-rurikon-100 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-rurikon-600" />
            <span className="text-sm font-medium text-rurikon-600">Saving changes...</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: Preview Canvas (Dominant) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Controls Bar */}
          <div className="bg-white rounded-xl border border-rurikon-100 p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 sticky top-4 z-20">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rurikon-50 text-rurikon-600 rounded-lg">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-800 text-sm">Live Preview</h2>
                <p className="text-xs text-gray-400">{selectedPhotoObjects.length} photos selected</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 uppercase font-semibold tracking-wider hidden sm:inline-block">Columns</span>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                {[1, 2, 3, 4].map((cols) => (
                  <button
                    key={cols}
                    onClick={() => setPreviewColumns(cols as 1 | 2 | 3 | 4)}
                    className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-all ${
                      previewColumns === cols
                        ? 'bg-white text-rurikon-600 shadow-sm ring-1 ring-black/5'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                    }`}
                    title={`Set to ${cols} column${cols > 1 ? 's' : ''}`}
                  >
                    {cols}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="bg-gray-50/50 border border-rurikon-100 rounded-xl min-h-125 p-4 sm:p-6 lg:p-8">
            {selectedPhotoObjects.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-lg">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                  <ImagePlus className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Your gallery is empty</h3>
                <p className="text-gray-500 mt-2 max-w-xs text-center">
                  Select photos from the library on the right to add them to your homepage.
                </p>
              </div>
            ) : (
              <div className="w-full transition-all duration-300">
                <div className="flex flex-wrap w-full -m-2">
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

                      if (columnImages.length === 0) return null;

                      return (
                        <div key={key} className="flex w-full md:w-1/2 flex-wrap">
                          {columnImages.map((item) => {
                            const widthClass = item.size === 'full' ? 'w-full' : 'w-full md:w-1/2';

                            return (
                              <div key={item.photo!.id} className={`${widthClass} p-2`}>
                                <div
                                  draggable
                                  onDragStart={() => handleDragStart(item.index)}
                                  onDragOver={handleDragOver}
                                  onDrop={(e) => handleDrop(e, item.index)}
                                  className="group relative h-full w-full rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:-translate-y-0.5"
                                >
                                  {/* Aspect Ratio Container */}
                                  <div className="aspect-3/2 relative bg-gray-200">
                                    <Image
                                      src={item.photo!.url}
                                      alt={item.photo!.alt || ''}
                                      fill
                                      quality={75}
                                      className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
                                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                      unoptimized
                                    />
                                    
                                    {/* Overlay Actions */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300">
                                      {/* Order Badge */}
                                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-mono px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                                        <span className="text-gray-300">#</span>
                                        {item.index + 1}
                                      </div>

                                      {/* Drag Handle Indicator */}
                                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-white pointer-events-none">
                                          <GripVertical className="w-8 h-8 drop-shadow-md" />
                                      </div>

                                      {/* Remove Button */}
                                      <button
                                        onClick={() => handleRemovePhoto(item.photo!.id)}
                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-white/90 text-red-500 p-1.5 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-sm transform hover:scale-110"
                                        title="Remove from homepage"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
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
          <p className="text-center text-xs text-gray-400 mt-2">
            Tip: Drag and drop images to reorder the layout.
          </p>
        </div>

        {/* Right: Library Sidebar (Sticky) */}
        <div className="lg:col-span-4 lg:sticky lg:top-4 h-fit">
          <div className="bg-white rounded-xl border border-rurikon-100 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]">
            <div className="p-4 border-b border-rurikon-100 bg-gray-50/50">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-rurikon-600" />
                Asset Library
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {unselectedPhotos.length} photos available to add
              </p>
            </div>

            <div className="p-4 overflow-y-auto custom-scrollbar">
              {unselectedPhotos.length === 0 ? (
                <div className="text-center py-10">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 text-green-600 mb-3">
                    <Check className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium text-gray-900">All photos selected</p>
                  <p className="text-xs text-gray-500 mt-1">Great job! Your gallery is full.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {unselectedPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative rounded-lg overflow-hidden border border-gray-200 bg-gray-100 hover:border-rurikon-400 hover:shadow-md transition-all"
                    >
                      <div className="aspect-square relative">
                        <Image
                          src={photo.url}
                          alt={photo.alt || ''}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 33vw, 20vw"
                        />
                        
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center cursor-pointer"
                             onClick={() => handleAddPhoto(photo)}>
                          <div className="opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300 bg-white/20 backdrop-blur-sm p-2 rounded-full border border-white/50 text-white">
                            <Plus className="w-6 h-6" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Caption */}
                      <div className="p-2 bg-white">
                        <p className="text-xs font-medium text-gray-700 truncate">
                          {photo.alt || photo.file_name}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">
                          {photo.category || 'Uncategorized'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
