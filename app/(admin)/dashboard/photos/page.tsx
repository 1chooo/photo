'use client';

import { useAuth } from '@/lib/firebase/useAuth';
import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { 
  Folder, 
  Image as ImageIcon, 
  Edit2, 
  Trash2, 
  Save, 
  GripVertical, 
  Loader2,
  FolderOpen,
  CheckSquare,
  Square,
  X
} from 'lucide-react';
import Image from 'next/image';

interface Photo {
  id: string;
  url: string;
  file_name: string;
  alt?: string;
  variant: 'original' | 'square';
  uploaded_at: string;
}

interface Gallery {
  slug: string;
  images: Photo[];
  createdAt: string;
  updatedAt: string;
}

const fetcher = async (url: string) => {
  const auth = (await import('firebase/auth')).getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const token = await user.getIdToken();
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function PhotosManagement() {
  const { user } = useAuth();
  const { data, error, isLoading } = useSWR<{ categories: Gallery[] }>(
    user ? '/api/category' : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 30000,
    }
  );

  const galleries = data?.categories || [];
  const [selectedSlug, setSelectedSlug] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [draggedPhoto, setDraggedPhoto] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  
  // Edit states
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editingAlt, setEditingAlt] = useState<string>('');
  const [editingUrl, setEditingUrl] = useState<string>('');
  const [editingVariant, setEditingVariant] = useState<'original' | 'square'>('original');
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [newSlugName, setNewSlugName] = useState<string>('');

  // --- Handlers (保持不變) ---
  const handleDeletePhoto = async (slug: string, photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    if (!user) return;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/category?slug=${slug}&photoId=${photoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (response.ok) {
        await mutate('/api/category');
      } else {
        alert('Delete failed');
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Delete failed');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedPhotos.size === 0) return;
    if (!user) return;

    const count = selectedPhotos.size;
    if (!confirm(`Are you sure you want to delete ${count} photo${count > 1 ? 's' : ''}? They will be moved to the deleted-photos collection.`)) return;

    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/category/batch-delete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug: selectedSlug,
          photoIds: Array.from(selectedPhotos),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        await mutate('/api/category');
        setSelectedPhotos(new Set());
        setIsBatchMode(false);
        alert(result.message || 'Photos deleted successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Batch delete failed');
      }
    } catch (error) {
      console.error('Error batch deleting photos:', error);
      alert('Batch delete failed');
    } finally {
      setLoading(false);
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (!currentGallery) return;
    if (selectedPhotos.size === currentGallery.images.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(currentGallery.images.map(p => p.id)));
    }
  };

  // Clear selection when changing galleries
  const handleSelectGallery = (slug: string) => {
    setSelectedSlug(slug);
    setSelectedPhotos(new Set());
    setIsBatchMode(false);
  };

  const handleUpdatePhoto = async (slug: string, photoId: string, url: string, alt: string, variant: 'original' | 'square') => {
    if (!user) return;
    
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/category', {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ slug, photoId, url, alt, variant }),
      });

      if (response.ok) {
        await mutate('/api/category');
        setEditingPhotoId(null);
        setEditingAlt('');
        setEditingUrl('');
        setEditingVariant('original');
      } else {
        alert('Update failed');
      }
    } catch (error) {
      console.error('Error updating photo:', error);
      alert('Update failed');
    }
  };

  const handleDragStart = (photoId: string) => {
    setDraggedPhoto(photoId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetPhotoId: string, slug: string) => {
    e.preventDefault();
    if (!draggedPhoto || draggedPhoto === targetPhotoId) return;

    if (!user) return;

    const gallery = galleries.find(g => g.slug === slug);
    if (!gallery) return;

    const photos = [...gallery.images];
    const draggedIndex = photos.findIndex(p => p.id === draggedPhoto);
    const targetIndex = photos.findIndex(p => p.id === targetPhotoId);

    const [removed] = photos.splice(draggedIndex, 1);
    photos.splice(targetIndex, 0, removed);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/category', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ slug, photos }),
      });

      if (response.ok) {
        await mutate('/api/category');
      }
    } catch (error) {
      console.error('Error reordering photos:', error);
    }

    setDraggedPhoto(null);
  };

  const handleRenameSlug = async (oldSlug: string, newSlug: string) => {
    if (!newSlug.trim() || oldSlug === newSlug) {
      setEditingSlug(null);
      return;
    }

    if (galleries.find(g => g.slug === newSlug)) {
      alert('This slug already exists');
      return;
    }

    if (!confirm(`Rename "${oldSlug}" to "${newSlug}"?`)) return;

    if (!user) return;

    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/category/rename', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ oldSlug, newSlug }),
      });

      if (response.ok) {
        await mutate('/api/category');
        setSelectedSlug(newSlug);
        setEditingSlug(null);
        setNewSlugName('');
      } else {
        const data = await response.json();
        alert(data.error || 'Rename failed');
      }
    } catch (error) {
      console.error('Error renaming slug:', error);
      alert('Rename failed');
    } finally {
      setLoading(false);
    }
  };

  const currentGallery = galleries.find(g => g.slug === selectedSlug);

  // --- UI Renders ---

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-rurikon-600">
        <p>Please sign in to manage photos.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-red-600 bg-red-50 rounded-lg p-6">
        <p>Failed to load galleries. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-rurikon-800 tracking-tight">Photo Management</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start h-[calc(100vh-150px)]">
        
        {/* Left Sidebar: Gallery List */}
        <div className="w-full lg:w-72 shrink-0 bg-white rounded-xl border border-rurikon-100 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b border-rurikon-50 bg-gray-50/50">
            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
              <Folder className="w-4 h-4" />
              Collections ({galleries.length})
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
            {isLoading && (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading...
              </div>
            )}
            
            {galleries.map(gallery => (
              <div key={gallery.slug} className="group relative">
                {editingSlug === gallery.slug ? (
                  <div className="p-2 bg-white border-2 border-rurikon-400 rounded-lg shadow-sm animate-in fade-in zoom-in-95 duration-200">
                    <input
                      type="text"
                      value={newSlugName}
                      onChange={(e) => setNewSlugName(e.target.value)}
                      placeholder="Name"
                      className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-rurikon-200 mb-2 lowercase"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSlug(gallery.slug, newSlugName);
                        if (e.key === 'Escape') setEditingSlug(null);
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRenameSlug(gallery.slug, newSlugName)}
                        disabled={loading}
                        className="flex-1 bg-rurikon-600 text-white text-xs py-1 rounded hover:bg-rurikon-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingSlug(null)}
                        className="flex-1 bg-gray-100 text-gray-600 text-xs py-1 rounded hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => handleSelectGallery(gallery.slug)}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                      selectedSlug === gallery.slug
                        ? 'bg-rurikon-50 text-rurikon-700 ring-1 ring-rurikon-200 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {selectedSlug === gallery.slug ? (
                        <FolderOpen className="w-4 h-4 shrink-0 text-rurikon-500" />
                      ) : (
                        <Folder className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-gray-500" />
                      )}
                      <div className="min-w-0">
                         <p className="font-medium text-sm truncate">{gallery.slug}</p>
                         <p className="text-xs text-gray-400">{gallery.images.length} photos</p>
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSlug(gallery.slug);
                        setNewSlugName(gallery.slug);
                      }}
                      className={`p-1.5 rounded-md hover:bg-white hover:shadow-sm transition-all ${
                         selectedSlug === gallery.slug ? 'text-rurikon-400 hover:text-rurikon-600' : 'text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100'
                      }`}
                      title="Rename collection"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Content: Photos Grid */}
        <div className="flex-1 bg-white rounded-xl border border-rurikon-100 shadow-sm h-full flex flex-col overflow-hidden">
          {currentGallery ? (
            <>
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-rurikon-50 bg-gray-50/30 flex items-center justify-between shrink-0">
                 <div>
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <span className="text-rurikon-600 uppercase tracking-wide text-sm font-bold bg-rurikon-50 px-2 py-0.5 rounded">Gallery</span>
                      {currentGallery.slug}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      {isBatchMode && selectedPhotos.size > 0 
                        ? `${selectedPhotos.size} of ${currentGallery.images.length} selected`
                        : `Drag and drop to reorder • ${currentGallery.images.length} photos`
                      }
                    </p>
                 </div>
                 
                 {/* Batch Actions */}
                 <div className="flex items-center gap-2">
                   {isBatchMode ? (
                     <>
                       <button
                         onClick={toggleSelectAll}
                         className="text-xs px-3 py-1.5 border border-rurikon-200 rounded-lg hover:bg-rurikon-50 text-rurikon-700 transition-colors flex items-center gap-1.5"
                       >
                         {selectedPhotos.size === currentGallery.images.length ? (
                           <><CheckSquare className="w-3.5 h-3.5" /> Deselect All</>
                         ) : (
                           <><Square className="w-3.5 h-3.5" /> Select All</>
                         )}
                       </button>
                       <button
                         onClick={handleBatchDelete}
                         disabled={selectedPhotos.size === 0 || loading}
                         className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                       >
                         <Trash2 className="w-3.5 h-3.5" />
                         Delete {selectedPhotos.size > 0 && `(${selectedPhotos.size})`}
                       </button>
                       <button
                         onClick={() => {
                           setIsBatchMode(false);
                           setSelectedPhotos(new Set());
                         }}
                         className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors flex items-center gap-1.5"
                       >
                         <X className="w-3.5 h-3.5" /> Cancel
                       </button>
                     </>
                   ) : (
                     <button
                       onClick={() => setIsBatchMode(true)}
                       className="text-xs px-3 py-1.5 border border-rurikon-200 rounded-lg hover:bg-rurikon-50 text-rurikon-700 transition-colors flex items-center gap-1.5"
                     >
                       <CheckSquare className="w-3.5 h-3.5" /> Batch Select
                     </button>
                   )}
                 </div>
              </div>

              {/* Grid Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-50/50">
                {currentGallery.images.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <ImageIcon className="w-8 h-8 opacity-50" />
                    </div>
                    <p>No photos in this gallery yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {currentGallery.images.map((photo, index) => (
                      <div
                        key={photo.id}
                        draggable={!isBatchMode}
                        onDragStart={() => handleDragStart(photo.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, photo.id, currentGallery.slug)}
                        onClick={() => isBatchMode && togglePhotoSelection(photo.id)}
                        className={`group relative bg-white rounded-xl overflow-hidden border transition-all duration-200 hover:shadow-md ${
                          draggedPhoto === photo.id 
                            ? 'opacity-40 border-dashed border-rurikon-400 scale-95' 
                            : selectedPhotos.has(photo.id)
                            ? 'border-rurikon-500 ring-2 ring-rurikon-200 scale-[0.98]'
                            : 'border-rurikon-100 hover:border-rurikon-300'
                        } ${isBatchMode ? 'cursor-pointer' : ''}`}
                      >
                        {/* Image Container */}
                        <div className={`aspect-square relative bg-gray-100 group ${isBatchMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}>
                           {/* Batch Mode Checkbox */}
                           {isBatchMode && (
                             <div className="absolute top-2 left-2 z-30">
                               <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                                 selectedPhotos.has(photo.id)
                                   ? 'bg-rurikon-600 border-rurikon-600'
                                   : 'bg-white/90 border-white backdrop-blur-sm'
                               }`}>
                                 {selectedPhotos.has(photo.id) && (
                                   <CheckSquare className="w-4 h-4 text-white" />
                                 )}
                               </div>
                             </div>
                           )}
                           
                           {/* Drag Handle Overlay */}
                           <div className={`absolute inset-0 z-10 transition-opacity bg-linear-to-t from-black/40 via-transparent to-black/20 pointer-events-none ${
                             isBatchMode ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
                           }`} />
                           
                           {/* Order Badge */}
                           {!isBatchMode && (
                             <div className="absolute top-2 left-2 z-20 bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded font-mono shadow-sm">
                                #{index + 1}
                             </div>
                           )}

                           {/* Grip Icon */}
                           {!isBatchMode && (
                             <div className="absolute top-2 right-2 z-20 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md">
                                <GripVertical className="w-4 h-4" />
                             </div>
                           )}

                           <Image
                            src={photo.url}
                            alt={photo.alt || `Photo ${index + 1}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            unoptimized
                          />
                        </div>

                        {/* Content / Edit Form */}
                        <div className="p-3" onClick={(e) => isBatchMode && e.stopPropagation()}>
                          {editingPhotoId === photo.id ? (
                            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                              <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Image URL</label>
                                <input
                                  type="url"
                                  value={editingUrl}
                                  onChange={(e) => setEditingUrl(e.target.value)}
                                  className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-rurikon-400 outline-none text-gray-700 bg-gray-50"
                                  placeholder="https://..."
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Alt Text</label>
                                <input
                                  type="text"
                                  value={editingAlt}
                                  onChange={(e) => setEditingAlt(e.target.value)}
                                  className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-rurikon-400 outline-none text-gray-700 bg-gray-50"
                                  placeholder="Description"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Display Variant</label>
                                <select
                                  value={editingVariant}
                                  onChange={(e) => setEditingVariant(e.target.value as 'original' | 'square')}
                                  className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-rurikon-400 outline-none text-gray-700 bg-gray-50"
                                >
                                  <option value="original">Original</option>
                                  <option value="square">Square</option>
                                </select>
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => handleUpdatePhoto(currentGallery.slug, photo.id, editingUrl, editingAlt, editingVariant)}
                                  className="flex-1 bg-rurikon-600 text-white text-xs py-1.5 rounded hover:bg-rurikon-700 transition-colors flex items-center justify-center gap-1"
                                >
                                  <Save className="w-3 h-3" /> Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingPhotoId(null);
                                    setEditingAlt('');
                                    setEditingUrl('');
                                    setEditingVariant('original');
                                  }}
                                  className="flex-1 bg-gray-100 text-gray-600 text-xs py-1.5 rounded hover:bg-gray-200 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-medium text-gray-700 truncate flex-1" title={photo.alt}>
                                  {photo.alt || <span className="text-gray-400 italic">No alt text</span>}
                                </p>
                                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200 whitespace-nowrap">
                                  {photo.variant || 'original'}
                                </span>
                              </div>
                              
                              <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                                <button
                                  onClick={() => {
                                    setEditingPhotoId(photo.id);
                                    setEditingAlt(photo.alt || '');
                                    setEditingUrl(photo.url);
                                    setEditingVariant(photo.variant || 'original');
                                  }}
                                  className="text-xs text-rurikon-600 hover:text-rurikon-800 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <Edit2 className="w-3 h-3" /> Edit Info
                                </button>
                                
                                <button
                                  onClick={() => handleDeletePhoto(currentGallery.slug, photo.id)}
                                  className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50"
                                  title="Delete photo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/30">
              <FolderOpen className="w-12 h-12 mb-3 opacity-20" />
              <p>Select a collection from the left to view photos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
