'use client';

import { useAuth } from '@/lib/firebase/useAuth';
import { useState } from 'react';
import useSWR, { mutate } from 'swr';

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
    user ? '/api/telegram/category' : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 30000, // 每 30 秒自動刷新
    }
  );

  const galleries = data?.categories || [];
  const [selectedSlug, setSelectedSlug] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [draggedPhoto, setDraggedPhoto] = useState<string | null>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editingAlt, setEditingAlt] = useState<string>('');
  const [editingUrl, setEditingUrl] = useState<string>('');
  const [editingVariant, setEditingVariant] = useState<'original' | 'square'>('original');
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [newSlugName, setNewSlugName] = useState<string>('');

  const handleDeletePhoto = async (slug: string, photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    if (!user) return;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/telegram/category?slug=${slug}&photoId=${photoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (response.ok) {
        await mutate('/api/telegram/category');
      } else {
        alert('Delete failed');
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Delete failed');
    }
  };

  const handleUpdatePhoto = async (slug: string, photoId: string, url: string, alt: string, variant: 'original' | 'square') => {
    if (!user) return;
    
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/telegram/category', {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ slug, photoId, url, alt, variant }),
      });

      if (response.ok) {
        await mutate('/api/telegram/category');
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
      const response = await fetch('/api/telegram/category', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ slug, photos }),
      });

      if (response.ok) {
        await mutate('/api/telegram/category');
      }
    } catch (error) {
      console.error('Error reordering photos:', error);
    }

    setDraggedPhoto(null);
  };

  const handleRenameSlug = async (oldSlug: string, newSlug: string) => {
    if (!newSlug.trim() || oldSlug === newSlug) {
      alert('Please enter a valid new slug');
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
      const response = await fetch('/api/telegram/category/rename', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ oldSlug, newSlug }),
      });

      if (response.ok) {
        await mutate('/api/telegram/category');
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

  if (!user) {
    return (
      <div className="mt-7 text-rurikon-600">Please sign in to manage photos.</div>
    );
  }

  if (error) {
    return (
      <div className="mt-7 text-rurikon-600">Failed to load galleries. Please try again.</div>
    );
  }

  return (
    <div>
      <div>
        <h1 className="font-semibold mb-7 text-rurikon-600">Photo Management</h1>

        {isLoading && (
          <div className="mt-7 bg-white rounded-lg border border-rurikon-100 p-6 text-center">
            <p className="text-rurikon-600">Loading galleries...</p>
          </div>
        )}

        {/* Gallery List */}
        <div className="mt-7 bg-white rounded-lg border border-rurikon-100 p-6">
          <h2 className="font-semibold mb-7 text-rurikon-600">Gallery List</h2>
          
          <div className="space-y-2 mb-6">
            {galleries.map(gallery => (
              <div key={gallery.slug}>
                {editingSlug === gallery.slug ? (
                  <div className="flex gap-2 p-2 bg-rurikon-50 rounded-md border-2 border-rurikon-300">
                    <input
                      type="text"
                      value={newSlugName}
                      onChange={(e) => setNewSlugName(e.target.value)}
                      placeholder="Enter new slug name"
                      className="flex-1 px-3 py-2 border border-rurikon-200 rounded-md focus:ring-2 focus:ring-rurikon-400 focus:border-rurikon-400 text-rurikon-600 lowercase"
                      autoFocus
                    />
                    <button
                      onClick={() => handleRenameSlug(gallery.slug, newSlugName)}
                      disabled={loading}
                      className="bg-rurikon-600 text-white px-4 py-2 rounded-md hover:bg-rurikon-700 disabled:bg-rurikon-200 disabled:cursor-not-allowed lowercase"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingSlug(null);
                        setNewSlugName('');
                      }}
                      className="bg-rurikon-100 text-rurikon-600 px-4 py-2 rounded-md hover:bg-rurikon-200 lowercase"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedSlug(gallery.slug)}
                      className={`flex-1 text-left px-4 py-3 rounded-md transition-colors lowercase ${
                        selectedSlug === gallery.slug
                          ? 'bg-rurikon-50 text-rurikon-600 border-2 border-rurikon-300'
                          : 'bg-white text-rurikon-600 hover:bg-rurikon-50 border-2 border-rurikon-100'
                      }`}
                    >
                      <span className="font-semibold">{gallery.slug}</span>
                      <span className="ml-2 text-sm text-rurikon-400">
                        ({gallery.images.length} photos)
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setEditingSlug(gallery.slug);
                        setNewSlugName(gallery.slug);
                      }}
                      className="px-3 py-2 text-sm text-rurikon-600 hover:text-rurikon-700 hover:bg-rurikon-50 rounded-md lowercase"
                      title="Rename slug"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Photos Display */}
          {currentGallery && (
            <div>
              <h3 className="font-semibold mb-7 text-rurikon-600 lowercase">
                {currentGallery.slug}'s Photos
                <span className="text-sm text-rurikon-400 ml-2">
                  (Drag photos to reorder)
                </span>
              </h3>
              
              {currentGallery.images.length === 0 ? (
                <p className="text-rurikon-400 text-center py-8">No photos in this gallery yet</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {currentGallery.images.map((photo, index) => (
                      <div
                        key={photo.id}
                        draggable
                        onDragStart={() => handleDragStart(photo.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, photo.id, currentGallery.slug)}
                        className="relative group cursor-move bg-white rounded-lg overflow-hidden border border-rurikon-100 hover:border-rurikon-300 transition-all"
                      >
                        <div className="aspect-square relative">
                          <img
                            src={photo.url}
                            alt={photo.alt || `Photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                            #{index + 1}
                          </div>
                          <button
                            onClick={() => handleDeletePhoto(currentGallery.slug, photo.id)}
                            className="absolute top-2 right-2 bg-rurikon-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rurikon-700"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                        <div className="p-2 bg-white">
                          {editingPhotoId === photo.id ? (
                            <div className="space-y-2">
                              <input
                                type="url"
                                value={editingUrl}
                                onChange={(e) => setEditingUrl(e.target.value)}
                                placeholder="Photo URL"
                                className="w-full text-xs px-2 py-1 border border-rurikon-200 rounded focus:ring-1 focus:ring-rurikon-400 text-rurikon-600"
                              />
                              <input
                                type="text"
                                value={editingAlt}
                                onChange={(e) => setEditingAlt(e.target.value)}
                                placeholder="Alt text"
                                className="w-full text-xs px-2 py-1 border border-rurikon-200 rounded focus:ring-1 focus:ring-rurikon-400 text-rurikon-600"
                              />
                              <select
                                value={editingVariant}
                                onChange={(e) => setEditingVariant(e.target.value as 'original' | 'square')}
                                className="w-full text-xs px-2 py-1 border border-rurikon-200 rounded focus:ring-1 focus:ring-rurikon-400 text-rurikon-600"
                              >
                                <option value="original">Original</option>
                                <option value="square">Square</option>
                              </select>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleUpdatePhoto(currentGallery.slug, photo.id, editingUrl, editingAlt, editingVariant)}
                                  className="flex-1 bg-rurikon-600 text-white text-xs px-2 py-1 rounded hover:bg-rurikon-700 lowercase"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingPhotoId(null);
                                    setEditingAlt('');
                                    setEditingUrl('');
                                    setEditingVariant('original');
                                  }}
                                  className="flex-1 bg-rurikon-100 text-rurikon-600 text-xs px-2 py-1 rounded hover:bg-rurikon-200 lowercase"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs text-rurikon-400 truncate mb-1">{photo.url}</p>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-rurikon-600 truncate flex-1">
                                  {photo.alt ? `${photo.alt}` : 'No alt text'}
                                </p>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-rurikon-600 lowercase">
                                  Variant: {photo.variant || 'original'}
                                </p>
                                <button
                                  onClick={() => {
                                    setEditingPhotoId(photo.id);
                                    setEditingAlt(photo.alt || '');
                                    setEditingUrl(photo.url);
                                    setEditingVariant(photo.variant || 'original');
                                  }}
                                  className="text-rurikon-600 hover:text-rurikon-700 text-xs ml-2 lowercase"
                                >
                                  Edit
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
          )}
        </div>
      </div>
    </div>
  );
}
